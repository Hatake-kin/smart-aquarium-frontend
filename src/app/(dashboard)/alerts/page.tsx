"use client";

import { useEffect, useState } from "react";

type AlertItem = {
  id: number;
  tank_id: number;
  device_id: number | null;
  message: string;
  alert_type: string | null;
  current_value: number | null;
  threshold_value: number | null;
  severity: "low" | "medium" | "high";
  is_read: number;
  status: "new" | "resolved";
  resolved_at: string | null;
  resolved_by: number | null;
  created_at: string;
  updated_at: string;
  tank_name: string | null;
  tank_code: string | null;
  device_code: string | null;
  device_name: string | null;
  owner_id: number | null;
  owner_email: string | null;
  owner_full_name: string | null;
  resolved_by_email: string | null;
  resolved_by_name: string | null;
};

type Summary = {
  total: number;
  new_count: number;
  resolved_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
};

export default function AlertsPage() {
  const API_URL = "http://localhost:5000";

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [message, setMessage] = useState("");

  const getToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("token") || "";
  };

  const loadAlerts = async () => {
    try {
      const token = getToken();

      const params = new URLSearchParams();

      if (statusFilter) {
        params.append("status", statusFilter);
      }

      if (severityFilter) {
        params.append("severity", severityFilter);
      }

      params.append("limit", "100");

      const res = await fetch(`${API_URL}/api/alerts?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Không lấy được lịch sử cảnh báo");
        return;
      }

      setAlerts(data.alerts || []);
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const loadSummary = async () => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/alerts/summary/counts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        console.warn(data.message || "Không lấy được thống kê cảnh báo");
        return;
      }

      setSummary(data.summary || null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAlerts();
    loadSummary();
  }, [statusFilter, severityFilter]);

  const actionAlert = async (
    alertId: number,
    action: "read" | "resolve" | "reopen"
  ) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/alerts/${alertId}/${action}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Thao tác thất bại");
        return;
      }

      setMessage(data.message || "Thao tác thành công");
      loadAlerts();
      loadSummary();
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const getSeverityColor = (severity: string) => {
    if (severity === "high") return "#dc2626";
    if (severity === "medium") return "#d97706";
    return "#2563eb";
  };

  const getStatusColor = (status: string) => {
    if (status === "resolved") return "#16a34a";
    return "#dc2626";
  };

  const getAlertTypeLabel = (type: string | null) => {
    const map: Record<string, string> = {
      temperature_high: "Nhiệt độ cao",
      temperature_low: "Nhiệt độ thấp",
      ph_high: "pH cao",
      ph_low: "pH thấp",
      water_level_low: "Mực nước thấp",
      battery_low: "Pin yếu",
      rssi_low: "WiFi yếu",
    };

    if (!type) return "Khác";
    return map[type] || type;
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  const numberValue = (value: any) => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <main style={{ padding: 24, maxWidth: 1300 }}>
      <h1>Lịch sử cảnh báo</h1>

      <p>
        Trang này lưu lại các cảnh báo khi dữ liệu cảm biến vượt ngưỡng đã cài
        đặt. Admin/Moderator xem toàn bộ hệ thống, user chỉ xem cảnh báo của bể
        cá thuộc tài khoản mình.
      </p>

      {summary && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(120px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div style={cardStyle}>
            <h3>Tổng</h3>
            <p style={bigNumberStyle}>{numberValue(summary.total)}</p>
          </div>

          <div style={cardStyle}>
            <h3>Chưa xử lý</h3>
            <p style={{ ...bigNumberStyle, color: "#dc2626" }}>
              {numberValue(summary.new_count)}
            </p>
          </div>

          <div style={cardStyle}>
            <h3>Đã xử lý</h3>
            <p style={{ ...bigNumberStyle, color: "#16a34a" }}>
              {numberValue(summary.resolved_count)}
            </p>
          </div>

          <div style={cardStyle}>
            <h3>High</h3>
            <p style={{ ...bigNumberStyle, color: "#dc2626" }}>
              {numberValue(summary.high_count)}
            </p>
          </div>

          <div style={cardStyle}>
            <h3>Medium</h3>
            <p style={{ ...bigNumberStyle, color: "#d97706" }}>
              {numberValue(summary.medium_count)}
            </p>
          </div>

          <div style={cardStyle}>
            <h3>Low</h3>
            <p style={{ ...bigNumberStyle, color: "#2563eb" }}>
              {numberValue(summary.low_count)}
            </p>
          </div>
        </section>
      )}

      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
          background: "#fff",
        }}
      >
        <h2>Bộ lọc</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label>Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            >
              <option value="">Tất cả</option>
              <option value="new">Chưa xử lý</option>
              <option value="resolved">Đã xử lý</option>
            </select>
          </div>

          <div>
            <label>Mức độ</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            >
              <option value="">Tất cả</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              onClick={() => {
                loadAlerts();
                loadSummary();
              }}
              style={{ padding: "10px 16px" }}
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      {message && (
        <p
          style={{
            color:
              message.includes("thành công") ||
              message.includes("Đã") ||
              message.includes("Lấy")
                ? "green"
                : "red",
            fontWeight: "bold",
          }}
        >
          {message}
        </p>
      )}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <table
          cellPadding={8}
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th>ID</th>
              <th>Thời gian</th>
              <th>Bể cá</th>
              <th>Thiết bị</th>
              <th>Loại</th>
              <th>Nội dung</th>
              <th>Giá trị</th>
              <th>Ngưỡng</th>
              <th>Mức độ</th>
              <th>Trạng thái</th>
              <th>Xử lý</th>
            </tr>
          </thead>

          <tbody>
            {alerts.map((alert) => (
              <tr
                key={alert.id}
                style={{
                  borderTop: "1px solid #e5e7eb",
                  background:
                    alert.status === "new" && alert.severity === "high"
                      ? "#fff1f2"
                      : "#fff",
                }}
              >
                <td>{alert.id}</td>

                <td>{formatDate(alert.created_at)}</td>

                <td>
                  <b>{alert.tank_name || `Bể ${alert.tank_id}`}</b>
                  <br />
                  <span style={{ color: "#64748b" }}>
                    {alert.tank_code || ""}
                  </span>
                  {alert.owner_email && (
                    <>
                      <br />
                      <span style={{ color: "#64748b" }}>
                        {alert.owner_email}
                      </span>
                    </>
                  )}
                </td>

                <td>
                  {alert.device_name || "Thiết bị"}
                  <br />
                  <span style={{ color: "#64748b" }}>
                    {alert.device_code || `ID ${alert.device_id || "-"}`}
                  </span>
                </td>

                <td>{getAlertTypeLabel(alert.alert_type)}</td>

                <td style={{ minWidth: 260 }}>{alert.message}</td>

                <td>{alert.current_value ?? "-"}</td>

                <td>{alert.threshold_value ?? "-"}</td>

                <td>
                  <span
                    style={{
                      color: getSeverityColor(alert.severity),
                      fontWeight: "bold",
                    }}
                  >
                    {alert.severity}
                  </span>
                </td>

                <td>
                  <span
                    style={{
                      color: getStatusColor(alert.status),
                      fontWeight: "bold",
                    }}
                  >
                    {alert.status === "resolved" ? "Đã xử lý" : "Chưa xử lý"}
                  </span>

                  {alert.is_read ? (
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      Đã đọc
                    </div>
                  ) : (
                    <div style={{ color: "#dc2626", fontSize: 12 }}>
                      Chưa đọc
                    </div>
                  )}

                  {alert.resolved_at && (
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      {formatDate(alert.resolved_at)}
                    </div>
                  )}

                  {alert.resolved_by_email && (
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      bởi {alert.resolved_by_email}
                    </div>
                  )}
                </td>

                <td>
                  {!alert.is_read && (
                    <button
                      onClick={() => actionAlert(alert.id, "read")}
                      style={{ marginBottom: 6, display: "block" }}
                    >
                      Đã đọc
                    </button>
                  )}

                  {alert.status === "new" && (
                    <button
                      onClick={() => actionAlert(alert.id, "resolve")}
                      style={{
                        marginBottom: 6,
                        display: "block",
                        color: "green",
                      }}
                    >
                      Đã xử lý
                    </button>
                  )}

                  {alert.status === "resolved" && (
                    <button
                      onClick={() => actionAlert(alert.id, "reopen")}
                      style={{
                        marginBottom: 6,
                        display: "block",
                        color: "#b45309",
                      }}
                    >
                      Mở lại
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {alerts.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", padding: 24 }}>
                  Chưa có cảnh báo nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 16,
  background: "#fff",
};

const bigNumberStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: "bold",
  margin: 0,
};