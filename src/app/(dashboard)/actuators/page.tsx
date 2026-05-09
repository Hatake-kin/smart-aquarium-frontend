"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type DeviceInfo = {
  id: number;
  tank_id: number;
  device_code: string;
  name: string;
  status?: string;
  last_seen?: string | null;
  battery_level?: number | null;
  rssi?: number | null;
  tank_name?: string;
  tank_code?: string;
  tank_status?: string;
  owner_id?: number;
  owner_email?: string;
};

type ActuatorState = {
  id: number | null;
  device_id: number | null;
  tank_id: number | null;
  pump: boolean;
  light: boolean;
  oxygen: boolean;
  auto_mode: boolean;
  feed?: boolean;
  servo_angle?: number;
  last_command_by: number | null;
  last_command_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ControlItem = {
  device: DeviceInfo;
  state: ActuatorState;
  control_topic: string;
};

type UserData = {
  id?: number;
  email?: string;
  role?: "admin" | "moderator" | "user";
};

type MessageType = "idle" | "loading" | "success" | "error";

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

export default function ActuatorsPage() {
  const API_URL = "";

  const [controls, setControls] = useState<ControlItem[]>([]);
  const [message, setMessage] = useState("Sẵn sàng điều khiển thiết bị.");
  const [messageType, setMessageType] = useState<MessageType>("idle");
  const [lastRefresh, setLastRefresh] = useState("");
  const [loadingDeviceId, setLoadingDeviceId] = useState<number | null>(null);
  const [user, setUser] = useState<UserData | null>(null);

  const getToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("token") || "";
  };

  const loadUser = () => {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        setUser(JSON.parse(raw));
      }
    } catch {
      setUser(null);
    }
  };

  const loadControls = async (silent = true) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/actuators`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessageType("error");
        setMessage(data.message || "Không lấy được danh sách điều khiển");
        return;
      }

      setControls(data.controls || []);
      setLastRefresh(new Date().toLocaleString("vi-VN", { hour12: false }));

      if (!silent) {
        setMessageType("idle");
        setMessage("Sẵn sàng điều khiển thiết bị.");
      }
    } catch (err) {
      console.error(err);
      setMessageType("error");
      setMessage("Không kết nối được backend");
    }
  };

  useEffect(() => {
    loadUser();
    loadControls(false);

    const timer = setInterval(() => {
      loadControls(true);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const sendControlRequest = async (
    deviceId: number,
    nextPartialState: Partial<ActuatorState>
  ) => {
    const token = getToken();

    const res = await fetch(`${API_URL}/api/actuators/devices/${deviceId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(nextPartialState),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Điều khiển thiết bị thất bại");
    }

    return data;
  };

  const updateControl = async (
    deviceId: number,
    nextPartialState: Partial<ActuatorState>
  ) => {
    try {
      setLoadingDeviceId(deviceId);
      setMessageType("loading");
      setMessage("Đang gửi lệnh điều khiển tới ESP32 qua MQTT...");

      await sendControlRequest(deviceId, nextPartialState);

      setMessageType("success");
      setMessage("Lệnh đã gửi thành công. ESP32 đang xử lý.");

      await loadControls(true);
    } catch (err) {
      console.error(err);
      setMessageType("error");
      setMessage(
        err instanceof Error ? err.message : "Không kết nối được backend"
      );
    } finally {
      setLoadingDeviceId(null);
    }
  };

  const getDeviceControlDisabled = (item: ControlItem) => {
    if (user?.role === "moderator") return true;
    if (item.device.status === "suspended") return true;
    if (item.device.tank_status === "suspended") return true;
    return false;
  };

  const feedServo = async (item: ControlItem) => {
    const disabled =
      getDeviceControlDisabled(item) || loadingDeviceId === item.device.id;

    if (disabled) return;

    try {
      setLoadingDeviceId(item.device.id);
      setMessageType("loading");
      setMessage("Đang gửi lệnh cho ăn tới ESP32...");

      await sendControlRequest(item.device.id, {
        feed: true,
        servo_angle: 90,
      });

      setMessageType("success");
      setMessage("Đã gửi lệnh cho ăn. Servo sẽ tự quay và trở về.");

      await loadControls(true);
    } catch (err) {
      console.error(err);
      setMessageType("error");
      setMessage(
        err instanceof Error ? err.message : "Không kết nối được backend"
      );
    } finally {
      setLoadingDeviceId(null);
    }
  };

  const getDeviceConnection = (device: DeviceInfo) => {
    if (device.status === "suspended" || device.tank_status === "suspended") {
      return {
        label: "Tạm khóa",
        color: "#d97706",
        background: "#fffbeb",
        border: "#fde68a",
      };
    }

    if (!device.last_seen) {
      return {
        label: "Chưa có dữ liệu",
        color: "#64748b",
        background: "#f8fafc",
        border: "#cbd5e1",
      };
    }

    const lastSeenDate = parseServerDate(device.last_seen);

    if (!lastSeenDate) {
      return {
        label: "Không xác định",
        color: "#64748b",
        background: "#f8fafc",
        border: "#cbd5e1",
      };
    }

    const diffMinutes = Math.max(
      0,
      (Date.now() - lastSeenDate.getTime()) / 1000 / 60
    );

    if (diffMinutes <= 2) {
      return {
        label: "Online",
        color: "#16a34a",
        background: "#f0fdf4",
        border: "#86efac",
      };
    }

    return {
      label: "Offline",
      color: "#dc2626",
      background: "#fff1f2",
      border: "#fecdd3",
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

  const switchButtonStyle = (active: boolean, disabled: boolean) => ({
    minWidth: 96,
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: "bold",
    border: active ? "1.5px solid #0891b2" : "1.5px solid #67e8f9",
    background: active
      ? "linear-gradient(135deg, #06b6d4, #0891b2)"
      : "#ffffff",
    color: active ? "#ffffff" : "#0e7490",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease",
    boxShadow: active ? "0 8px 18px rgba(8, 145, 178, 0.18)" : "none",
  });

  const feedButtonStyle = (disabled: boolean) => ({
    minWidth: 110,
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: "bold",
    border: "1.5px solid #f59e0b",
    background: disabled
      ? "#ffffff"
      : "linear-gradient(135deg, #fbbf24, #f59e0b)",
    color: disabled ? "#92400e" : "#ffffff",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease",
    boxShadow: disabled ? "none" : "0 8px 18px rgba(245, 158, 11, 0.2)",
  });

  const renderSwitch = (
    item: ControlItem,
    keyName: "light" | "oxygen" | "auto_mode",
    label: string
  ) => {
    const active = Boolean(item.state?.[keyName]);
    const disabled =
      getDeviceControlDisabled(item) || loadingDeviceId === item.device.id;

    return (
      <button
        disabled={disabled}
        onClick={() => {
          updateControl(item.device.id, {
            [keyName]: !active,
          } as Partial<ActuatorState>);
        }}
        style={switchButtonStyle(active, disabled)}
      >
        {label}: {active ? "ON" : "OFF"}
      </button>
    );
  };

  const statusBoxStyle: CSSProperties = {
    marginTop: 12,
    minHeight: 42,
    padding: "10px 12px",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: "bold",
    color:
      messageType === "error"
        ? "#dc2626"
        : messageType === "success"
        ? "#16a34a"
        : messageType === "loading"
        ? "#d97706"
        : "#475569",
    background:
      messageType === "error"
        ? "#fff1f2"
        : messageType === "success"
        ? "#f0fdf4"
        : messageType === "loading"
        ? "#fffbeb"
        : "#f8fafc",
    border:
      messageType === "error"
        ? "1px solid #fecdd3"
        : messageType === "success"
        ? "1px solid #86efac"
        : messageType === "loading"
        ? "1px solid #fde68a"
        : "1px solid #e2e8f0",
  };

  const messageIcon =
    messageType === "loading"
      ? "⏳"
      : messageType === "success"
      ? "✅"
      : messageType === "error"
      ? "⚠️"
      : "ℹ️";

  return (
    <main style={{ padding: 24, maxWidth: 1250 }}>
      <h1>Điều khiển thiết bị</h1>
      <p>
        Điều khiển đèn, servo cho ăn, sủi oxy và chế độ tự động thông qua MQTT
        topic điều khiển.
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ marginBottom: 4 }}>Danh sách điều khiển</h2>
            <p style={{ margin: 0, color: "#475569" }}>
              Tự cập nhật mỗi 5 giây.{" "}
              {lastRefresh && <>Lần cập nhật: {lastRefresh}</>}
            </p>

            {user?.role === "moderator" && (
              <p style={{ color: "#d97706", fontWeight: "bold" }}>
                Moderator chỉ được xem, không được điều khiển thiết bị.
              </p>
            )}
          </div>

          <button
            onClick={() => loadControls(false)}
            style={{ padding: "10px 16px" }}
          >
            Refresh
          </button>
        </div>

        <div style={statusBoxStyle}>
          <span>{messageIcon}</span>
          <span>{message}</span>
        </div>
      </section>

      {controls.length === 0 && (
        <section
          style={{
            border: "1px solid #67e8f9",
            padding: 24,
            borderRadius: 18,
            background: "rgba(255,255,255,0.9)",
            textAlign: "center",
          }}
        >
          Chưa có thiết bị nào để điều khiển.
        </section>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 18,
        }}
      >
        {controls.map((item) => {
          const connection = getDeviceConnection(item.device);
          const disabled = getDeviceControlDisabled(item);
          const isLoading = loadingDeviceId === item.device.id;

          return (
            <section
              key={item.device.id}
              style={{
                border: "1px solid #67e8f9",
                padding: 18,
                borderRadius: 20,
                background: "rgba(255,255,255,0.92)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>{item.device.name}</h2>
                  <p style={{ margin: "6px 0", color: "#475569" }}>
                    {item.device.device_code}
                  </p>
                  <p style={{ margin: 0, color: "#475569" }}>
                    Bể: {item.device.tank_name || `ID ${item.device.tank_id}`}
                  </p>
                </div>

                <span style={badgeStyle(connection)}>{connection.label}</span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(140px, 1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    border: "1px solid #67e8f9",
                    borderRadius: 14,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  <b>Pin</b>
                  <p style={{ margin: "6px 0 0", fontSize: 22 }}>
                    {item.device.battery_level ?? "N/A"}
                    {item.device.battery_level !== null &&
                    item.device.battery_level !== undefined
                      ? "%"
                      : ""}
                  </p>
                </div>

                <div
                  style={{
                    border: "1px solid #67e8f9",
                    borderRadius: 14,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  <b>RSSI</b>
                  <p style={{ margin: "6px 0 0", fontSize: 22 }}>
                    {item.device.rssi ?? "N/A"}
                    {item.device.rssi !== null &&
                    item.device.rssi !== undefined
                      ? " dBm"
                      : ""}
                  </p>
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #67e8f9",
                  borderRadius: 14,
                  padding: 12,
                  background: "#ecfeff",
                  marginBottom: 16,
                }}
              >
                <b>MQTT control topic</b>
                <br />

                <code
                  style={{
                    display: "inline-block",
                    marginTop: 8,
                    padding: "6px 8px",
                    borderRadius: 10,
                    background: "#fff",
                    color: "#0e7490",
                    border: "1px solid #67e8f9",
                    fontSize: 12,
                  }}
                >
                  {item.control_topic}
                </code>

                <p style={{ marginBottom: 0, color: "#475569" }}>
                  ESP32 subscribe topic này để nhận lệnh điều khiển.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <button
                  disabled={disabled || isLoading}
                  onClick={() => feedServo(item)}
                  style={feedButtonStyle(disabled || isLoading)}
                  title="Servo quay 90° rồi tự về 0°"
                >
                  Cho ăn
                </button>

                {renderSwitch(item, "light", "Đèn")}
                {renderSwitch(item, "oxygen", "Sủi oxy")}
                {renderSwitch(item, "auto_mode", "Auto")}
              </div>

              {disabled && (
                <p style={{ color: "#d97706", fontWeight: "bold" }}>
                  Thiết bị/bể đang bị khóa hoặc tài khoản không có quyền điều
                  khiển.
                </p>
              )}

              <div style={{ color: "#475569", fontSize: 13 }}>
                <p>
                  <b>Last seen:</b>{" "}
                  {item.device.last_seen
                    ? formatServerDateTime(item.device.last_seen)
                    : "Chưa có dữ liệu"}
                </p>

                <p>
                  <b>Lệnh cuối:</b>{" "}
                  {item.state?.last_command_at
                    ? formatServerDateTime(item.state.last_command_at)
                    : "Chưa có lệnh"}
                </p>

                {item.device.owner_email && (
                  <p>
                    <b>Owner:</b> {item.device.owner_email}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}