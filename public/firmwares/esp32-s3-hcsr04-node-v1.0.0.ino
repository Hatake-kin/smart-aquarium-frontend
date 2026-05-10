#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

// =======================================================
// Smart Aquarium IoT - ESP32-S3 Mini Generic Wireless Node
// Module hiện tại: HC-SR04 water level
//
// Board Arduino IDE: ESP32S3 Dev Module
//
// Chức năng:
// - Đọc HC-SR04
// - Gửi sensor packet ESP-NOW về ESP32 gateway
// - Nhận config packet ESP-NOW từ gateway
// - Apply runtime config: trig_pin, echo_pin, tank_depth_cm, read_interval_ms
// - Gửi config ACK về gateway
//
// Lưu ý:
// - ESP-NOW channel phải trùng WiFi channel của ESP32 gateway.
// - Hiện gateway đang WiFi channel 13 thì để DEFAULT_ESPNOW_CHANNEL = 13.
// =======================================================

// ================== DEFAULT CONFIG ==================

#define DEFAULT_NODE_CODE "S3_WATER_01"
#define DEFAULT_MODULE_TYPE "hc_sr04"

// Chân mặc định trên ESP32-S3 mini bạn đang test chạy OK
#define DEFAULT_TRIG_PIN 6
#define DEFAULT_ECHO_PIN 7

// Phải trùng channel WiFi của ESP32 gateway
#define DEFAULT_ESPNOW_CHANNEL 13

#define DEFAULT_SEND_INTERVAL_MS 5000
#define DEFAULT_TANK_EMPTY_DISTANCE_CM 30.0f
#define DEFAULT_MOUNT_OFFSET_CM 0.0f

#define SOUND_SPEED_CM_PER_US 0.0343f
#define MIN_VALID_DISTANCE_CM 2.0f
#define MAX_VALID_DISTANCE_CM 400.0f

// Shared key đơn giản để xác thực config packet.
// Sau này nếu muốn bảo mật hơn thì đổi key này ở cả gateway và node.
// Không gửi key này lên chat/log.
#define ESPNOW_SHARED_KEY "CHANGE_ME_NODE_SHARED_KEY"

// Magic cũ giữ nguyên để gateway hiện tại vẫn nhận sensor packet.
const uint32_t SMART_AQUA_MAGIC = 0xA0A02026;

// Magic mới cho packet config/ack.
const uint32_t SMART_AQUA_CTRL_MAGIC = 0xA0A0C0DE;

const uint8_t PACKET_VERSION = 1;
const uint8_t PACKET_TYPE_SENSOR = 1;
const uint8_t PACKET_TYPE_CONFIG = 2;
const uint8_t PACKET_TYPE_CONFIG_ACK = 3;

// Broadcast peer, gateway hiện tại nhận broadcast được.
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// ================== RUNTIME CONFIG ==================

char nodeCode[24] = DEFAULT_NODE_CODE;
char moduleType[16] = DEFAULT_MODULE_TYPE;

int trigPin = DEFAULT_TRIG_PIN;
int echoPin = DEFAULT_ECHO_PIN;

float tankEmptyDistanceCm = DEFAULT_TANK_EMPTY_DISTANCE_CM;
float mountOffsetCm = DEFAULT_MOUNT_OFFSET_CM;

uint32_t sendIntervalMs = DEFAULT_SEND_INTERVAL_MS;
uint8_t espnowChannel = DEFAULT_ESPNOW_CHANNEL;

uint32_t sensorSeq = 0;
uint32_t configAckSeq = 0;
uint32_t lastAcceptedConfigSeq = 0;

unsigned long lastSendMs = 0;

// ================== PACKET STRUCTS ==================

// Sensor packet giữ đúng format cũ để gateway hiện tại parse được.
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
} WaterLevelPacket;

// Config packet mới, gateway sẽ gửi xuống S3 mini ở bước sau.
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

// ACK packet mới, S3 mini gửi về gateway sau khi nhận config.
typedef struct __attribute__((packed)) {
  uint32_t magic;
  uint8_t version;
  uint8_t packet_type;

  char node_code[24];
  char module_type[16];

  uint32_t config_seq;
  uint32_t ack_seq;

  uint8_t status; // 1 OK, 0 ERROR
  char message[48];

  uint32_t uptime_ms;
  uint32_t key_hash;
} NodeConfigAckPacket;

WaterLevelPacket sensorPacket;
NodeConfigAckPacket ackPacket;

// ================== HASH ĐƠN GIẢN ==================
// FNV-1a 32-bit. Không phải crypto mạnh như HMAC-SHA256,
// nhưng đủ để demo lớp xác thực packet cơ bản trong đồ án.

uint32_t fnv1aUpdate(uint32_t hash, const uint8_t *data, size_t len) {
  for (size_t i = 0; i < len; i++) {
    hash ^= data[i];
    hash *= 16777619UL;
  }
  return hash;
}

uint32_t simpleKeyHashForConfig(const NodeConfigPacket &pkt) {
  uint32_t hash = 2166136261UL;

  const char *key = ESPNOW_SHARED_KEY;
  hash = fnv1aUpdate(hash, (const uint8_t *)key, strlen(key));

  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.magic, sizeof(pkt.magic));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.version, sizeof(pkt.version));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.packet_type, sizeof(pkt.packet_type));
  hash = fnv1aUpdate(hash, (const uint8_t *)pkt.target_node_code, sizeof(pkt.target_node_code));
  hash = fnv1aUpdate(hash, (const uint8_t *)pkt.module_type, sizeof(pkt.module_type));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.trig_pin, sizeof(pkt.trig_pin));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.echo_pin, sizeof(pkt.echo_pin));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.tank_empty_distance_cm, sizeof(pkt.tank_empty_distance_cm));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.mount_offset_cm, sizeof(pkt.mount_offset_cm));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.read_interval_ms, sizeof(pkt.read_interval_ms));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.seq, sizeof(pkt.seq));

  return hash;
}

uint32_t simpleKeyHashForAck(const NodeConfigAckPacket &pkt) {
  uint32_t hash = 2166136261UL;

  const char *key = ESPNOW_SHARED_KEY;
  hash = fnv1aUpdate(hash, (const uint8_t *)key, strlen(key));

  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.magic, sizeof(pkt.magic));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.version, sizeof(pkt.version));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.packet_type, sizeof(pkt.packet_type));
  hash = fnv1aUpdate(hash, (const uint8_t *)pkt.node_code, sizeof(pkt.node_code));
  hash = fnv1aUpdate(hash, (const uint8_t *)pkt.module_type, sizeof(pkt.module_type));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.config_seq, sizeof(pkt.config_seq));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.ack_seq, sizeof(pkt.ack_seq));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.status, sizeof(pkt.status));
  hash = fnv1aUpdate(hash, (const uint8_t *)pkt.message, sizeof(pkt.message));
  hash = fnv1aUpdate(hash, (const uint8_t *)&pkt.uptime_ms, sizeof(pkt.uptime_ms));

  return hash;
}

// ================== UTILS ==================

void safeCopy(char *dest, size_t destSize, const char *src) {
  if (destSize == 0) return;

  if (src == nullptr) {
    dest[0] = '\0';
    return;
  }

  snprintf(dest, destSize, "%s", src);
}

void printMacAddress(const uint8_t *mac) {
  if (mac == nullptr) return;

  for (int i = 0; i < 6; i++) {
    if (mac[i] < 16) Serial.print("0");
    Serial.print(mac[i], HEX);
    if (i < 5) Serial.print(":");
  }
}

bool isValidGpio(int pin) {
  // Với ESP32-S3 mini của bạn, mình cho phép vùng GPIO rộng,
  // nhưng loại các giá trị âm và GPIO quá lớn.
  // Sau này có thể siết theo board pinout thật.
  if (pin < 0) return false;
  if (pin > 48) return false;

  // Tránh một số chân USB/JTAG/boot nhạy cảm nếu không chắc.
  // Nếu board của bạn dùng được thì có thể mở lại sau.
  if (pin == 19 || pin == 20) return false; // USB D-/D+ trên nhiều board S3

  return true;
}

// ================== HC-SR04 ==================

void setupHcsr04Pins() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  digitalWrite(trigPin, LOW);

  Serial.println();
  Serial.println("========== HC-SR04 CONFIG ==========");
  Serial.print("Node code            : ");
  Serial.println(nodeCode);
  Serial.print("Module type          : ");
  Serial.println(moduleType);
  Serial.print("TRIG GPIO            : ");
  Serial.println(trigPin);
  Serial.print("ECHO GPIO            : ");
  Serial.println(echoPin);
  Serial.print("Tank empty distance  : ");
  Serial.println(tankEmptyDistanceCm, 2);
  Serial.print("Mount offset         : ");
  Serial.println(mountOffsetCm, 2);
  Serial.print("Read interval ms     : ");
  Serial.println(sendIntervalMs);
  Serial.println("====================================");
}

float readDistanceCmOnce() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(5);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long duration = pulseIn(echoPin, HIGH, 30000UL);

  if (duration == 0) {
    return NAN;
  }

  float distanceCm = duration * SOUND_SPEED_CM_PER_US / 2.0f;

  if (distanceCm < MIN_VALID_DISTANCE_CM || distanceCm > MAX_VALID_DISTANCE_CM) {
    return NAN;
  }

  return distanceCm;
}

float readDistanceCmFiltered() {
  const int sampleCount = 5;
  float values[sampleCount];
  int validCount = 0;

  for (int i = 0; i < sampleCount; i++) {
    float d = readDistanceCmOnce();

    if (!isnan(d)) {
      values[validCount] = d;
      validCount++;
    }

    delay(70);
  }

  if (validCount == 0) {
    return NAN;
  }

  for (int i = 0; i < validCount - 1; i++) {
    for (int j = i + 1; j < validCount; j++) {
      if (values[j] < values[i]) {
        float temp = values[i];
        values[i] = values[j];
        values[j] = temp;
      }
    }
  }

  return values[validCount / 2];
}

float calcWaterLevelCm(float distanceCm) {
  float effectiveDistance = distanceCm - mountOffsetCm;

  if (effectiveDistance < 0) {
    effectiveDistance = 0;
  }

  float level = tankEmptyDistanceCm - effectiveDistance;

  if (level < 0) {
    level = 0;
  }

  if (level > tankEmptyDistanceCm) {
    level = tankEmptyDistanceCm;
  }

  return level;
}

// ================== CONFIG APPLY ==================

bool applyNodeConfig(const NodeConfigPacket &cfg, char *messageOut, size_t messageOutSize) {
  if (cfg.magic != SMART_AQUA_CTRL_MAGIC) {
    safeCopy(messageOut, messageOutSize, "bad_magic");
    return false;
  }

  if (cfg.version != PACKET_VERSION) {
    safeCopy(messageOut, messageOutSize, "bad_version");
    return false;
  }

  if (cfg.packet_type != PACKET_TYPE_CONFIG) {
    safeCopy(messageOut, messageOutSize, "bad_packet_type");
    return false;
  }

  if (strcmp(cfg.target_node_code, nodeCode) != 0) {
    safeCopy(messageOut, messageOutSize, "wrong_node_code");
    return false;
  }

  if (strcmp(cfg.module_type, "hc_sr04") != 0) {
    safeCopy(messageOut, messageOutSize, "wrong_module_type");
    return false;
  }

  uint32_t expectedHash = simpleKeyHashForConfig(cfg);

  if (cfg.key_hash != expectedHash) {
    safeCopy(messageOut, messageOutSize, "bad_key_hash");
    return false;
  }

  if (cfg.seq <= lastAcceptedConfigSeq) {
    safeCopy(messageOut, messageOutSize, "old_seq_ignored");
    return false;
  }

  if (!isValidGpio(cfg.trig_pin) || !isValidGpio(cfg.echo_pin)) {
    safeCopy(messageOut, messageOutSize, "invalid_gpio");
    return false;
  }

  if (cfg.trig_pin == cfg.echo_pin) {
    safeCopy(messageOut, messageOutSize, "same_trig_echo");
    return false;
  }

  if (cfg.tank_empty_distance_cm <= 0 || cfg.tank_empty_distance_cm > 500) {
    safeCopy(messageOut, messageOutSize, "invalid_tank_depth");
    return false;
  }

  if (cfg.read_interval_ms < 1000 || cfg.read_interval_ms > 60000) {
    safeCopy(messageOut, messageOutSize, "invalid_interval");
    return false;
  }

  trigPin = cfg.trig_pin;
  echoPin = cfg.echo_pin;
  tankEmptyDistanceCm = cfg.tank_empty_distance_cm;
  mountOffsetCm = cfg.mount_offset_cm;
  sendIntervalMs = cfg.read_interval_ms;

  lastAcceptedConfigSeq = cfg.seq;

  setupHcsr04Pins();

  safeCopy(messageOut, messageOutSize, "config_applied");
  return true;
}

// ================== ESP-NOW SEND ==================

void sendConfigAck(uint32_t configSeq, bool ok, const char *message) {
  memset(&ackPacket, 0, sizeof(ackPacket));

  ackPacket.magic = SMART_AQUA_CTRL_MAGIC;
  ackPacket.version = PACKET_VERSION;
  ackPacket.packet_type = PACKET_TYPE_CONFIG_ACK;

  safeCopy(ackPacket.node_code, sizeof(ackPacket.node_code), nodeCode);
  safeCopy(ackPacket.module_type, sizeof(ackPacket.module_type), moduleType);

  ackPacket.config_seq = configSeq;
  ackPacket.ack_seq = ++configAckSeq;
  ackPacket.status = ok ? 1 : 0;
  safeCopy(ackPacket.message, sizeof(ackPacket.message), message);
  ackPacket.uptime_ms = millis();

  ackPacket.key_hash = simpleKeyHashForAck(ackPacket);

  esp_err_t result = esp_now_send(broadcastAddress, (uint8_t *)&ackPacket, sizeof(ackPacket));

  Serial.print("[ESP-NOW] Config ACK send result: ");
  Serial.println(result == ESP_OK ? "QUEUED" : "FAILED");
}

void sendSensorPacket() {
  float distance = readDistanceCmFiltered();

  memset(&sensorPacket, 0, sizeof(sensorPacket));

  sensorPacket.magic = SMART_AQUA_MAGIC;
  sensorPacket.version = PACKET_VERSION;

  safeCopy(sensorPacket.node_code, sizeof(sensorPacket.node_code), nodeCode);
  safeCopy(sensorPacket.module_type, sizeof(sensorPacket.module_type), moduleType);

  sensorPacket.seq = ++sensorSeq;
  sensorPacket.uptime_ms = millis();
  sensorPacket.empty_distance_cm = tankEmptyDistanceCm;

  if (isnan(distance)) {
    sensorPacket.status = 0;
    sensorPacket.distance_cm = -1.0f;
    sensorPacket.water_level_cm = -1.0f;

    Serial.println("========== HC-SR04 ==========");
    Serial.println("[HC-SR04] Read FAILED");
  } else {
    sensorPacket.status = 1;
    sensorPacket.distance_cm = distance;
    sensorPacket.water_level_cm = calcWaterLevelCm(distance);

    Serial.println("========== HC-SR04 ==========");
    Serial.print("Node code       : ");
    Serial.println(sensorPacket.node_code);
    Serial.print("Module type     : ");
    Serial.println(sensorPacket.module_type);
    Serial.print("Distance cm     : ");
    Serial.println(sensorPacket.distance_cm, 2);
    Serial.print("Water level cm  : ");
    Serial.println(sensorPacket.water_level_cm, 2);
    Serial.print("Seq             : ");
    Serial.println(sensorPacket.seq);
  }

  esp_err_t result = esp_now_send(broadcastAddress, (uint8_t *)&sensorPacket, sizeof(sensorPacket));

  if (result == ESP_OK) {
    Serial.println("[ESP-NOW] Sensor packet queued");
  } else {
    Serial.print("[ESP-NOW] Sensor send error code: ");
    Serial.println(result);
  }
}

// ================== ESP-NOW CALLBACKS ==================

void onDataSent(const wifi_tx_info_t *txInfo, esp_now_send_status_t status) {
  Serial.print("[ESP-NOW] Send status: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "OK" : "FAILED");
}

void onDataRecv(const esp_now_recv_info_t *recvInfo, const uint8_t *data, int len) {
  const uint8_t *srcMac = nullptr;

  if (recvInfo != nullptr) {
    srcMac = recvInfo->src_addr;
  }

  Serial.println();
  Serial.println("========== ESP-NOW RX ==========");
  Serial.print("From MAC: ");
  printMacAddress(srcMac);
  Serial.println();
  Serial.print("Size: ");
  Serial.println(len);

  if (len == sizeof(NodeConfigPacket)) {
    NodeConfigPacket cfg;
    memcpy(&cfg, data, sizeof(cfg));

    Serial.print("Config target node: ");
    Serial.println(cfg.target_node_code);
    Serial.print("Config seq: ");
    Serial.println(cfg.seq);

    char msg[48] = {0};
    bool ok = applyNodeConfig(cfg, msg, sizeof(msg));

    Serial.print("Config apply result: ");
    Serial.println(ok ? "OK" : "ERROR");
    Serial.print("Message: ");
    Serial.println(msg);

    sendConfigAck(cfg.seq, ok, msg);
    return;
  }

  Serial.println("[ESP-NOW] Unknown packet ignored");
}

// ================== ESP-NOW INIT ==================

void setupEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  delay(100);

  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(espnowChannel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  Serial.print("[WiFi] STA MAC: ");
  Serial.println(WiFi.macAddress());

  Serial.print("[WiFi] ESP-NOW channel: ");
  Serial.println(espnowChannel);

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] Init FAILED. Restarting...");
    delay(2000);
    ESP.restart();
  }

  esp_err_t sendCbResult = esp_now_register_send_cb(onDataSent);
  Serial.print("[ESP-NOW] Register send callback: ");
  Serial.println(sendCbResult == ESP_OK ? "OK" : "FAILED");

  esp_err_t recvCbResult = esp_now_register_recv_cb(onDataRecv);
  Serial.print("[ESP-NOW] Register recv callback: ");
  Serial.println(recvCbResult == ESP_OK ? "OK" : "FAILED");

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, broadcastAddress, 6);
  peerInfo.channel = espnowChannel;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("[ESP-NOW] Add broadcast peer FAILED");
  } else {
    Serial.println("[ESP-NOW] Broadcast peer added");
  }
}

// ================== SETUP / LOOP ==================

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println();
  Serial.println("====================================================");
  Serial.println("Smart Aquarium ESP32-S3 Mini Generic Wireless Node");
  Serial.println("Module: HC-SR04");
  Serial.println("Receive config: ESP-NOW");
  Serial.println("Send sensor   : ESP-NOW");
  Serial.println("====================================================");

  setupHcsr04Pins();
  setupEspNow();

  Serial.println("[SYSTEM] Ready");
}

void loop() {
  unsigned long now = millis();

  if (now - lastSendMs >= sendIntervalMs) {
    lastSendMs = now;
    sendSensorPacket();
  }
}