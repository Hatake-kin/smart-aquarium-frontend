"use client";

type FirmwareItem = {
  title: string;
  board: string;
  version: string;
  description: string;
  features: string[];
  inoUrl: string;
  note: string;
};

const firmwares: FirmwareItem[] = [
  {
    title: "ESP32 Main Gateway",
    board: "ESP32 Dev Module / ESP32 38 pin",
    version: "v1.0.0",
    description:
      "Firmware gateway chính: nhận cấu hình từ web qua MQTT, điều khiển module GPIO, nhận ESP-NOW từ node không dây và publish sensor lên backend.",
    features: [
      "MQTT sensor/control/config/config_ack",
      "DS18B20 GPIO",
      "Light GPIO",
      "Servo feeder",
      "ESP-NOW gateway cho wireless node",
      "Gửi config wireless xuống ESP32-S3 mini",
    ],
    inoUrl: "/firmwares/esp32-main-gateway-v1.0.0.ino",
    note:
      "Trước khi nạp, điền WiFi SSID, WiFi password, DEVICE_MQTT_TOKEN và ESPNOW_SHARED_KEY riêng của thiết bị.",
  },
  {
    title: "ESP32-S3 Mini HC-SR04 Wireless Node",
    board: "ESP32S3 Dev Module",
    version: "v1.0.0",
    description:
      "Firmware node không dây: đọc HC-SR04, nhận config từ gateway qua ESP-NOW, gửi distance/water_level về ESP32 chính.",
    features: [
      "HC-SR04 TRIG/ECHO runtime config",
      "ESP-NOW sensor packet",
      "ESP-NOW config packet",
      "Config ACK về gateway",
      "Lọc mẫu cảm biến ở edge",
      "Tính water_level_cm tại node",
    ],
    inoUrl: "/firmwares/esp32-s3-hcsr04-node-v1.0.0.ino",
    note:
      "Board phải chọn ESP32S3 Dev Module. ESPNOW_SHARED_KEY phải giống gateway. ESP-NOW channel phải trùng WiFi channel của gateway.",
  },
];

const cardStyle = {
  border: "1px solid #67e8f9",
  borderRadius: 18,
  padding: 18,
  background: "rgba(255,255,255,0.94)",
};

const buttonStyle = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #0891b2",
  background: "#0891b2",
  color: "#fff",
  fontWeight: "bold",
  textDecoration: "none",
};

export default function FirmwarePage() {
  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1>Firmware thiết bị</h1>

      <p style={{ color: "#475569", maxWidth: 850 }}>
        Tải firmware mẫu cho ESP32 gateway và ESP32-S3 mini wireless node.
        Firmware ở đây là bản template, không chứa token thật. Sau khi tải,
        người dùng điền WiFi, token thiết bị và shared key riêng rồi nạp vào ESP.
      </p>

      <section
        style={{
          padding: 16,
          borderRadius: 18,
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          marginBottom: 24,
          color: "#9a3412",
        }}
      >
        <b>Lưu ý bảo mật:</b>
        <p style={{ margin: "8px 0 0" }}>
          Không public firmware có WiFi password, MQTT token hoặc shared key thật.
          Sau khi demo ổn, nên rotate token mới và dùng firmware template cho người dùng tải.
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {firmwares.map((fw) => (
          <article key={fw.title} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>{fw.title}</h2>
                <p style={{ margin: "6px 0", color: "#475569" }}>
                  {fw.board}
                </p>
              </div>

              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#ecfeff",
                  color: "#0e7490",
                  border: "1px solid #67e8f9",
                  fontWeight: "bold",
                }}
              >
                {fw.version}
              </span>
            </div>

            <p style={{ color: "#334155" }}>{fw.description}</p>

            <b>Chức năng:</b>
            <ul>
              {fw.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                marginTop: 12,
                color: "#475569",
              }}
            >
              {fw.note}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 14,
                flexWrap: "wrap",
              }}
            >
              <a href={fw.inoUrl} download style={buttonStyle}>
                Tải file .ino
              </a>

              <span
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#64748b",
                  fontWeight: "bold",
                }}
              >
                .bin sẽ thêm sau
              </span>
            </div>
          </article>
        ))}
      </div>

      <section style={{ ...cardStyle, marginTop: 24 }}>
        <h2>Hướng dẫn nạp bằng Arduino IDE</h2>

        <ol>
          <li>Tải đúng firmware theo loại board.</li>
          <li>Mở file .ino bằng Arduino IDE.</li>
          <li>Điền WiFi SSID, WiFi password, device token và shared key.</li>
          <li>Chọn đúng board: ESP32 Dev Module hoặc ESP32S3 Dev Module.</li>
          <li>Chọn đúng COM port.</li>
          <li>Bấm Upload.</li>
          <li>Serial Monitor baud 115200 để kiểm tra log.</li>
        </ol>
      </section>
    </main>
  );
}
