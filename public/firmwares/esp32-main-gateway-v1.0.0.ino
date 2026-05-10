#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <esp_now.h>
#include <esp_wifi.h>

// ===== WIFI =====
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ===== MQTT =====
const char* MQTT_HOST = "broker.emqx.io";
const int MQTT_PORT = 1883;

// ===== SMART AQUARIUM IDS =====
const int USER_ID = 6;
const int TANK_ID = 5;
const int DEVICE_ID = 3;

// ===== SECURITY TOKEN =====
// Dán token thật của device vào đây. Không gửi token lên chat/log công khai.
const char* DEVICE_MQTT_TOKEN = "YOUR_DEVICE_MQTT_TOKEN";

// ===== ESP-NOW SECURITY =====
// Phải giống y chang key trong ESP32-S3 mini generic firmware.
// Không gửi key này lên chat/log công khai.
#define ESPNOW_SHARED_KEY "CHANGE_ME_NODE_SHARED_KEY"

// ===== DEFAULT PIN MAP =====
const int DEFAULT_LIGHT_PIN = 25;
const int DEFAULT_SERVO_PIN = 13;
const int DEFAULT_DS18B20_PIN = 16;

// ===== RUNTIME CONFIG FROM WEB =====
int lightPin = DEFAULT_LIGHT_PIN;
int servoPin = DEFAULT_SERVO_PIN;
int ds18b20Pin = DEFAULT_DS18B20_PIN;

bool lightEnabled = true;
bool servoEnabled = true;
bool ds18b20Enabled = true;

bool hcsr04Enabled = false;
int hcsr04TrigPin = -1;
int hcsr04EchoPin = -1;
float hcsr04TankDepthCm = 30.0;
float hcsr04MountOffsetCm = 0.0;

// ===== WIRELESS HC-SR04 VIA ESP-NOW =====
bool wirelessHcsr04Enabled = true;
char wirelessHcsr04NodeCode[24] = "S3_WATER_01";
char wirelessHcsr04ModuleType[16] = "hc_sr04";

int wirelessTrigPin = 6;
int wirelessEchoPin = 7;
float wirelessTankDepthCm = 30.0;
float wirelessMountOffsetCm = 0.0;
uint32_t wirelessReadIntervalMs = 5000;

float latestWirelessDistanceCm = NAN;
float latestWirelessWaterLevelCm = NAN;
float latestWirelessEmptyDistanceCm = 30.0;
uint32_t latestWirelessSeq = 0;
uint32_t latestWirelessNodeUptimeMs = 0;
unsigned long latestWirelessPacketMs = 0;
bool latestWirelessDataValid = false;

unsigned long wirelessPacketTimeoutMs = 15000;
bool espNowReady = false;
uint8_t espNowWifiChannel = 0;
uint32_t outgoingConfigSeq = 0;
uint32_t latestNodeAckSeq = 0;
uint32_t latestNodeAckConfigSeq = 0;

// ===== PACKET CONSTANTS =====
const uint32_t SMART_AQUA_MAGIC = 0xA0A02026;
const uint32_t SMART_AQUA_CTRL_MAGIC = 0xA0A0C0DE;

const uint8_t PACKET_VERSION = 1;
const uint8_t PACKET_TYPE_SENSOR = 1;
const uint8_t PACKET_TYPE_CONFIG = 2;
const uint8_t PACKET_TYPE_CONFIG_ACK = 3;

uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Sensor packet giữ format cũ để tương thích S3 node.
typedef struct __attribute__((packed)) {
  uint32_t magic;
  uint8_t version;

  char node_code[24];
  char module_type[16];

  float distance_cm;
  float water_level_cm;
  float empty_distance_cm;

  uint32_t seq;
  uint32_t uptime_ms;

  uint8_t status;
} WirelessWaterPacket;

// Config packet gửi từ gateway xuống S3 mini.
typedef struct __attribute__((packed)) {
  uint32_t magic;
  uint8_t version;
  uint8_t packet_type;

  char target_node_code[24];
  char module_type[16];

  int16_t trig_pin;
  int16_t echo_pin;

  float tank_empty_distance_cm;
  float mount_offset_cm;

  uint32_t read_interval_ms;
  uint32_t seq;

  uint32_t key_hash;
} NodeConfigPacket;

// ACK packet S3 mini gửi về gateway.
typedef struct __attribute__((packed)) {
  uint32_t magic;
  uint8_t version;
  uint8_t packet_type;

  char node_code[24];
  char module_type[16];

  uint32_t config_seq;
  uint32_t ack_seq;

  uint8_t status;
  char message[48];

  uint32_t uptime_ms;
  uint32_t key_hash;
} NodeConfigAckPacket;

int servoDefaultAngle = 0;
int servoFeedAngle = 90;
int servoFeedDurationMs = 900;

unsigned long publishIntervalMs = 5000;
unsigned long lastPublish = 0;

// ===== DS18B20 dynamic object =====
OneWire* oneWireBus = nullptr;
DallasTemperature* ds18b20 = nullptr;

// ===== MQTT CLIENT =====
WiFiClient espClient;
PubSubClient mqttClient(espClient);
Servo feederServo;

// ===== ACTUATOR STATES =====
bool lightState = false;
bool pumpState = false;
bool oxygenState = false;
bool autoModeState = false;

// ===============================
// MQTT TOPICS
// ===============================
String sensorTopic() {
  return "aquarium/" + String(USER_ID) + "/" + String(TANK_ID) + "/sensor";
}

String controlTopic() {
  return "aquarium/" + String(USER_ID) + "/" + String(TANK_ID) + "/control";
}

String configTopic() {
  return "aquarium/" + String(USER_ID) + "/" + String(TANK_ID) + "/config";
}

String configAckTopic() {
  return "aquarium/" + String(USER_ID) + "/" + String(TANK_ID) + "/config_ack";
}

// ===============================
// STRING HELPERS
// ===============================
void copyCString(char* dest, size_t destSize, const char* src, const char* fallback = "") {
  if (destSize == 0) return;

  const char* value = src;

  if (value == nullptr || strlen(value) == 0) {
    value = fallback;
  }

  if (value == nullptr) {
    value = "";
  }

  snprintf(dest, destSize, "%s", value);
}

// ===============================
// HASH HELPERS
// ===============================
uint32_t fnv1aUpdate(uint32_t hash, const uint8_t* data, size_t len) {
  for (size_t i = 0; i < len; i++) {
    hash ^= data[i];
    hash *= 16777619UL;
  }
  return hash;
}

uint32_t simpleKeyHashForConfig(const NodeConfigPacket& pkt) {
  uint32_t hash = 2166136261UL;

  const char* key = ESPNOW_SHARED_KEY;
  hash = fnv1aUpdate(hash, (const uint8_t*)key, strlen(key));

  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.magic, sizeof(pkt.magic));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.version, sizeof(pkt.version));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.packet_type, sizeof(pkt.packet_type));
  hash = fnv1aUpdate(hash, (const uint8_t*)pkt.target_node_code, sizeof(pkt.target_node_code));
  hash = fnv1aUpdate(hash, (const uint8_t*)pkt.module_type, sizeof(pkt.module_type));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.trig_pin, sizeof(pkt.trig_pin));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.echo_pin, sizeof(pkt.echo_pin));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.tank_empty_distance_cm, sizeof(pkt.tank_empty_distance_cm));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.mount_offset_cm, sizeof(pkt.mount_offset_cm));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.read_interval_ms, sizeof(pkt.read_interval_ms));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.seq, sizeof(pkt.seq));

  return hash;
}

uint32_t simpleKeyHashForAck(const NodeConfigAckPacket& pkt) {
  uint32_t hash = 2166136261UL;

  const char* key = ESPNOW_SHARED_KEY;
  hash = fnv1aUpdate(hash, (const uint8_t*)key, strlen(key));

  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.magic, sizeof(pkt.magic));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.version, sizeof(pkt.version));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.packet_type, sizeof(pkt.packet_type));
  hash = fnv1aUpdate(hash, (const uint8_t*)pkt.node_code, sizeof(pkt.node_code));
  hash = fnv1aUpdate(hash, (const uint8_t*)pkt.module_type, sizeof(pkt.module_type));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.config_seq, sizeof(pkt.config_seq));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.ack_seq, sizeof(pkt.ack_seq));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.status, sizeof(pkt.status));
  hash = fnv1aUpdate(hash, (const uint8_t*)pkt.message, sizeof(pkt.message));
  hash = fnv1aUpdate(hash, (const uint8_t*)&pkt.uptime_ms, sizeof(pkt.uptime_ms));

  return hash;
}

// ===============================
// ESP-NOW UTILS
// ===============================
void printMacAddress(const uint8_t* mac) {
  if (mac == nullptr) return;

  for (int i = 0; i < 6; i++) {
    if (mac[i] < 16) Serial.print("0");
    Serial.print(mac[i], HEX);
    if (i < 5) Serial.print(":");
  }
}

bool isValidGatewayGpioForWirelessNode(int pin) {
  if (pin < 0) return false;
  if (pin > 48) return false;
  if (pin == 19 || pin == 20) return false;
  return true;
}

// ===============================
// CONFIG ACK PUBLISH
// ===============================
void publishConfigAck(const char* status, const char* messageText, int moduleCount) {
  StaticJsonDocument<512> ack;

  ack["device_id"] = DEVICE_ID;
  ack["device_token"] = DEVICE_MQTT_TOKEN;
  ack["status"] = status;
  ack["message"] = messageText;
  ack["module_count"] = moduleCount;
  ack["millis"] = millis();

  String payload;
  serializeJson(ack, payload);

  String topic = configAckTopic();

  Serial.print("Publish config ACK topic: ");
  Serial.println(topic);
  Serial.print("ACK payload: ");
  Serial.println(payload);

  if (mqttClient.connected()) {
    mqttClient.publish(topic.c_str(), payload.c_str(), false);
  } else {
    Serial.println("ACK publish skipped: MQTT not connected");
  }
}

// ===============================
// ESP-NOW SEND CONFIG TO S3
// ===============================
void sendWirelessConfigToNode() {
  if (!espNowReady) {
    Serial.println("[ESP-NOW] Cannot send node config: ESP-NOW not ready");
    return;
  }

  if (!wirelessHcsr04Enabled) {
    Serial.println("[ESP-NOW] Cannot send node config: wireless HC-SR04 disabled");
    return;
  }

  if (!isValidGatewayGpioForWirelessNode(wirelessTrigPin) ||
      !isValidGatewayGpioForWirelessNode(wirelessEchoPin) ||
      wirelessTrigPin == wirelessEchoPin) {
    Serial.println("[ESP-NOW] Cannot send node config: invalid TRIG/ECHO");
    return;
  }

  NodeConfigPacket cfg;
  memset(&cfg, 0, sizeof(cfg));

  cfg.magic = SMART_AQUA_CTRL_MAGIC;
  cfg.version = PACKET_VERSION;
  cfg.packet_type = PACKET_TYPE_CONFIG;

  copyCString(cfg.target_node_code, sizeof(cfg.target_node_code), wirelessHcsr04NodeCode, "S3_WATER_01");
  copyCString(cfg.module_type, sizeof(cfg.module_type), "hc_sr04", "hc_sr04");

  cfg.trig_pin = wirelessTrigPin;
  cfg.echo_pin = wirelessEchoPin;
  cfg.tank_empty_distance_cm = wirelessTankDepthCm;
  cfg.mount_offset_cm = wirelessMountOffsetCm;
  cfg.read_interval_ms = wirelessReadIntervalMs;
  cfg.seq = ++outgoingConfigSeq;

  cfg.key_hash = simpleKeyHashForConfig(cfg);

  Serial.println();
  Serial.println("========== SEND CONFIG TO S3 NODE ==========");
  Serial.print("Target node    : ");
  Serial.println(cfg.target_node_code);
  Serial.print("Module type    : ");
  Serial.println(cfg.module_type);
  Serial.print("TRIG GPIO      : ");
  Serial.println(cfg.trig_pin);
  Serial.print("ECHO GPIO      : ");
  Serial.println(cfg.echo_pin);
  Serial.print("Tank depth cm  : ");
  Serial.println(cfg.tank_empty_distance_cm, 2);
  Serial.print("Mount offset   : ");
  Serial.println(cfg.mount_offset_cm, 2);
  Serial.print("Read interval  : ");
  Serial.println(cfg.read_interval_ms);
  Serial.print("Config seq     : ");
  Serial.println(cfg.seq);
  Serial.println("============================================");

  esp_err_t result = esp_now_send(broadcastAddress, (uint8_t*)&cfg, sizeof(cfg));

  if (result == ESP_OK) {
    Serial.println("[ESP-NOW] Node config queued");
  } else {
    Serial.print("[ESP-NOW] Node config send failed code: ");
    Serial.println(result);
  }
}

// ===============================
// ESP-NOW RECEIVE HANDLERS
// ===============================
void handleWirelessWaterPacket(const uint8_t* data, int len, const uint8_t* srcMac) {
  if (len != sizeof(WirelessWaterPacket)) {
    Serial.print("[ESP-NOW] Ignore sensor packet: wrong size ");
    Serial.println(len);
    return;
  }

  WirelessWaterPacket packet;
  memcpy(&packet, data, sizeof(packet));

  if (packet.magic != SMART_AQUA_MAGIC) {
    Serial.print("[ESP-NOW] Ignore sensor packet: wrong magic 0x");
    Serial.println(packet.magic, HEX);
    return;
  }

  if (strcmp(packet.module_type, "hc_sr04") != 0) {
    Serial.print("[ESP-NOW] Ignore sensor packet: module_type=");
    Serial.println(packet.module_type);
    return;
  }

  if (!wirelessHcsr04Enabled) {
    Serial.println("[ESP-NOW] Wireless HC-SR04 sensor ignored: module disabled by config");
    return;
  }

  if (strlen(wirelessHcsr04NodeCode) > 0 && strcmp(packet.node_code, wirelessHcsr04NodeCode) != 0) {
    Serial.print("[ESP-NOW] Ignore sensor packet: node_code=");
    Serial.print(packet.node_code);
    Serial.print(" expected=");
    Serial.println(wirelessHcsr04NodeCode);
    return;
  }

  latestWirelessSeq = packet.seq;
  latestWirelessNodeUptimeMs = packet.uptime_ms;
  latestWirelessPacketMs = millis();

  if (packet.status == 1 && packet.distance_cm >= 0 && packet.water_level_cm >= 0) {
    latestWirelessDistanceCm = packet.distance_cm;
    latestWirelessWaterLevelCm = packet.water_level_cm;
    latestWirelessEmptyDistanceCm = packet.empty_distance_cm > 0 ? packet.empty_distance_cm : wirelessTankDepthCm;
    latestWirelessDataValid = true;
  } else {
    latestWirelessDistanceCm = NAN;
    latestWirelessWaterLevelCm = NAN;
    latestWirelessDataValid = false;
  }

  Serial.println();
  Serial.println("========== ESP-NOW WATER NODE ==========");
  Serial.print("From MAC       : ");
  printMacAddress(srcMac);
  Serial.println();

  Serial.print("Node code      : ");
  Serial.println(packet.node_code);

  Serial.print("Module type    : ");
  Serial.println(packet.module_type);

  Serial.print("Status         : ");
  Serial.println(packet.status == 1 ? "OK" : "READ_FAILED");

  Serial.print("Distance cm    : ");
  Serial.println(packet.distance_cm, 2);

  Serial.print("Water level cm : ");
  Serial.println(packet.water_level_cm, 2);

  Serial.print("Empty dist cm  : ");
  Serial.println(packet.empty_distance_cm, 2);

  Serial.print("Seq            : ");
  Serial.println(packet.seq);

  Serial.println("========================================");
}

void handleNodeConfigAckPacket(const uint8_t* data, int len, const uint8_t* srcMac) {
  if (len != sizeof(NodeConfigAckPacket)) {
    Serial.print("[ESP-NOW] Ignore ACK packet: wrong size ");
    Serial.println(len);
    return;
  }

  NodeConfigAckPacket ack;
  memcpy(&ack, data, sizeof(ack));

  if (ack.magic != SMART_AQUA_CTRL_MAGIC) {
    Serial.print("[ESP-NOW] Ignore ACK packet: wrong magic 0x");
    Serial.println(ack.magic, HEX);
    return;
  }

  if (ack.version != PACKET_VERSION) {
    Serial.print("[ESP-NOW] Ignore ACK packet: wrong version ");
    Serial.println(ack.version);
    return;
  }

  if (ack.packet_type != PACKET_TYPE_CONFIG_ACK) {
    Serial.print("[ESP-NOW] Ignore ACK packet: wrong type ");
    Serial.println(ack.packet_type);
    return;
  }

  if (strcmp(ack.node_code, wirelessHcsr04NodeCode) != 0) {
    Serial.print("[ESP-NOW] Ignore ACK packet: node_code=");
    Serial.println(ack.node_code);
    return;
  }

  uint32_t expectedHash = simpleKeyHashForAck(ack);

  if (ack.key_hash != expectedHash) {
    Serial.println("[ESP-NOW] Ignore ACK packet: bad key hash");
    return;
  }

  latestNodeAckSeq = ack.ack_seq;
  latestNodeAckConfigSeq = ack.config_seq;

  Serial.println();
  Serial.println("========== S3 NODE CONFIG ACK ==========");
  Serial.print("From MAC       : ");
  printMacAddress(srcMac);
  Serial.println();

  Serial.print("Node code      : ");
  Serial.println(ack.node_code);

  Serial.print("Module type    : ");
  Serial.println(ack.module_type);

  Serial.print("Config seq     : ");
  Serial.println(ack.config_seq);

  Serial.print("ACK seq        : ");
  Serial.println(ack.ack_seq);

  Serial.print("Status         : ");
  Serial.println(ack.status == 1 ? "OK" : "ERROR");

  Serial.print("Message        : ");
  Serial.println(ack.message);

  Serial.print("Node uptime ms : ");
  Serial.println(ack.uptime_ms);

  Serial.println("========================================");

  if (ack.status == 1) {
    publishConfigAck("applied", "wireless_node_config_applied", 1);
  } else {
    publishConfigAck("error", ack.message, 1);
  }
}

void onEspNowDataRecv(const esp_now_recv_info_t* recvInfo, const uint8_t* data, int len) {
  const uint8_t* srcMac = nullptr;

  if (recvInfo != nullptr) {
    srcMac = recvInfo->src_addr;
  }

  if (len == sizeof(WirelessWaterPacket)) {
    WirelessWaterPacket probe;
    memcpy(&probe, data, sizeof(probe));

    if (probe.magic == SMART_AQUA_MAGIC) {
      handleWirelessWaterPacket(data, len, srcMac);
      return;
    }
  }

  if (len == sizeof(NodeConfigAckPacket)) {
    NodeConfigAckPacket probe;
    memcpy(&probe, data, sizeof(probe));

    if (probe.magic == SMART_AQUA_CTRL_MAGIC && probe.packet_type == PACKET_TYPE_CONFIG_ACK) {
      handleNodeConfigAckPacket(data, len, srcMac);
      return;
    }
  }

  Serial.print("[ESP-NOW] Unknown packet ignored. Size=");
  Serial.println(len);
}

void onEspNowDataSent(const wifi_tx_info_t* txInfo, esp_now_send_status_t status) {
  Serial.print("[ESP-NOW] Send status: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "OK" : "FAILED");
}

void setupEspNowReceiver() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ESP-NOW] Skip init: WiFi not connected");
    return;
  }

  uint8_t currentChannel = WiFi.channel();

  if (espNowReady && espNowWifiChannel == currentChannel) {
    Serial.print("[ESP-NOW] Already ready on channel ");
    Serial.println(espNowWifiChannel);
    return;
  }

  if (espNowReady) {
    Serial.println("[ESP-NOW] Channel changed, reinit ESP-NOW");
    esp_now_deinit();
    espNowReady = false;
  }

  espNowWifiChannel = currentChannel;

  Serial.print("[ESP-NOW] Gateway WiFi channel: ");
  Serial.println(espNowWifiChannel);

  Serial.print("[ESP-NOW] Gateway STA MAC: ");
  Serial.println(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] Init FAILED");
    espNowReady = false;
    return;
  }

  esp_err_t sendCbResult = esp_now_register_send_cb(onEspNowDataSent);
  Serial.print("[ESP-NOW] Register send callback: ");
  Serial.println(sendCbResult == ESP_OK ? "OK" : "FAILED");

  esp_err_t recvCbResult = esp_now_register_recv_cb(onEspNowDataRecv);
  Serial.print("[ESP-NOW] Register recv callback: ");
  Serial.println(recvCbResult == ESP_OK ? "OK" : "FAILED");

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, broadcastAddress, 6);
  peerInfo.channel = espNowWifiChannel;
  peerInfo.encrypt = false;

  esp_err_t peerResult = esp_now_add_peer(&peerInfo);

  if (peerResult == ESP_OK) {
    Serial.println("[ESP-NOW] Broadcast peer added");
  } else if (peerResult == ESP_ERR_ESPNOW_EXIST) {
    Serial.println("[ESP-NOW] Broadcast peer already exists");
  } else {
    Serial.print("[ESP-NOW] Add broadcast peer failed: ");
    Serial.println(peerResult);
  }

  espNowReady = true;

  Serial.println("[ESP-NOW] Receiver ready");
  Serial.println("[ESP-NOW] IMPORTANT: S3 node ESPNOW_CHANNEL must match this WiFi channel");
}

bool hasRecentWirelessWaterData() {
  if (!wirelessHcsr04Enabled) return false;
  if (!latestWirelessDataValid) return false;
  if (latestWirelessPacketMs == 0) return false;

  unsigned long ageMs = millis() - latestWirelessPacketMs;
  return ageMs <= wirelessPacketTimeoutMs;
}

float getWirelessWaterPercent() {
  if (!hasRecentWirelessWaterData()) {
    return NAN;
  }

  float emptyCm = latestWirelessEmptyDistanceCm;

  if (emptyCm <= 0) {
    emptyCm = wirelessTankDepthCm;
  }

  if (emptyCm <= 0) {
    return NAN;
  }

  float percent = (latestWirelessWaterLevelCm / emptyCm) * 100.0;
  percent = constrain(percent, 0.0, 100.0);

  return percent;
}

// ===============================
// HARDWARE INIT
// ===============================
void initLight(int pin) {
  lightPin = pin;
  lightEnabled = true;

  pinMode(lightPin, OUTPUT);
  digitalWrite(lightPin, lightState ? HIGH : LOW);

  Serial.print("LIGHT module ready at GPIO ");
  Serial.println(lightPin);
}

void initServo(int pin) {
  servoPin = pin;
  servoEnabled = true;

  if (feederServo.attached()) {
    feederServo.detach();
  }

  feederServo.setPeriodHertz(50);
  feederServo.attach(servoPin, 500, 2400);
  feederServo.write(servoDefaultAngle);

  Serial.print("SERVO module ready at GPIO ");
  Serial.println(servoPin);
}

void initDS18B20(int pin) {
  ds18b20Pin = pin;
  ds18b20Enabled = true;

  if (ds18b20 != nullptr) {
    delete ds18b20;
    ds18b20 = nullptr;
  }

  if (oneWireBus != nullptr) {
    delete oneWireBus;
    oneWireBus = nullptr;
  }

  oneWireBus = new OneWire(ds18b20Pin);
  ds18b20 = new DallasTemperature(oneWireBus);
  ds18b20->begin();

  Serial.print("DS18B20 module ready at GPIO ");
  Serial.println(ds18b20Pin);

  Serial.print("DS18B20 sensors found: ");
  Serial.println(ds18b20->getDeviceCount());
}

void initHCSR04(int trigPin, int echoPin) {
  hcsr04TrigPin = trigPin;
  hcsr04EchoPin = echoPin;
  hcsr04Enabled = true;

  pinMode(hcsr04TrigPin, OUTPUT);
  pinMode(hcsr04EchoPin, INPUT);
  digitalWrite(hcsr04TrigPin, LOW);

  Serial.print("HC-SR04 wired module ready. TRIG GPIO ");
  Serial.print(hcsr04TrigPin);
  Serial.print(", ECHO GPIO ");
  Serial.println(hcsr04EchoPin);
}

void initDefaultHardware() {
  initLight(DEFAULT_LIGHT_PIN);
  initServo(DEFAULT_SERVO_PIN);
  initDS18B20(DEFAULT_DS18B20_PIN);
}

// ===============================
// ACTUATOR HELPERS
// ===============================
void applyLight(bool state) {
  lightState = state;

  if (!lightEnabled) {
    Serial.println("LIGHT ignored: module disabled");
    return;
  }

  digitalWrite(lightPin, lightState ? HIGH : LOW);

  Serial.print("LIGHT -> ");
  Serial.println(lightState ? "ON" : "OFF");
}

void applyPump(bool state) {
  pumpState = state;

  Serial.print("PUMP -> ");
  Serial.println(pumpState ? "ON" : "OFF");
}

void handleFeedCommand(int angle) {
  if (!servoEnabled) {
    Serial.println("FEED ignored: servo module disabled");
    return;
  }

  int safeAngle = constrain(angle, 0, 180);

  Serial.print("FEED -> servo ");
  Serial.print(safeAngle);
  Serial.println(" deg");

  feederServo.write(safeAngle);
  delay(servoFeedDurationMs);
  feederServo.write(servoDefaultAngle);

  Serial.print("FEED -> servo returned to ");
  Serial.print(servoDefaultAngle);
  Serial.println(" deg");
}

// ===============================
// SENSOR READERS
// ===============================
float readWaterTemperature() {
  if (!ds18b20Enabled || ds18b20 == nullptr) {
    return NAN;
  }

  ds18b20->requestTemperatures();
  delay(750);

  float tempC = ds18b20->getTempCByIndex(0);

  Serial.print("DS18B20 raw temp: ");
  Serial.println(tempC);

  if (tempC == DEVICE_DISCONNECTED_C || tempC < -50 || tempC > 125) {
    Serial.println("DS18B20 read failed or disconnected");
    return NAN;
  }

  return tempC;
}

float readHCSR04DistanceCm() {
  if (!hcsr04Enabled || hcsr04TrigPin < 0 || hcsr04EchoPin < 0) {
    return NAN;
  }

  digitalWrite(hcsr04TrigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(hcsr04TrigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(hcsr04TrigPin, LOW);

  long duration = pulseIn(hcsr04EchoPin, HIGH, 30000);

  if (duration == 0) {
    Serial.println("HC-SR04 wired read failed: no echo");
    return NAN;
  }

  float distanceCm = duration * 0.0343 / 2.0;

  Serial.print("HC-SR04 wired distance: ");
  Serial.print(distanceCm);
  Serial.println(" cm");

  return distanceCm;
}

float calculateWaterLevelPercent(float distanceCm) {
  if (isnan(distanceCm) || hcsr04TankDepthCm <= 0) {
    return NAN;
  }

  float effectiveDistance = distanceCm - hcsr04MountOffsetCm;

  if (effectiveDistance < 0) {
    effectiveDistance = 0;
  }

  float level = ((hcsr04TankDepthCm - effectiveDistance) / hcsr04TankDepthCm) * 100.0;
  level = constrain(level, 0.0, 100.0);

  return level;
}

// ===============================
// CONFIG UPDATE
// ===============================
void applyConfigUpdate(const String& message) {
  Serial.println();
  Serial.println("===== CONFIG UPDATE RECEIVED =====");

  DynamicJsonDocument doc(8192);
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print("Config JSON parse failed: ");
    Serial.println(error.c_str());
    publishConfigAck("error", "json_parse_failed", 0);
    return;
  }

  const char* type = doc["type"] | "";

  if (strcmp(type, "config_update") != 0) {
    Serial.print("Ignore config type: ");
    Serial.println(type);
    publishConfigAck("ignored", "not_config_update", 0);
    return;
  }

  int incomingDeviceId = doc["device_id"] | -1;

  if (incomingDeviceId != DEVICE_ID) {
    Serial.print("Ignore config for device_id: ");
    Serial.println(incomingDeviceId);
    publishConfigAck("ignored", "wrong_device_id", 0);
    return;
  }

  JsonArray modules = doc["modules"].as<JsonArray>();
  int moduleCount = modules.size();

  Serial.print("Config modules count: ");
  Serial.println(moduleCount);

  if (moduleCount == 0) {
    publishConfigAck("ignored", "empty_modules", 0);
    return;
  }

  bool nextLightEnabled = false;
  bool nextServoEnabled = false;
  bool nextDs18b20Enabled = false;
  bool nextHcsr04Enabled = false;
  bool nextWirelessHcsr04Enabled = false;

  int nextLightPin = lightPin;
  int nextServoPin = servoPin;
  int nextDs18b20Pin = ds18b20Pin;
  int nextTrigPin = hcsr04TrigPin;
  int nextEchoPin = hcsr04EchoPin;

  int nextServoDefaultAngle = servoDefaultAngle;
  int nextServoFeedAngle = servoFeedAngle;
  int nextServoFeedDurationMs = servoFeedDurationMs;

  float nextTankDepthCm = hcsr04TankDepthCm;
  float nextMountOffsetCm = hcsr04MountOffsetCm;
  unsigned long nextPublishIntervalMs = publishIntervalMs;

  char nextWirelessNodeCode[24];
  char nextWirelessModuleType[16];

  copyCString(nextWirelessNodeCode, sizeof(nextWirelessNodeCode), wirelessHcsr04NodeCode, "S3_WATER_01");
  copyCString(nextWirelessModuleType, sizeof(nextWirelessModuleType), wirelessHcsr04ModuleType, "hc_sr04");

  int nextWirelessTrigPin = wirelessTrigPin;
  int nextWirelessEchoPin = wirelessEchoPin;
  float nextWirelessTankDepthCm = wirelessTankDepthCm;
  float nextWirelessMountOffsetCm = wirelessMountOffsetCm;
  uint32_t nextWirelessReadIntervalMs = wirelessReadIntervalMs;

  for (JsonObject module : modules) {
    bool enabled = module["enabled"] | false;
    const char* connectionType = module["connection_type"] | "";
    const char* moduleType = module["module_type"] | "";
    const char* moduleCode = module["module_code"] | "";

    Serial.println();
    Serial.print("Module: ");
    Serial.print(moduleCode);
    Serial.print(" | type=");
    Serial.print(moduleType);
    Serial.print(" | connection=");
    Serial.print(connectionType);
    Serial.print(" | enabled=");
    Serial.println(enabled ? "true" : "false");

    if (!enabled) {
      continue;
    }

    JsonObject config = module["config"].as<JsonObject>();

    if (strcmp(connectionType, "wireless") == 0) {
      const char* protocol = module["protocol"] | config["protocol"] | "";
      const char* nodeType = module["node_type"] | config["node_type"] | "";
      const char* nodeCode = module["node_code"] | config["node_code"] | "";

      Serial.print("Wireless protocol=");
      Serial.print(protocol);
      Serial.print(" node_type=");
      Serial.print(nodeType);
      Serial.print(" node_code=");
      Serial.println(nodeCode);

      if (strcmp(moduleType, "hc_sr04") == 0 && strcmp(protocol, "esp_now") == 0) {
        nextWirelessHcsr04Enabled = true;

        copyCString(nextWirelessNodeCode, sizeof(nextWirelessNodeCode), nodeCode, "S3_WATER_01");
        copyCString(nextWirelessModuleType, sizeof(nextWirelessModuleType), moduleType, "hc_sr04");

        if (config["trig_pin"].is<int>()) {
          nextWirelessTrigPin = config["trig_pin"];
        }

        if (config["echo_pin"].is<int>()) {
          nextWirelessEchoPin = config["echo_pin"];
        }

        if (config["tank_depth_cm"].is<float>()) {
          nextWirelessTankDepthCm = config["tank_depth_cm"];
        }

        if (config["mount_offset_cm"].is<float>()) {
          nextWirelessMountOffsetCm = config["mount_offset_cm"];
        }

        if (config["read_interval_ms"].is<unsigned long>()) {
          nextWirelessReadIntervalMs = config["read_interval_ms"];
          nextPublishIntervalMs = config["read_interval_ms"];
        }

        Serial.println("Wireless HC-SR04 enabled for ESP-NOW");
      }

      continue;
    }

    if (strcmp(connectionType, "gpio") != 0) {
      Serial.println("Skip module: unsupported connection_type");
      continue;
    }

    int p1 = module["pin"] | -1;
    int p2 = module["pin2"] | -1;

    if (strcmp(moduleType, "ds18b20") == 0 && p1 >= 0) {
      nextDs18b20Enabled = true;
      nextDs18b20Pin = p1;

      if (config["read_interval_ms"].is<unsigned long>()) {
        nextPublishIntervalMs = config["read_interval_ms"];
      }
    }

    if (strcmp(moduleType, "light") == 0 && p1 >= 0) {
      nextLightEnabled = true;
      nextLightPin = p1;
    }

    if (strcmp(moduleType, "servo_feeder") == 0 && p1 >= 0) {
      nextServoEnabled = true;
      nextServoPin = p1;

      if (config["default_angle"].is<int>()) {
        nextServoDefaultAngle = config["default_angle"];
      }

      if (config["feed_angle"].is<int>()) {
        nextServoFeedAngle = config["feed_angle"];
      }

      if (config["duration_ms"].is<int>()) {
        nextServoFeedDurationMs = config["duration_ms"];
      }
    }

    if (strcmp(moduleType, "hc_sr04") == 0 && p1 >= 0 && p2 >= 0) {
      nextHcsr04Enabled = true;
      nextTrigPin = p1;
      nextEchoPin = p2;

      if (config["tank_depth_cm"].is<float>()) {
        nextTankDepthCm = config["tank_depth_cm"];
      }

      if (config["mount_offset_cm"].is<float>()) {
        nextMountOffsetCm = config["mount_offset_cm"];
      }

      if (config["read_interval_ms"].is<unsigned long>()) {
        nextPublishIntervalMs = config["read_interval_ms"];
      }
    }
  }

  // Apply DS18B20
  if (nextDs18b20Enabled) {
    if (!ds18b20Enabled || nextDs18b20Pin != ds18b20Pin) {
      initDS18B20(nextDs18b20Pin);
    }
    ds18b20Enabled = true;
  } else {
    ds18b20Enabled = false;
    Serial.println("DS18B20 module disabled by config");
  }

  // Apply light
  if (nextLightEnabled) {
    if (!lightEnabled || nextLightPin != lightPin) {
      initLight(nextLightPin);
    }
    lightEnabled = true;
    applyLight(lightState);
  } else {
    if (lightEnabled) {
      digitalWrite(lightPin, LOW);
    }
    lightEnabled = false;
    Serial.println("LIGHT module disabled by config");
  }

  // Apply servo
  if (nextServoEnabled) {
    servoDefaultAngle = constrain(nextServoDefaultAngle, 0, 180);
    servoFeedAngle = constrain(nextServoFeedAngle, 0, 180);
    servoFeedDurationMs = constrain(nextServoFeedDurationMs, 100, 5000);

    if (!servoEnabled || nextServoPin != servoPin) {
      initServo(nextServoPin);
    }

    servoEnabled = true;
    feederServo.write(servoDefaultAngle);
  } else {
    if (servoEnabled && feederServo.attached()) {
      feederServo.detach();
    }
    servoEnabled = false;
    Serial.println("SERVO module disabled by config");
  }

  // Apply wired HC-SR04
  if (nextHcsr04Enabled) {
    hcsr04TankDepthCm = nextTankDepthCm;
    hcsr04MountOffsetCm = nextMountOffsetCm;

    if (!hcsr04Enabled || nextTrigPin != hcsr04TrigPin || nextEchoPin != hcsr04EchoPin) {
      initHCSR04(nextTrigPin, nextEchoPin);
    }

    hcsr04Enabled = true;

    Serial.print("Wired HC-SR04 tank_depth_cm: ");
    Serial.println(hcsr04TankDepthCm);
  } else {
    hcsr04Enabled = false;
    Serial.println("Wired HC-SR04 module disabled/not configured");
  }

  // Apply wireless HC-SR04
  wirelessHcsr04Enabled = nextWirelessHcsr04Enabled;

  if (wirelessHcsr04Enabled) {
    copyCString(wirelessHcsr04NodeCode, sizeof(wirelessHcsr04NodeCode), nextWirelessNodeCode, "S3_WATER_01");
    copyCString(wirelessHcsr04ModuleType, sizeof(wirelessHcsr04ModuleType), nextWirelessModuleType, "hc_sr04");

    wirelessTrigPin = nextWirelessTrigPin;
    wirelessEchoPin = nextWirelessEchoPin;
    wirelessTankDepthCm = nextWirelessTankDepthCm;
    wirelessMountOffsetCm = nextWirelessMountOffsetCm;
    wirelessReadIntervalMs = constrain(nextWirelessReadIntervalMs, 1000UL, 60000UL);

    Serial.print("Wireless HC-SR04 enabled. node_code=");
    Serial.println(wirelessHcsr04NodeCode);

    Serial.print("Wireless config TRIG/ECHO/depth/interval: ");
    Serial.print(wirelessTrigPin);
    Serial.print(" / ");
    Serial.print(wirelessEchoPin);
    Serial.print(" / ");
    Serial.print(wirelessTankDepthCm);
    Serial.print(" / ");
    Serial.println(wirelessReadIntervalMs);

    sendWirelessConfigToNode();
  } else {
    Serial.println("Wireless HC-SR04 disabled/not configured");
  }

  publishIntervalMs = constrain(nextPublishIntervalMs, 2000UL, 60000UL);

  Serial.println();
  Serial.println("===== CONFIG APPLIED =====");
  Serial.print("DS18B20 enabled: ");
  Serial.print(ds18b20Enabled);
  Serial.print(" GPIO ");
  Serial.println(ds18b20Pin);

  Serial.print("LIGHT enabled: ");
  Serial.print(lightEnabled);
  Serial.print(" GPIO ");
  Serial.println(lightPin);

  Serial.print("SERVO enabled: ");
  Serial.print(servoEnabled);
  Serial.print(" GPIO ");
  Serial.println(servoPin);

  Serial.print("Wired HC-SR04 enabled: ");
  Serial.print(hcsr04Enabled);
  Serial.print(" TRIG ");
  Serial.print(hcsr04TrigPin);
  Serial.print(" ECHO ");
  Serial.println(hcsr04EchoPin);

  Serial.print("Wireless HC-SR04 enabled: ");
  Serial.print(wirelessHcsr04Enabled);
  Serial.print(" node_code ");
  Serial.println(wirelessHcsr04NodeCode);

  Serial.print("Publish interval ms: ");
  Serial.println(publishIntervalMs);

  publishConfigAck("applied", "gateway_config_applied", moduleCount);
}

// ===============================
// MQTT CALLBACK
// ===============================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.println();
  Serial.print("MQTT message arrived topic: ");
  Serial.println(topic);

  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("Payload: ");
  Serial.println(message);

  String incomingTopic = String(topic);

  if (incomingTopic == configTopic()) {
    applyConfigUpdate(message);
    return;
  }

  if (incomingTopic != controlTopic()) {
    Serial.println("Ignore MQTT message: unknown topic");
    return;
  }

  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print("JSON parse failed: ");
    Serial.println(error.c_str());
    return;
  }

  int incomingDeviceId = doc["device_id"] | -1;

  if (incomingDeviceId != DEVICE_ID) {
    Serial.print("Ignore command for device_id: ");
    Serial.println(incomingDeviceId);
    return;
  }

  const char* incomingToken = doc["device_token"] | "";

  if (strcmp(incomingToken, DEVICE_MQTT_TOKEN) != 0) {
    Serial.println("Ignore command: invalid device_token");
    return;
  }

  bool isFeedCommand = doc["feed"] | false;

  if (isFeedCommand) {
  handleFeedCommand(servoFeedAngle);
}

  if (doc.containsKey("light")) {
    bool nextLight = doc["light"];
    applyLight(nextLight);
  }

  if (doc.containsKey("pump")) {
    bool nextPump = doc["pump"];
    applyPump(nextPump);
  }

  if (doc.containsKey("oxygen")) {
    oxygenState = doc["oxygen"];
    Serial.print("OXYGEN -> ");
    Serial.println(oxygenState ? "ON" : "OFF");
  }

  if (doc.containsKey("auto_mode")) {
    autoModeState = doc["auto_mode"];
    Serial.print("AUTO MODE -> ");
    Serial.println(autoModeState ? "ON" : "OFF");
  }

  Serial.println("Control command handled OK");
}

// ===============================
// WIFI / MQTT CONNECT
// ===============================
void connectWiFi() {
  Serial.println();
  Serial.print("Connecting WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.setHostname("ESP32_AQ_641931");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");

  Serial.print("Connected SSID: ");
  Serial.println(WiFi.SSID());

  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  Serial.print("Gateway: ");
  Serial.println(WiFi.gatewayIP());

  Serial.print("RSSI: ");
  Serial.println(WiFi.RSSI());

  Serial.print("WiFi channel: ");
  Serial.println(WiFi.channel());
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.println();
    Serial.print("Connecting MQTT: ");
    Serial.println(MQTT_HOST);

    String clientId =
      "ESP32_SMART_AQ_" + String(DEVICE_ID) + "_" + String(random(1000, 9999));

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("MQTT connected");

      String cTopic = controlTopic();
      mqttClient.subscribe(cTopic.c_str(), 1);

      Serial.print("Subscribed control topic: ");
      Serial.println(cTopic);

      String cfgTopic = configTopic();
      mqttClient.subscribe(cfgTopic.c_str(), 1);

      Serial.print("Subscribed config topic: ");
      Serial.println(cfgTopic);
    } else {
      Serial.print("MQTT failed, rc=");
      Serial.println(mqttClient.state());
      Serial.println("Retry in 3 seconds...");
      delay(3000);
    }
  }
}

// ===============================
// PUBLISH SENSOR
// ===============================
void publishSensorData() {
  float temperature = readWaterTemperature();

  float ph = random(65, 80) / 10.0;
  int battery = random(70, 100);
  int rssi = WiFi.RSSI();

  float waterLevel = NAN;
  float distanceCm = NAN;
  const char* waterLevelSource = "demo_random";

  bool usingWirelessWater = false;
  bool usingWiredWater = false;

  if (hasRecentWirelessWaterData()) {
    waterLevel = getWirelessWaterPercent();
    distanceCm = latestWirelessDistanceCm;
    waterLevelSource = "esp_now_hc_sr04";
    usingWirelessWater = true;
  } else if (hcsr04Enabled) {
    distanceCm = readHCSR04DistanceCm();
    waterLevel = calculateWaterLevelPercent(distanceCm);
    waterLevelSource = "wired_hc_sr04";
    usingWiredWater = !isnan(waterLevel);
  }

  if (isnan(waterLevel)) {
    waterLevel = random(60, 95);
    waterLevelSource = "demo_random";
  }

  StaticJsonDocument<1024> doc;

  doc["device_id"] = DEVICE_ID;
  doc["device_token"] = DEVICE_MQTT_TOKEN;

  if (!isnan(temperature)) {
    doc["temperature"] = round(temperature * 100.0) / 100.0;
  }

  doc["ph"] = round(ph * 10.0) / 10.0;
  doc["water_level"] = round(waterLevel);
  doc["water_level_source"] = waterLevelSource;
  doc["battery"] = battery;
  doc["rssi"] = rssi;

  if (!isnan(distanceCm)) {
    doc["distance_cm"] = round(distanceCm * 10.0) / 10.0;
  }

  if (usingWirelessWater) {
    doc["wireless_node_code"] = wirelessHcsr04NodeCode;
    doc["module_type"] = "hc_sr04";
    doc["water_distance_cm"] = round(latestWirelessDistanceCm * 10.0) / 10.0;
    doc["water_level_cm"] = round(latestWirelessWaterLevelCm * 10.0) / 10.0;
    doc["water_empty_distance_cm"] = round(latestWirelessEmptyDistanceCm * 10.0) / 10.0;
    doc["water_wireless_seq"] = latestWirelessSeq;
    doc["water_wireless_age_ms"] = millis() - latestWirelessPacketMs;
    doc["water_wireless_node_uptime_ms"] = latestWirelessNodeUptimeMs;
  }

  if (usingWiredWater) {
    doc["water_distance_cm"] = round(distanceCm * 10.0) / 10.0;
  }

  String payload;
  serializeJson(doc, payload);

  String topic = sensorTopic();

  Serial.println();
  Serial.print("Publish topic: ");
  Serial.println(topic);
  Serial.print("Payload: ");
  Serial.println(payload);

  bool ok = mqttClient.publish(topic.c_str(), payload.c_str());

  if (ok) {
    Serial.println("Publish OK");
  } else {
    Serial.println("Publish FAILED");
  }
}

// ===============================
// SETUP / LOOP
// ===============================
void setup() {
  Serial.begin(115200);
  delay(1000);

  randomSeed(analogRead(0));

  initDefaultHardware();

  connectWiFi();

  setupEspNowReceiver();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(30);
  mqttClient.setBufferSize(8192);

  connectMQTT();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected");
    connectWiFi();
    setupEspNowReceiver();
  }

  if (!espNowReady) {
    setupEspNowReceiver();
  }

  if (!mqttClient.connected()) {
    connectMQTT();
  }

  mqttClient.loop();

  if (millis() - lastPublish >= publishIntervalMs) {
    lastPublish = millis();
    publishSensorData();
  }
}