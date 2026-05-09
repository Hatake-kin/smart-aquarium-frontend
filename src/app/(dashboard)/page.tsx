"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

type Device = {
  id: number;
  tank_id: number;
  owner_id?: number;
  device_code: string;
  name: string;
  tank_name?: string;
  tank_code?: string;
  access_status?: string;
  status?: string;
  last_seen?: string | null;
  battery_level?: number | null;
  rssi?: number | null;
};

type SensorData = {
  id: number;
  device_id: number;
  temperature: number | null;
  ph: number | null;
  water_level: number | null;
  battery: number | null;
  rssi: number | null;
  created_at: string;
};

type PlanMeta = {
  limit: number;
  effective_plan: "basic" | "premium" | "manager" | string;
  is_premium_expired: boolean;
  device?: any;
};

type Threshold = {
  id?: number;
  tank_id?: number;
  temperature_min: number;
  temperature_max: number;
  ph_min: number;
  ph_max: number;
  water_level_min: number;
  battery_min: number;
  rssi_min: number;
};

const DEFAULT_THRESHOLD: Threshold = {
  temperature_min: 22,
  temperature_max: 30,
  ph_min: 6.5,
  ph_max: 8.0,
  water_level_min: 50,
  battery_min: 20,
  rssi_min: -80,
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

    // Trường hợp DB đã lưu giờ Việt Nam nhưng driver lại gắn Z.
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

const formatServerTime = (value?: string | null) => {
  const date = parseServerDate(value);

  if (!date) return "";

  return date.toLocaleTimeString("vi-VN", {
    hour12: false,
  });
};

const isNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const formatMetric = (
  value: number | null | undefined,
  suffix = "",
  digits = 1
) => {
  if (!isNumber(value)) return "N/A";
  return `${Number(value).toFixed(digits)}${suffix}`;
};

async function readJsonSafe(res: Response) {
  const text = await res.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text,
    };
  }
}

function ChartContainer({ children }: { children: ReactElement }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = window.requestAnimationFrame(() => {
        const el = containerRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const nextWidth = Math.floor(rect.width);

        if (nextWidth > 20) {
          setChartWidth(nextWidth);
        }
      });
    };

    measure();

    const observer = new ResizeObserver(measure);

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        minWidth: 0,
        height: 290,
        minHeight: 290,
      }}
    >
      {chartWidth > 20 && isValidElement(children) ? (
        cloneElement(children, {
          width: chartWidth,
          height: 290,
        })
      ) : (
        <div
          style={{
            height: 290,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            background: "#f8fafc",
            borderRadius: 12,
          }}
        >
          Đang tải biểu đồ...
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const API_URL = "";

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [planMeta, setPlanMeta] = useState<PlanMeta | null>(null);
  const [threshold, setThreshold] = useState<Threshold | null>(null);
  const [message, setMessage] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");

  const activeThreshold = threshold || DEFAULT_THRESHOLD;

  const getToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("token") || "";
  };

  const getAlerts = () => {
    if (!sensorData) return [];

    const t = activeThreshold;
    const alerts: string[] = [];

    if (
      isNumber(sensorData.temperature) &&
      sensorData.temperature > t.temperature_max
    ) {
      alerts.push(
        `Nhiệt độ nước quá cao: ${sensorData.temperature}°C, vượt ngưỡng ${t.temperature_max}°C.`
      );
    }

    if (
      isNumber(sensorData.temperature) &&
      sensorData.temperature < t.temperature_min
    ) {
      alerts.push(
        `Nhiệt độ nước quá thấp: ${sensorData.temperature}°C, thấp hơn ngưỡng ${t.temperature_min}°C.`
      );
    }

    if (isNumber(sensorData.ph) && sensorData.ph < t.ph_min) {
      alerts.push(`pH thấp: ${sensorData.ph}, thấp hơn ngưỡng ${t.ph_min}.`);
    }

    if (isNumber(sensorData.ph) && sensorData.ph > t.ph_max) {
      alerts.push(`pH cao: ${sensorData.ph}, vượt ngưỡng ${t.ph_max}.`);
    }

    if (
      isNumber(sensorData.water_level) &&
      sensorData.water_level < t.water_level_min
    ) {
      alerts.push(
        `Mực nước thấp: ${sensorData.water_level}%, thấp hơn ngưỡng ${t.water_level_min}%.`
      );
    }

    if (isNumber(sensorData.battery) && sensorData.battery < t.battery_min) {
      alerts.push(
        `Pin thiết bị yếu: ${sensorData.battery}%, thấp hơn ngưỡng ${t.battery_min}%.`
      );
    }

    if (isNumber(sensorData.rssi) && sensorData.rssi < t.rssi_min) {
      alerts.push(
        `Tín hiệu WiFi yếu: ${sensorData.rssi} dBm, thấp hơn ngưỡng ${t.rssi_min} dBm.`
      );
    }

    return alerts;
  };

  const loadDevices = async () => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/devices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        setMessage(data.message || "Không lấy được danh sách thiết bị");
        return;
      }

      const list: Device[] = data.devices || [];
      setDevices(list);

      setSelectedDeviceId((prev) => {
        if (list.length === 0) {
          setSensorData(null);
          setHistoryData([]);
          setPlanMeta(null);
          setThreshold(null);
          return "";
        }

        const stillExists = list.some((device) => String(device.id) === prev);
        return stillExists ? prev : String(list[0].id);
      });
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const loadLatestSensor = async (deviceId: string) => {
    try {
      if (!deviceId) {
        setSensorData(null);
        return;
      }

      const token = getToken();

      const res = await fetch(
        `${API_URL}/api/sensors/latest?device_id=${deviceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await readJsonSafe(res);

      if (!res.ok) {
        setSensorData(null);
        setMessage(data.message || "Không lấy được dữ liệu cảm biến");
        return;
      }

      setSensorData(data.data || null);
      setMessage("");
      setLastUpdate(new Date().toLocaleString("vi-VN", { hour12: false }));
    } catch (err) {
      console.error(err);
      setSensorData(null);
      setMessage("Không kết nối được backend");
    }
  };

  const loadSensorHistory = async (deviceId: string) => {
    try {
      if (!deviceId) {
        setHistoryData([]);
        setPlanMeta(null);
        return;
      }

      const token = getToken();

      const res = await fetch(
        `${API_URL}/api/sensors/history?device_id=${deviceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await readJsonSafe(res);

      if (!res.ok) {
        setHistoryData([]);
        setMessage(data.message || "Không lấy được lịch sử cảm biến");
        return;
      }

      setPlanMeta({
        limit: data.limit,
        effective_plan: data.effective_plan,
        is_premium_expired: data.is_premium_expired,
        device: data.device,
      });

      const formatted = (data.data || []).map((item: any) => ({
        ...item,
        time: formatServerTime(item.created_at),
      }));

      setHistoryData(formatted);
    } catch (err) {
      console.error(err);
      setHistoryData([]);
      setMessage("Không kết nối được backend");
    }
  };

  const loadThresholdByTank = async (tankId: number) => {
    try {
      if (!tankId) {
        setThreshold(null);
        return;
      }

      const token = getToken();

      const res = await fetch(`${API_URL}/api/thresholds/${tankId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        console.warn("Không lấy được ngưỡng:", data.message);
        setThreshold(null);
        return;
      }

      setThreshold(data.threshold || null);
    } catch (err) {
      console.error(err);
      setThreshold(null);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (!selectedDeviceId) {
      setSensorData(null);
      setHistoryData([]);
      setPlanMeta(null);
      setThreshold(null);
      return;
    }

    const selected = devices.find(
      (device) => String(device.id) === selectedDeviceId
    );

    if (selected?.tank_id) {
      loadThresholdByTank(selected.tank_id);
    } else {
      setThreshold(null);
    }

    loadLatestSensor(selectedDeviceId);
    loadSensorHistory(selectedDeviceId);

    const timer = setInterval(() => {
      loadLatestSensor(selectedDeviceId);
      loadSensorHistory(selectedDeviceId);
    }, 2000);

    return () => clearInterval(timer);
  }, [selectedDeviceId, devices]);

  const selectedDevice = devices.find(
    (device) => String(device.id) === selectedDeviceId
  );

  const alerts = getAlerts();

  const getDeviceConnection = (
    device?: Device,
    latestData?: SensorData | null
  ) => {
    if (!device) {
      return {
        label: "Chưa chọn thiết bị",
        color: "#64748b",
        background: "#f8fafc",
        border: "#cbd5e1",
        description: "Vui lòng chọn thiết bị để kiểm tra trạng thái.",
        lastSeenText: "",
      };
    }

    if (
      device.status === "suspended" ||
      device.access_status === "suspended_by_plan"
    ) {
      return {
        label: "Tạm khóa",
        color: "#d97706",
        background: "#fffbeb",
        border: "#fde68a",
        description:
          "Thiết bị đang bị tạm khóa do gói dịch vụ hoặc cấu hình hệ thống.",
        lastSeenText: device.last_seen
          ? `Lần gửi MQTT cuối: ${formatServerDateTime(device.last_seen)}`
          : "",
      };
    }

    const lastSeenRaw = latestData?.created_at || device.last_seen;

    if (!lastSeenRaw) {
      return {
        label: "Chưa có dữ liệu",
        color: "#64748b",
        background: "#f8fafc",
        border: "#cbd5e1",
        description: "Thiết bị chưa từng gửi dữ liệu MQTT về hệ thống.",
        lastSeenText: "",
      };
    }

    const lastSeenDate = parseServerDate(lastSeenRaw);

    if (!lastSeenDate) {
      return {
        label: "Không xác định",
        color: "#64748b",
        background: "#f8fafc",
        border: "#cbd5e1",
        description: "Không đọc được thời gian last_seen của thiết bị.",
        lastSeenText: "",
      };
    }

    const diffMs = Date.now() - lastSeenDate.getTime();
    const diffMinutes = Math.max(0, diffMs / 1000 / 60);
    const lastSeenText = `Lần gửi MQTT cuối: ${formatServerDateTime(
      lastSeenRaw
    )}`;

    if (diffMinutes <= 2) {
      return {
        label: "Online",
        color: "#16a34a",
        background: "#f0fdf4",
        border: "#86efac",
        description:
          "Thiết bị đang kết nối và vừa gửi dữ liệu về hệ thống.",
        lastSeenText,
      };
    }

    return {
      label: "Offline",
      color: "#dc2626",
      background: "#fff1f2",
      border: "#fecdd3",
      description: `Thiết bị chưa gửi dữ liệu hơn ${Math.round(
        diffMinutes
      )} phút.`,
      lastSeenText,
    };
  };

  const deviceConnection = getDeviceConnection(selectedDevice, sensorData);

  const getPlanLabel = () => {
    if (!planMeta) return "Đang tải...";

    if (planMeta.effective_plan === "manager") {
      return "Quản trị viên / Moderator";
    }

    if (planMeta.is_premium_expired) {
      return "Premium đã hết hạn";
    }

    if (planMeta.effective_plan === "premium") {
      return "Premium còn hiệu lực";
    }

    return "Basic";
  };

  const getPlanDescription = () => {
    if (!planMeta) return "Đang kiểm tra gói sử dụng...";

    if (planMeta.effective_plan === "manager") {
      return "Tài khoản quản trị được xem tối đa 100 điểm dữ liệu để phục vụ demo và quản lý.";
    }

    if (planMeta.is_premium_expired) {
      return "Gói Premium đã hết hạn, hệ thống đang áp dụng giới hạn Basic: 20 điểm lịch sử.";
    }

    if (planMeta.effective_plan === "premium") {
      return "Gói Premium đang hoạt động: biểu đồ hiển thị tối đa 100 điểm lịch sử.";
    }

    return "Gói Basic: biểu đồ hiển thị tối đa 20 điểm lịch sử.";
  };

  const getPlanColor = () => {
    if (!planMeta) return "#64748b";

    if (planMeta.effective_plan === "manager") return "#0f766e";
    if (planMeta.is_premium_expired) return "#dc2626";
    if (planMeta.effective_plan === "premium") return "#7c3aed";

    return "#2563eb";
  };

  const getMqttTopic = () => {
    if (!selectedDevice) return "";

    const userId =
      selectedDevice.owner_id ||
      planMeta?.device?.owner_id ||
      planMeta?.device?.ownerId;

    if (!userId) {
      return `aquarium/{user_id}/${selectedDevice.tank_id}/sensor`;
    }

    return `aquarium/${userId}/${selectedDevice.tank_id}/sensor`;
  };

  const chartCardStyle = {
    minHeight: 380,
    border: "1px solid #67e8f9",
    padding: 18,
    marginBottom: 24,
    background: "rgba(255,255,255,0.9)",
    borderRadius: 18,
  };

  const metricCardStyle = {
    border: "1px solid #67e8f9",
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,0.88)",
  };

  const renderThresholdLegend = () => (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        marginTop: 8,
        marginBottom: 12,
        fontSize: 13,
      }}
    >
      <span>
        <b style={{ color: "#2563eb" }}>━━</b> Ngưỡng thấp / Min
      </span>
      <span>
        <b style={{ color: "#dc2626" }}>━━</b> Ngưỡng cao / Max
      </span>
      <span>
        <b style={{ color: "#0891b2" }}>━━</b> Giá trị cảm biến
      </span>
    </div>
  );

  const renderEmptyState = () => (
    <section
      style={{
        border: "1px solid #cbd5e1",
        padding: 24,
        borderRadius: 18,
        background: "#fff",
        textAlign: "center",
        color: "#475569",
      }}
    >
      <h2>Chưa có thiết bị để hiển thị</h2>
      <p>
        Bạn có thể tạo bể cá và thêm thiết bị ESP32 trước, sau đó Dashboard sẽ
        hiển thị dữ liệu cảm biến tại đây.
      </p>
    </section>
  );

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1>Dashboard</h1>
      <p>Giám sát dữ liệu cảm biến theo thời gian thực.</p>

      {devices.length === 0 && renderEmptyState()}

      {devices.length > 0 && (
        <>
          <section
            style={{
              border: "1px solid #67e8f9",
              padding: 16,
              borderRadius: 18,
              marginBottom: 24,
              background: "rgba(255,255,255,0.9)",
            }}
          >
            <h2>Chọn thiết bị</h2>

            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={{ width: "100%", padding: 8, marginBottom: 12 }}
            >
              <option value="">-- Chọn thiết bị --</option>

              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  ID {device.id} - {device.name} - Bể {device.tank_id}
                </option>
              ))}
            </select>

            {selectedDevice && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: 14,
                    borderRadius: 16,
                    border: `1.5px solid ${deviceConnection.border}`,
                    background: deviceConnection.background,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontWeight: "bold",
                        color: "#0f172a",
                      }}
                    >
                      Trạng thái kết nối thiết bị
                    </p>

                    <p style={{ margin: "6px 0 0", color: "#334155" }}>
                      {deviceConnection.description}
                    </p>

                    {deviceConnection.lastSeenText && (
                      <p
                        style={{
                          margin: "6px 0 0",
                          color: "#475569",
                          fontSize: 13,
                        }}
                      >
                        {deviceConnection.lastSeenText}
                      </p>
                    )}
                  </div>

                  <span
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      fontWeight: "bold",
                      color: deviceConnection.color,
                      background: "#fff",
                      border: `1.5px solid ${deviceConnection.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {deviceConnection.label}
                  </span>
                </div>

                <p>
                  <b>Thiết bị:</b> {selectedDevice.name}
                </p>

                <p>
                  <b>Mã thiết bị:</b> {selectedDevice.device_code}
                </p>

                <p>
                  <b>Topic MQTT test:</b> {getMqttTopic()}
                </p>

                <p>
                  <b>Payload mẫu:</b>{" "}
                  {`{"device_id":${selectedDevice.id},"temperature":28.5,"ph":7.2,"water_level":80,"battery":95,"rssi":-55}`}
                </p>

                <p>
                  <b>Dashboard tự cập nhật mỗi:</b> 2 giây
                </p>

                {lastUpdate && (
                  <p>
                    <b>Lần cập nhật frontend:</b> {lastUpdate}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => {
                if (selectedDevice?.tank_id) {
                  loadThresholdByTank(selectedDevice.tank_id);
                }

                loadLatestSensor(selectedDeviceId);
                loadSensorHistory(selectedDeviceId);
              }}
              style={{ padding: "10px 16px" }}
            >
              Refresh thủ công
            </button>
          </section>

          <section
            style={{
              border: `2px solid ${getPlanColor()}`,
              padding: 16,
              borderRadius: 18,
              marginBottom: 24,
              background: "rgba(255,255,255,0.9)",
            }}
          >
            <h2>Gói sử dụng</h2>

            <p
              style={{
                fontSize: 22,
                fontWeight: "bold",
                color: getPlanColor(),
                margin: "8px 0",
              }}
            >
              {getPlanLabel()}
            </p>

            <p>{getPlanDescription()}</p>

            {planMeta && (
              <p>
                <b>Số điểm lịch sử đang lấy:</b> {planMeta.limit} điểm
              </p>
            )}

            {planMeta?.device?.owner_email && (
              <p>
                <b>Chủ thiết bị:</b> {planMeta.device.owner_email}
              </p>
            )}

            {planMeta?.device?.plan_expires_at && (
              <p>
                <b>Hạn Premium:</b>{" "}
                {formatServerDateTime(planMeta.device.plan_expires_at)}
              </p>
            )}
          </section>

          {message && <p style={{ color: "red" }}>{message}</p>}

          <section
            style={{
              border:
                alerts.length > 0 ? "2px solid #dc2626" : "1px solid #86efac",
              padding: 16,
              borderRadius: 18,
              marginBottom: 24,
              background: alerts.length > 0 ? "#fff1f2" : "#f0fdf4",
            }}
          >
            <h2>Cảnh báo hệ thống</h2>

            {threshold ? (
              <p style={{ color: "#475569" }}>
                <b>Ngưỡng đang dùng:</b> nhiệt độ{" "}
                {threshold.temperature_min}–{threshold.temperature_max}°C, pH{" "}
                {threshold.ph_min}–{threshold.ph_max}, mực nước tối thiểu{" "}
                {threshold.water_level_min}%, pin tối thiểu{" "}
                {threshold.battery_min}%, RSSI tối thiểu {threshold.rssi_min}{" "}
                dBm.
              </p>
            ) : (
              <p style={{ color: "#475569" }}>
                Đang dùng ngưỡng mặc định: nhiệt độ 22–30°C, pH 6.5–8.0,
                mực nước tối thiểu 50%, pin tối thiểu 20%, RSSI tối thiểu -80
                dBm.
              </p>
            )}

            {alerts.length === 0 && (
              <p style={{ color: "green", fontWeight: "bold" }}>
                Hệ thống đang ổn định, chưa phát hiện bất thường.
              </p>
            )}

            {alerts.length > 0 && (
              <ul>
                {alerts.map((alert, index) => (
                  <li key={index} style={{ color: "red", fontWeight: "bold" }}>
                    {alert}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Dữ liệu mới nhất</h2>

            {!sensorData && (
              <p>Chưa có dữ liệu cảm biến cho thiết bị này.</p>
            )}

            {sensorData && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(160px, 1fr))",
                  gap: 16,
                }}
              >
                <div style={metricCardStyle}>
                  <h3>Nhiệt độ</h3>
                  <p style={{ fontSize: 28 }}>
                    {formatMetric(sensorData.temperature, " °C", 2)}
                  </p>
                </div>

                <div style={metricCardStyle}>
                  <h3>pH</h3>
                  <p style={{ fontSize: 28 }}>
                    {formatMetric(sensorData.ph, "", 1)}
                  </p>
                </div>

                <div style={metricCardStyle}>
                  <h3>Mực nước</h3>
                  <p style={{ fontSize: 28 }}>
                    {formatMetric(sensorData.water_level, "%", 0)}
                  </p>
                </div>

                <div style={metricCardStyle}>
                  <h3>Pin</h3>
                  <p style={{ fontSize: 28 }}>
                    {formatMetric(sensorData.battery, "%", 0)}
                  </p>
                </div>

                <div style={metricCardStyle}>
                  <h3>RSSI</h3>
                  <p style={{ fontSize: 28 }}>
                    {formatMetric(sensorData.rssi, " dBm", 0)}
                  </p>
                </div>

                <div style={metricCardStyle}>
                  <h3>Cập nhật lúc</h3>
                  <p>{formatServerDateTime(sensorData.created_at)}</p>
                </div>
              </div>
            )}
          </section>

          <section style={{ marginTop: 32 }}>
            <h2>Biểu đồ lịch sử cảm biến</h2>

            {planMeta && (
              <p>
                Đang hiển thị <b>{historyData.length}</b> / tối đa{" "}
                <b>{planMeta.limit}</b> điểm theo quyền gói hiện tại.
              </p>
            )}

            {renderThresholdLegend()}

            {historyData.length === 0 && <p>Chưa có dữ liệu lịch sử.</p>}

            {historyData.length > 0 && (
              <>
                <div style={chartCardStyle}>
                  <h3>Nhiệt độ theo thời gian</h3>

                  <ChartContainer>
                    <LineChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />

                      <ReferenceLine
                        y={activeThreshold.temperature_min}
                        stroke="#2563eb"
                        strokeDasharray="6 6"
                        ifOverflow="extendDomain"
                        label={{
                          value: `Min ${activeThreshold.temperature_min}°C`,
                          position: "insideTopLeft",
                          fill: "#2563eb",
                          fontSize: 12,
                        }}
                      />

                      <ReferenceLine
                        y={activeThreshold.temperature_max}
                        stroke="#dc2626"
                        strokeDasharray="6 6"
                        ifOverflow="extendDomain"
                        label={{
                          value: `Max ${activeThreshold.temperature_max}°C`,
                          position: "insideTopLeft",
                          fill: "#dc2626",
                          fontSize: 12,
                        }}
                      />

                      <Line
                        type="monotone"
                        dataKey="temperature"
                        name="Nhiệt độ"
                        stroke="#0891b2"
                        strokeWidth={2.4}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    </LineChart>
                  </ChartContainer>
                </div>

                <div style={chartCardStyle}>
                  <h3>pH theo thời gian</h3>

                  <ChartContainer>
                    <LineChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                      <XAxis dataKey="time" />
                      <YAxis domain={[0, 14]} />
                      <Tooltip />

                      <ReferenceLine
                        y={activeThreshold.ph_min}
                        stroke="#2563eb"
                        strokeDasharray="6 6"
                        ifOverflow="extendDomain"
                        label={{
                          value: `pH min ${activeThreshold.ph_min}`,
                          position: "insideTopLeft",
                          fill: "#2563eb",
                          fontSize: 12,
                        }}
                      />

                      <ReferenceLine
                        y={activeThreshold.ph_max}
                        stroke="#dc2626"
                        strokeDasharray="6 6"
                        ifOverflow="extendDomain"
                        label={{
                          value: `pH max ${activeThreshold.ph_max}`,
                          position: "insideTopLeft",
                          fill: "#dc2626",
                          fontSize: 12,
                        }}
                      />

                      <Line
                        type="monotone"
                        dataKey="ph"
                        name="pH"
                        stroke="#0891b2"
                        strokeWidth={2.4}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    </LineChart>
                  </ChartContainer>
                </div>

                <div style={chartCardStyle}>
                  <h3>Mực nước theo thời gian</h3>

                  <ChartContainer>
                    <LineChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                      <XAxis dataKey="time" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />

                      <ReferenceLine
                        y={activeThreshold.water_level_min}
                        stroke="#dc2626"
                        strokeDasharray="6 6"
                        ifOverflow="extendDomain"
                        label={{
                          value: `Min ${activeThreshold.water_level_min}%`,
                          position: "insideTopLeft",
                          fill: "#dc2626",
                          fontSize: 12,
                        }}
                      />

                      <Line
                        type="monotone"
                        dataKey="water_level"
                        name="Mực nước"
                        stroke="#0891b2"
                        strokeWidth={2.4}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    </LineChart>
                  </ChartContainer>
                </div>

                <div style={chartCardStyle}>
                  <h3>Pin theo thời gian</h3>

                  <ChartContainer>
                    <LineChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                      <XAxis dataKey="time" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />

                      <ReferenceLine
                        y={activeThreshold.battery_min}
                        stroke="#dc2626"
                        strokeDasharray="6 6"
                        ifOverflow="extendDomain"
                        label={{
                          value: `Min ${activeThreshold.battery_min}%`,
                          position: "insideTopLeft",
                          fill: "#dc2626",
                          fontSize: 12,
                        }}
                      />

                      <Line
                        type="monotone"
                        dataKey="battery"
                        name="Pin"
                        stroke="#0891b2"
                        strokeWidth={2.4}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    </LineChart>
                  </ChartContainer>
                </div>

                <div style={chartCardStyle}>
                  <h3>RSSI theo thời gian</h3>

                  <ChartContainer>
                    <LineChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />

                      <ReferenceLine
                        y={activeThreshold.rssi_min}
                        stroke="#dc2626"
                        strokeDasharray="6 6"
                        ifOverflow="extendDomain"
                        label={{
                          value: `Min ${activeThreshold.rssi_min} dBm`,
                          position: "insideTopLeft",
                          fill: "#dc2626",
                          fontSize: 12,
                        }}
                      />

                      <Line
                        type="monotone"
                        dataKey="rssi"
                        name="RSSI"
                        stroke="#0891b2"
                        strokeWidth={2.4}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}