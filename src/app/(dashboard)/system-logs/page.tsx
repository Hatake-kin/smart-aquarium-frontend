"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type SystemLog = {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type Summary = {
  total: number;
  actions: {
    action: string;
    total: number;
  }[];
  entities: {
    entity_type: string;
    total: number;
  }[];
};

export default function SystemLogsPage() {
  const API_URL = "http://localhost:5000";

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");

  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");

  const getToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("token") || "";
  };

  const loadLogs = async () => {
    try {
      const token = getToken();

      const params = new URLSearchParams();

      if (actionFilter.trim()) {
        params.append("action", actionFilter.trim());
      }

      if (entityTypeFilter.trim()) {
        params.append("entity_type", entityTypeFilter.trim());
      }

      if (userIdFilter.trim()) {
        params.append("user_id", userIdFilter.trim());
      }

      params.append("limit", "100");

      const res = await fetch(
        `${API_URL}/api/system-logs?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Không lấy được nhật ký hệ thống");
        return;
      }

      setLogs(data.logs || []);
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const loadSummary = async () => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/system-logs/summary/counts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        console.warn(data.message || "Không lấy được thống kê nhật ký");
        return;
      }

      setSummary(data.summary || null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadLogs();
    loadSummary();
  }, []);

  const applyFilter = () => {
    loadLogs();
  };

  const clearFilter = () => {
    setActionFilter("");
    setEntityTypeFilter("");
    setUserIdFilter("");

    setTimeout(() => {
      loadLogs();
    }, 0);
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  const getActionColor = (action: string) => {
    if (action.includes("failed")) return "#dc2626";
    if (action.includes("success")) return "#16a34a";
    if (action.includes("admin")) return "#7c3aed";
    if (action.includes("update")) return "#2563eb";
    return "#475569";
  };

  const shortUserAgent = (ua: string | null) => {
    if (!ua) return "-";
    if (ua.length <= 80) return ua;
    return ua.slice(0, 80) + "...";
  };

  return (
    <main style={{ padding: 24, maxWidth: 1300 }}>
      <h1>Nhật ký hệ thống</h1>

      <p>
        Trang này ghi lại các thao tác quan trọng như đăng nhập, xác thực OTP,
        tạo bể, tạo thiết bị, đổi gói Premium, cập nhật camera và cập nhật
        ngưỡng cảnh báo.
      </p>

      {summary && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div style={cardStyle}>
            <h3>Tổng nhật ký</h3>
            <p style={bigNumberStyle}>{Number(summary.total || 0)}</p>
          </div>

          <div style={cardStyle}>
            <h3>Action nhiều nhất</h3>
            <p style={{ margin: 0 }}>
              {summary.actions?.[0]?.action || "Chưa có"}
            </p>
            <p style={smallTextStyle}>
              {summary.actions?.[0]?.total || 0} lần
            </p>
          </div>

          <div style={cardStyle}>
            <h3>Đối tượng nhiều nhất</h3>
            <p style={{ margin: 0 }}>
              {summary.entities?.[0]?.entity_type || "Chưa có"}
            </p>
            <p style={smallTextStyle}>
              {summary.entities?.[0]?.total || 0} lần
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
            gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label>Action</label>
            <input
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="VD: login_success"
              style={inputStyle}
            />
          </div>

          <div>
            <label>Entity type</label>
            <input
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              placeholder="VD: user, tank, device"
              style={inputStyle}
            />
          </div>

          <div>
            <label>User ID</label>
            <input
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              placeholder="VD: 3"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
            <button onClick={applyFilter} style={{ padding: "10px 16px" }}>
              Lọc
            </button>

            <button onClick={clearFilter} style={{ padding: "10px 16px" }}>
              Xóa lọc
            </button>
          </div>
        </div>

        {summary?.actions && summary.actions.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <b>Action phổ biến:</b>{" "}
            {summary.actions.slice(0, 8).map((item) => (
              <button
                key={item.action}
                onClick={() => {
                  setActionFilter(item.action);
                  setTimeout(loadLogs, 0);
                }}
                style={{
                  margin: "4px",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                }}
              >
                {item.action} ({item.total})
              </button>
            ))}
          </div>
        )}
      </section>

      {message && (
        <p
          style={{
            color:
              message.includes("thành công") || message.includes("Lấy")
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
              <th>Người thao tác</th>
              <th>Action</th>
              <th>Đối tượng</th>
              <th>Mô tả</th>
              <th>IP</th>
              <th>User Agent</th>
            </tr>
          </thead>

          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                style={{
                  borderTop: "1px solid #e5e7eb",
                  background: log.action.includes("failed")
                    ? "#fff1f2"
                    : "#fff",
                }}
              >
                <td>{log.id}</td>

                <td>{formatDate(log.created_at)}</td>

                <td>
                  {log.email ? (
                    <>
                      <b>{log.full_name || log.email}</b>
                      <br />
                      <span style={smallTextStyle}>{log.email}</span>
                      <br />
                      <span style={smallTextStyle}>ID {log.user_id}</span>
                      {log.role && (
                        <>
                          <br />
                          <span style={smallTextStyle}>{log.role}</span>
                        </>
                      )}
                    </>
                  ) : (
                    <span style={smallTextStyle}>Không xác định</span>
                  )}
                </td>

                <td>
                  <span
                    style={{
                      color: getActionColor(log.action),
                      fontWeight: "bold",
                    }}
                  >
                    {log.action}
                  </span>
                </td>

                <td>
                  {log.entity_type || "-"}
                  {log.entity_id && (
                    <>
                      <br />
                      <span style={smallTextStyle}>ID {log.entity_id}</span>
                    </>
                  )}
                </td>

                <td style={{ minWidth: 320 }}>{log.description || "-"}</td>

                <td>{log.ip_address || "-"}</td>

                <td style={{ maxWidth: 260 }}>
                  <span style={smallTextStyle}>
                    {shortUserAgent(log.user_agent)}
                  </span>
                </td>
              </tr>
            ))}

            {logs.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 24 }}>
                  Chưa có nhật ký hệ thống.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 16,
  background: "#fff",
};

const bigNumberStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: "bold",
  margin: 0,
};

const smallTextStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 8,
  marginTop: 4,
  border: "1px solid #ccc",
  borderRadius: 6,
};