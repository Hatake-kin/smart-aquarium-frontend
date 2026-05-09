"use client";

import { useEffect, useState } from "react";

type Tank = {
  id: number;
  tank_code: string;
  name: string;
  package_type?: string;
};

type Device = {
  id: number;
  tank_id: number;
  owner_id?: number;
  device_code: string;
  name: string;
  hardware_version: string;
  firmware_version: string;
  last_seen: string | null;
  battery_level: number | null;
  rssi: number | null;
  status?: string;
  access_status?: string;
  tank_name?: string;
  tank_code?: string;
  owner_email?: string;
  email?: string;
};

const parseServerDate = (value?: string | null) => {
  if (!value) return null;

  const raw = String(value).trim();
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);

  const candidates: Date[] = [];

  const addCandidate = (date: Date) => {
    if (!Number.isNaN(date.getTime())) {
      candidates.push(date);
    }
  };

  if (hasTimezone) {
    const parsed = new Date(normalized);
    addCandidate(parsed);

    // Fix trường hợp DB/backend trả giờ bị lệch UTC+7.
    addCandidate(new Date(parsed.getTime() + 7 * 60 * 60 * 1000));
  } else {
    const asUtc = new Date(`${normalized}Z`);
    const asLocal = new Date(normalized);

    addCandidate(asUtc);
    addCandidate(asLocal);
    addCandidate(new Date(asUtc.getTime() + 7 * 60 * 60 * 1000));
    addCandidate(new Date(asLocal.getTime() + 7 * 60 * 60 * 1000));
  }

  if (candidates.length === 0) return null;

  const now = Date.now();

  candidates.sort(
    (a, b) => Math.abs(now - a.getTime()) - Math.abs(now - b.getTime())
  );

  return candidates[0];
};

const formatServerDateTime = (value?: string | null) => {
  const date = parseServerDate(value);

  if (!date) return "";

  return date.toLocaleString("vi-VN", {
    hour12: false,
  });
};

export default function DevicesPage() {
  const API_URL = "";

  const [tanks, setTanks] = useState<Tank[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [tankId, setTankId] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [name, setName] = useState("");
  const [hardwareVersion, setHardwareVersion] = useState("ESP32");
  const [firmwareVersion, setFirmwareVersion] = useState("1.0.0");

  const [message, setMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  const getToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("token") || "";
  };

  const loadTanks = async () => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/tanks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setTanks(data.tanks || []);
      } else {
        setMessage(data.message || "Không lấy được danh sách bể cá");
      }
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const loadDevices = async () => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/devices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setDevices(data.devices || []);
        setLastRefresh(new Date().toLocaleString("vi-VN", { hour12: false }));
      } else {
        setMessage(data.message || "Không lấy được danh sách thiết bị");
      }
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  useEffect(() => {
    loadTanks();
    loadDevices();

    const timer = setInterval(() => {
      loadDevices();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!tankId) {
      setMessage("Vui lòng chọn bể cá");
      return;
    }

    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/devices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tank_id: Number(tankId),
          device_code: deviceCode || undefined,
          name: name || "ESP32 Aquarium",
          hardware_version: hardwareVersion,
          firmware_version: firmwareVersion,
          battery_level: 95,
          rssi: -55,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Tạo thiết bị thất bại");
        return;
      }

      setMessage("Tạo thiết bị thành công");

      setDeviceCode("");
      setName("");
      setHardwareVersion("ESP32");
      setFirmwareVersion("1.0.0");

      loadDevices();
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const getDeviceConnection = (device: Device) => {
    if (
      device.status === "suspended" ||
      device.access_status === "suspended_by_plan"
    ) {
      return {
        label: "Tạm khóa",
        color: "#d97706",
        background: "#fffbeb",
        border: "#fde68a",
        description: "Thiết bị bị khóa",
      };
    }

    if (!device.last_seen) {
      return {
        label: "Chưa có dữ liệu",
        color: "#64748b",
        background: "#f8fafc",
        border: "#cbd5e1",
        description: "Chưa từng gửi MQTT",
      };
    }

    const lastSeenDate = parseServerDate(device.last_seen);

    if (!lastSeenDate) {
      return {
        label: "Không xác định",
        color: "#64748b",
        background: "#f8fafc",
        border: "#cbd5e1",
        description: "Không đọc được last_seen",
      };
    }

    const diffMs = Date.now() - lastSeenDate.getTime();
    const diffMinutes = Math.max(0, diffMs / 1000 / 60);

    if (diffMinutes <= 2) {
      return {
        label: "Online",
        color: "#16a34a",
        background: "#f0fdf4",
        border: "#86efac",
        description: "Vừa gửi dữ liệu",
      };
    }

    return {
      label: "Offline",
      color: "#dc2626",
      background: "#fff1f2",
      border: "#fecdd3",
      description: `Mất kết nối ${Math.round(diffMinutes)} phút`,
    };
  };

  const getBatteryStyle = (battery: number | null) => {
    if (battery === null || battery === undefined) {
      return {
        color: "#64748b",
        background: "#f8fafc",
        border: "#cbd5e1",
      };
    }

    if (battery < 20) {
      return {
        color: "#dc2626",
        background: "#fff1f2",
        border: "#fecdd3",
      };
    }

    if (battery < 50) {
      return {
        color: "#d97706",
        background: "#fffbeb",
        border: "#fde68a",
      };
    }

    return {
      color: "#16a34a",
      background: "#f0fdf4",
      border: "#86efac",
    };
  };

  const getRssiStyle = (rssi: number | null) => {
    if (rssi === null || rssi === undefined) {
      return {
        color: "#64748b",
        background: "#f8fafc",
        border: "#cbd5e1",
      };
    }

    if (rssi < -80) {
      return {
        color: "#dc2626",
        background: "#fff1f2",
        border: "#fecdd3",
      };
    }

    if (rssi < -65) {
      return {
        color: "#d97706",
        background: "#fffbeb",
        border: "#fde68a",
      };
    }

    return {
      color: "#16a34a",
      background: "#f0fdf4",
      border: "#86efac",
    };
  };

  const badgeStyle = (style: {
    color: string;
    background: string;
    border: string;
  }) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: "bold",
    fontSize: 12,
    color: style.color,
    background: style.background,
    border: `1.5px solid ${style.border}`,
    whiteSpace: "nowrap" as const,
  });

  const getMqttTopic = (device: Device) => {
    const userId = device.owner_id;

    if (!userId) {
      return `aquarium/{user_id}/${device.tank_id}/sensor`;
    }

    return `aquarium/${userId}/${device.tank_id}/sensor`;
  };

  return (
    <main style={{ padding: 24, maxWidth: 1250 }}>
      <h1>Quản lý thiết bị</h1>
      <p>
        Gắn ESP32 vào bể cá, theo dõi trạng thái kết nối, pin, RSSI và thời gian
        gửi dữ liệu MQTT cuối cùng.
      </p>

      <section
        style={{
          border: "1px solid #67e8f9",
          padding: 18,
          borderRadius: 18,
          marginBottom: 24,
          background: "rgba(255,255,255,0.9)",
        }}
      >
        <h2>Gắn thiết bị ESP32 vào bể cá</h2>

        <form onSubmit={handleCreateDevice}>
          <div style={{ marginBottom: 12 }}>
            <label>Chọn bể cá</label>
            <select
              value={tankId}
              onChange={(e) => setTankId(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">-- Chọn bể cá --</option>
              {tanks.map((tank) => (
                <option key={tank.id} value={tank.id}>
                  ID {tank.id} - {tank.name} - {tank.tank_code}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Mã thiết bị</label>
            <input
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value)}
              placeholder="Ví dụ: ESP32_TANK_002, bỏ trống để tự sinh"
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Tên thiết bị</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: ESP32 bể phòng khách"
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <label>Hardware version</label>
              <input
                value={hardwareVersion}
                onChange={(e) => setHardwareVersion(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>Firmware version</label>
              <input
                value={firmwareVersion}
                onChange={(e) => setFirmwareVersion(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
          </div>

          <button type="submit" style={{ padding: "10px 16px" }}>
            Tạo thiết bị
          </button>
        </form>

        {message && (
          <p
            style={{
              marginTop: 12,
              fontWeight: "bold",
              color: message.includes("thành công") ? "#16a34a" : "#dc2626",
            }}
          >
            {message}
          </p>
        )}
      </section>

      <section
        style={{
          border: "1px solid #67e8f9",
          padding: 18,
          borderRadius: 18,
          background: "rgba(255,255,255,0.9)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ marginBottom: 4 }}>Danh sách thiết bị</h2>
            <p style={{ margin: 0, color: "#475569" }}>
              Tự cập nhật mỗi 5 giây.{" "}
              {lastRefresh && <>Lần cập nhật: {lastRefresh}</>}
            </p>
          </div>

          <button
            onClick={loadDevices}
            style={{ padding: "10px 16px", whiteSpace: "nowrap" }}
          >
            Refresh
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            cellPadding={8}
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 1100,
            }}
          >
            <thead>
              <tr>
                <th>ID</th>
                <th>Trạng thái</th>
                <th>Bể cá</th>
                <th>Thiết bị</th>
                <th>Phiên bản</th>
                <th>Pin</th>
                <th>RSSI</th>
                <th>Last seen</th>
                <th>MQTT topic test</th>
              </tr>
            </thead>

            <tbody>
              {devices.map((device) => {
                const connection = getDeviceConnection(device);
                const batteryStyle = getBatteryStyle(device.battery_level);
                const rssiStyle = getRssiStyle(device.rssi);

                return (
                  <tr key={device.id}>
                    <td>
                      <b>{device.id}</b>
                    </td>

                    <td>
                      <span style={badgeStyle(connection)}>
                        {connection.label}
                      </span>
                      <br />
                      <span style={{ fontSize: 12, color: "#475569" }}>
                        {connection.description}
                      </span>
                    </td>

                    <td>
                      <b>ID {device.tank_id}</b>
                      <br />
                      <span style={{ color: "#475569" }}>
                        {device.tank_name || "Không rõ tên bể"}
                      </span>
                      {device.tank_code && (
                        <>
                          <br />
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            {device.tank_code}
                          </span>
                        </>
                      )}
                    </td>

                    <td>
                      <b>{device.name}</b>
                      <br />
                      <span style={{ color: "#475569" }}>
                        {device.device_code}
                      </span>
                      {(device.owner_email || device.email) && (
                        <>
                          <br />
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            Owner: {device.owner_email || device.email}
                          </span>
                        </>
                      )}
                    </td>

                    <td>
                      <b>HW:</b> {device.hardware_version || "-"}
                      <br />
                      <b>FW:</b> {device.firmware_version || "-"}
                    </td>

                    <td>
                      <span style={badgeStyle(batteryStyle)}>
                        {device.battery_level !== null &&
                        device.battery_level !== undefined
                          ? `${device.battery_level}%`
                          : "N/A"}
                      </span>
                    </td>

                    <td>
                      <span style={badgeStyle(rssiStyle)}>
                        {device.rssi !== null && device.rssi !== undefined
                          ? `${device.rssi} dBm`
                          : "N/A"}
                      </span>
                    </td>

                    <td>
                      {device.last_seen ? (
                        <>{formatServerDateTime(device.last_seen)}</>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>
                          Chưa có dữ liệu
                        </span>
                      )}
                    </td>

                    <td>
                      <code
                        style={{
                          background: "#ecfeff",
                          border: "1px solid #67e8f9",
                          padding: "6px 8px",
                          borderRadius: 10,
                          display: "inline-block",
                          color: "#0e7490",
                          fontSize: 12,
                        }}
                      >
                        {getMqttTopic(device)}
                      </code>
                    </td>
                  </tr>
                );
              })}

              {devices.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 24 }}>
                    Chưa có thiết bị nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}