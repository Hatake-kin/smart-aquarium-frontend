"use client";

import { useEffect, useState } from "react";

type Threshold = {
  tank_id: number;
  tank_code: string;
  tank_name: string;
  tank_status: string;
  owner_id: number;
  owner_email: string;
  owner_full_name: string | null;
  plan_type: "basic" | "premium";
  plan_expires_at: string | null;
  threshold_id: number | null;
  temperature_min: number;
  temperature_max: number;
  ph_min: number;
  ph_max: number;
  water_level_min: number;
  battery_min: number;
  rssi_min: number;
  updated_at: string | null;
  effective_plan: "basic" | "premium" | "manager";
  is_premium_expired: boolean;
  can_edit_threshold: boolean;
};

export default function ThresholdsPage() {
  const API_URL = "";

  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [editingTankId, setEditingTankId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  const getToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("token") || "";
  };

  const loadCurrentUser = () => {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem("user");
    if (raw) {
      setCurrentUser(JSON.parse(raw));
    }
  };

  const loadThresholds = async () => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/thresholds`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Không lấy được danh sách ngưỡng");
        return;
      }

      setThresholds(data.thresholds || []);
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadThresholds();
  }, []);

  const startEdit = (item: Threshold) => {
    setEditingTankId(item.tank_id);
    setForm({
      temperature_min: item.temperature_min,
      temperature_max: item.temperature_max,
      ph_min: item.ph_min,
      ph_max: item.ph_max,
      water_level_min: item.water_level_min,
      battery_min: item.battery_min,
      rssi_min: item.rssi_min,
    });
    setMessage("");
  };

  const cancelEdit = () => {
    setEditingTankId(null);
    setForm({});
  };

  const updateField = (key: string, value: string) => {
    setForm((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  const saveThreshold = async (tankId: number) => {
    try {
      const token = getToken();

      const body = {
        temperature_min: Number(form.temperature_min),
        temperature_max: Number(form.temperature_max),
        ph_min: Number(form.ph_min),
        ph_max: Number(form.ph_max),
        water_level_min: Number(form.water_level_min),
        battery_min: Number(form.battery_min),
        rssi_min: Number(form.rssi_min),
      };

      const res = await fetch(`${API_URL}/api/thresholds/${tankId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Cập nhật ngưỡng thất bại");
        return;
      }

      setMessage(data.message || "Cập nhật ngưỡng thành công");
      setEditingTankId(null);
      setForm({});
      loadThresholds();
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const getPlanLabel = (item: Threshold) => {
    if (item.effective_plan === "manager") return "Quản trị";
    if (item.is_premium_expired) return "Premium hết hạn";
    if (item.effective_plan === "premium") return "Premium";
    return "Basic";
  };

  const getPlanColor = (item: Threshold) => {
    if (item.effective_plan === "manager") return "#0f766e";
    if (item.is_premium_expired) return "#dc2626";
    if (item.effective_plan === "premium") return "#7c3aed";
    return "#2563eb";
  };

  const renderInput = (key: string, label: string, step = "0.1") => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontWeight: "bold" }}>{label}</label>
      <input
        type="number"
        step={step}
        value={form[key] ?? ""}
        onChange={(e) => updateField(key, e.target.value)}
        style={{
          width: "100%",
          padding: 8,
          border: "1px solid #ccc",
          borderRadius: 6,
          marginTop: 4,
        }}
      />
    </div>
  );

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1>Cài đặt ngưỡng cảnh báo</h1>

      <p>
        Basic dùng ngưỡng mặc định. Premium được chỉnh ngưỡng theo từng bể.
        Admin có thể chỉnh toàn bộ hệ thống.
      </p>

      {message && (
        <p
          style={{
            color:
              message.includes("thành công") || message.includes("Cập nhật")
                ? "green"
                : "red",
            fontWeight: "bold",
          }}
        >
          {message}
        </p>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {thresholds.map((item) => {
          const isEditing = editingTankId === item.tank_id;

          return (
            <section
              key={item.tank_id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 16,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2 style={{ marginTop: 0 }}>
                    {item.tank_name || `Bể ${item.tank_id}`}
                  </h2>

                  <p>
                    <b>Mã bể:</b> {item.tank_code}
                  </p>

                  <p>
                    <b>Chủ sở hữu:</b>{" "}
                    {item.owner_full_name || item.owner_email || item.owner_id}
                  </p>

                  <p>
                    <b>Gói:</b>{" "}
                    <span
                      style={{
                        color: getPlanColor(item),
                        fontWeight: "bold",
                      }}
                    >
                      {getPlanLabel(item)}
                    </span>
                  </p>

                  {item.plan_expires_at && (
                    <p>
                      <b>Hạn Premium:</b>{" "}
                      {new Date(item.plan_expires_at).toLocaleString()}
                    </p>
                  )}

                  {!item.can_edit_threshold && (
                    <p style={{ color: "#b45309", fontWeight: "bold" }}>
                      Không có quyền chỉnh ngưỡng. Cần Premium còn hiệu lực hoặc
                      quyền admin.
                    </p>
                  )}
                </div>

                <div>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(item)}
                      disabled={!item.can_edit_threshold}
                      style={{
                        padding: "10px 14px",
                        cursor: item.can_edit_threshold
                          ? "pointer"
                          : "not-allowed",
                      }}
                    >
                      Chỉnh ngưỡng
                    </button>
                  )}
                </div>
              </div>

              {!isEditing && (
                <table
                  border={1}
                  cellPadding={8}
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: 12,
                  }}
                >
                  <thead>
                    <tr>
                      <th>Nhiệt độ min</th>
                      <th>Nhiệt độ max</th>
                      <th>pH min</th>
                      <th>pH max</th>
                      <th>Mực nước min</th>
                      <th>Pin min</th>
                      <th>RSSI min</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>{item.temperature_min} °C</td>
                      <td>{item.temperature_max} °C</td>
                      <td>{item.ph_min}</td>
                      <td>{item.ph_max}</td>
                      <td>{item.water_level_min}%</td>
                      <td>{item.battery_min}%</td>
                      <td>{item.rssi_min} dBm</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {isEditing && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 16,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f8fafc",
                  }}
                >
                  <h3>Chỉnh ngưỡng cho {item.tank_name}</h3>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {renderInput("temperature_min", "Nhiệt độ tối thiểu °C")}
                    {renderInput("temperature_max", "Nhiệt độ tối đa °C")}
                    {renderInput("ph_min", "pH tối thiểu")}
                    {renderInput("ph_max", "pH tối đa")}
                    {renderInput("water_level_min", "Mực nước tối thiểu %")}
                    {renderInput("battery_min", "Pin tối thiểu %")}
                    {renderInput("rssi_min", "RSSI tối thiểu dBm", "1")}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <button
                      onClick={() => saveThreshold(item.tank_id)}
                      style={{
                        padding: "10px 16px",
                        marginRight: 8,
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      Lưu ngưỡng
                    </button>

                    <button
                      onClick={cancelEdit}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}

        {thresholds.length === 0 && (
          <section
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 16,
              background: "#fff",
            }}
          >
            Chưa có bể cá nào để cấu hình ngưỡng.
          </section>
        )}
      </div>
    </main>
  );
}