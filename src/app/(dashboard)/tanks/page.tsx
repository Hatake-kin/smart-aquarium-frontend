"use client";

import { useEffect, useState } from "react";

type Tank = {
  id: number;
  user_id: number;
  tank_code: string;
  name: string;
  package_type: "basic" | "premium";
  status?: string;
  access_status?: string;
  created_at: string;
  updated_at?: string;
  email?: string;
  full_name?: string;
};

type DeletePreview = {
  tank: {
    id: number;
    user_id: number;
    tank_code: string;
    name: string;
    package_type: string;
    status: string;
    created_at?: string;
    owner: {
      id: number;
      email?: string;
      full_name?: string;
      role?: string;
    };
  };
  can_delete: boolean;
  permission_note: string;
  summary: {
    devices: number;
    sensor_data: number;
    actuator_states: number;
    alerts: number;
    alert_thresholds: number;
    camera_snapshots: number;
    device_modules: number;
  };
  details: {
    devices: any[];
    sensor_data_by_device: any[];
    actuator_states: any[];
    alerts_by_type: any[];
    latest_alerts: any[];
    thresholds: any[];
    camera_snapshots: {
      table_exists: boolean;
      count: number;
      details: any[];
    };
    device_modules: {
      table_exists: boolean;
      count: number;
      details: any[];
    };
  };
};

export default function TanksPage() {
  const API_URL = "";

  const [tanks, setTanks] = useState<Tank[]>([]);
  const [name, setName] = useState("");
  const [packageType, setPackageType] = useState<"basic" | "premium">("basic");
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

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

  const loadTanks = async () => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/tanks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Không lấy được danh sách bể cá");
        return;
      }

      setTanks(data.tanks || []);
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadTanks();
  }, []);

  const handleCreateTank = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!name.trim()) {
      setMessage("Vui lòng nhập tên bể cá");
      return;
    }

    try {
      const token = getToken();

      const body: any = {
        name: name.trim(),
      };

      if (currentUser?.role === "admin") {
        body.package_type = packageType;
      }

      const res = await fetch(`${API_URL}/api/tanks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Tạo bể cá thất bại");
        return;
      }

      setMessage("Tạo bể cá thành công");
      setName("");
      setPackageType("basic");

      loadTanks();
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const canDeleteTank = (tank: Tank) => {
    if (currentUser?.role === "admin") return true;
    if (currentUser?.role === "moderator") return false;
    return Number(tank.user_id) === Number(currentUser?.id);
  };

  const openDeletePreview = async (tank: Tank) => {
    try {
      setDeletePreview(null);
      setDeleteMessage("");
      setDeleteConfirmed(false);
      setExpandedSections({});
      setIsPreviewLoading(true);

      const token = getToken();

      const res = await fetch(`${API_URL}/api/tanks/${tank.id}/delete-preview`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteMessage(data.message || "Không lấy được preview xóa bể");
        return;
      }

      setDeletePreview(data);
    } catch (err) {
      console.error(err);
      setDeleteMessage("Không kết nối được backend");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;

    setDeletePreview(null);
    setDeleteMessage("");
    setDeleteConfirmed(false);
    setExpandedSections({});
    setIsPreviewLoading(false);
  };

  const handleDeleteTank = async () => {
    if (!deletePreview || !deleteConfirmed) return;

    try {
      setIsDeleting(true);
      setDeleteMessage("");

      const token = getToken();

      const res = await fetch(
        `${API_URL}/api/tanks/${deletePreview.tank.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setDeleteMessage(data.message || "Xóa bể cá thất bại");
        return;
      }

      setMessage("Xóa bể cá thành công");
      closeDeleteModal();
      await loadTanks();
    } catch (err) {
      console.error(err);
      setDeleteMessage("Không kết nối được backend");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "Không có";

    try {
      return new Date(value).toLocaleString("vi-VN", { hour12: false });
    } catch {
      return value;
    }
  };

  const isAdmin = currentUser?.role === "admin";

  const renderAccordion = (
    key: string,
    title: string,
    count: number,
    children: React.ReactNode
  ) => {
    const isOpen = Boolean(expandedSections[key]);

    return (
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          marginBottom: 10,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <button
          type="button"
          onClick={() => toggleSection(key)}
          style={{
            width: "100%",
            border: "none",
            background: "#f8fafc",
            padding: "12px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            fontWeight: "bold",
            color: "#0f172a",
          }}
        >
          <span>
            {isOpen ? "−" : "+"} {title}
          </span>
          <span
            style={{
              background: count > 0 ? "#fee2e2" : "#e2e8f0",
              color: count > 0 ? "#dc2626" : "#475569",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 12,
            }}
          >
            {count}
          </span>
        </button>

        {isOpen && (
          <div
            style={{
              padding: 14,
              color: "#334155",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <main style={{ padding: 24, maxWidth: 1150 }}>
      <h1>Bể cá của tôi</h1>

      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
          background: "#fff",
        }}
      >
        <h2>Tạo bể cá mới</h2>

        <form onSubmit={handleCreateTank}>
          <div style={{ marginBottom: 12 }}>
            <label>Tên bể cá</label>
            <br />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bể cá phòng khách"
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          {isAdmin ? (
            <div style={{ marginBottom: 12 }}>
              <label>Gói sử dụng</label>
              <br />
              <select
                value={packageType}
                onChange={(e) =>
                  setPackageType(e.target.value as "basic" | "premium")
                }
                style={{ width: "100%", padding: 8 }}
              >
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
              </select>

              <p style={{ marginTop: 8, color: "#555" }}>
                {packageType === "basic"
                  ? "Basic: gói mặc định, tối đa 1 bể cho user thường, tối đa 3 thiết bị/bể, biểu đồ 20 điểm."
                  : "Premium: gói nâng cấp do admin cấp, nhiều bể, nhiều thiết bị, biểu đồ 100 điểm, hỗ trợ camera/cảnh báo nâng cao."}
              </p>
            </div>
          ) : (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                background: "#eef6ff",
                borderRadius: 8,
              }}
            >
              <b>Gói hiện tại khi tạo bể: Basic</b>
              <p style={{ margin: "8px 0 0", color: "#555" }}>
                Người dùng thường không thể tự chọn Premium. Vui lòng liên hệ
                admin để nâng cấp gói.
              </p>
            </div>
          )}

          <button type="submit" style={{ padding: "10px 16px" }}>
            Tạo bể cá
          </button>
        </form>

        {message && (
          <p
            style={{
              color:
                message.includes("thất bại") ||
                message.includes("Không") ||
                message.includes("không") ||
                message.includes("chỉ cho phép")
                  ? "red"
                  : "green",
              fontWeight: "bold",
            }}
          >
            {message}
          </p>
        )}
      </section>

      <section>
        <h2>Danh sách bể cá</h2>

        <table
          border={1}
          cellPadding={8}
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
          }}
        >
          <thead>
            <tr>
              <th>ID</th>
              <th>Mã bể</th>
              <th>Tên bể</th>
              <th>Gói</th>
              <th>Người sở hữu</th>
              <th>Ngày tạo</th>
              <th>Hành động</th>
            </tr>
          </thead>

          <tbody>
            {tanks.map((tank) => (
              <tr key={tank.id}>
                <td>{tank.id}</td>
                <td>{tank.tank_code}</td>
                <td>{tank.name}</td>
                <td>
                  <span
                    style={{
                      fontWeight: "bold",
                      color:
                        tank.package_type === "premium" ? "#7c3aed" : "#2563eb",
                    }}
                  >
                    {tank.package_type}
                  </span>
                </td>
                <td>{tank.full_name || tank.email || tank.user_id}</td>
                <td>{formatDate(tank.created_at)}</td>
                <td>
                  {canDeleteTank(tank) ? (
                    <button
                      onClick={() => openDeletePreview(tank)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #fecdd3",
                        background: "#fff1f2",
                        color: "#dc2626",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      Xóa
                    </button>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>Không có quyền</span>
                  )}
                </td>
              </tr>
            ))}

            {tanks.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center" }}>
                  Chưa có bể cá nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {(deletePreview || isPreviewLoading || deleteMessage) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "min(760px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 20,
              padding: 22,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#dc2626" }}>
              Xác nhận xóa bể cá
            </h2>

            {isPreviewLoading && <p>Đang tải thông tin sẽ bị xóa...</p>}

            {deleteMessage && (
              <p style={{ color: "#dc2626", fontWeight: "bold" }}>
                {deleteMessage}
              </p>
            )}

            {deletePreview && (
              <>
                <div
                  style={{
                    border: "1px solid #fecdd3",
                    background: "#fff1f2",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <p style={{ margin: "4px 0" }}>
                    <b>Bể:</b> {deletePreview.tank.name}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    <b>Mã bể:</b> {deletePreview.tank.tank_code}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    <b>Chủ bể:</b>{" "}
                    {deletePreview.tank.owner.full_name ||
                      deletePreview.tank.owner.email ||
                      deletePreview.tank.owner.id}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    <b>Quyền xóa:</b> {deletePreview.permission_note}
                  </p>

                  {isAdmin &&
                    Number(deletePreview.tank.user_id) !==
                      Number(currentUser?.id) && (
                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "#b45309",
                          fontWeight: "bold",
                        }}
                      >
                        Bạn đang xóa bể của user khác.
                      </p>
                    )}
                </div>

                <p style={{ fontWeight: "bold", color: "#dc2626" }}>
                  Hành động này sẽ xóa vĩnh viễn các dữ liệu bên dưới và không
                  thể khôi phục.
                </p>

                {renderAccordion(
                  "devices",
                  "Thiết bị sẽ bị xóa",
                  deletePreview.summary.devices,
                  deletePreview.details.devices.length > 0 ? (
                    <div>
                      {deletePreview.details.devices.map((device) => (
                        <div
                          key={device.id}
                          style={{
                            padding: 10,
                            border: "1px solid #e2e8f0",
                            borderRadius: 12,
                            marginBottom: 8,
                          }}
                        >
                          <b>
                            {device.name || "Không tên"} #{device.id}
                          </b>
                          <p style={{ margin: "4px 0" }}>
                            Mã: {device.device_code || "Không có"}
                          </p>
                          <p style={{ margin: "4px 0" }}>
                            Trạng thái: {device.status || "Không rõ"}
                          </p>
                          <p style={{ margin: "4px 0" }}>
                            Last seen: {formatDate(device.last_seen)}
                          </p>
                          <p style={{ margin: "4px 0" }}>
                            Sensor data: {device.sensor_data_count || 0} bản ghi
                            | Actuator state:{" "}
                            {device.actuator_state_count || 0} | Alerts:{" "}
                            {device.alert_count || 0}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Không có thiết bị liên quan.</p>
                  )
                )}

                {renderAccordion(
                  "sensor_data",
                  "Dữ liệu cảm biến sẽ bị xóa",
                  deletePreview.summary.sensor_data,
                  deletePreview.details.sensor_data_by_device.length > 0 ? (
                    <div>
                      {deletePreview.details.sensor_data_by_device.map(
                        (item) => (
                          <div
                            key={item.device_id}
                            style={{
                              padding: 10,
                              border: "1px solid #e2e8f0",
                              borderRadius: 12,
                              marginBottom: 8,
                            }}
                          >
                            <b>
                              {item.device_name || "Thiết bị"} #
                              {item.device_id}
                            </b>
                            <p style={{ margin: "4px 0" }}>
                              Mã: {item.device_code || "Không có"}
                            </p>
                            <p style={{ margin: "4px 0" }}>
                              Số bản ghi: {item.count || 0}
                            </p>
                            <p style={{ margin: "4px 0" }}>
                              Từ: {formatDate(item.first_created_at)}
                            </p>
                            <p style={{ margin: "4px 0" }}>
                              Đến: {formatDate(item.last_created_at)}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p>Không có dữ liệu cảm biến.</p>
                  )
                )}

                {renderAccordion(
                  "actuator_states",
                  "Trạng thái điều khiển sẽ bị xóa",
                  deletePreview.summary.actuator_states,
                  deletePreview.details.actuator_states.length > 0 ? (
                    <div>
                      {deletePreview.details.actuator_states.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: 10,
                            border: "1px solid #e2e8f0",
                            borderRadius: 12,
                            marginBottom: 8,
                          }}
                        >
                          <b>
                            {item.device_name || "Thiết bị"} #{item.device_id}
                          </b>
                          <p style={{ margin: "4px 0" }}>
                            Pump: {item.pump ? "ON" : "OFF"} | Light:{" "}
                            {item.light ? "ON" : "OFF"} | Oxygen:{" "}
                            {item.oxygen ? "ON" : "OFF"} | Auto:{" "}
                            {item.auto_mode ? "ON" : "OFF"}
                          </p>
                          <p style={{ margin: "4px 0" }}>
                            Lệnh cuối: {formatDate(item.last_command_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Không có trạng thái điều khiển.</p>
                  )
                )}

                {renderAccordion(
                  "alerts",
                  "Cảnh báo sẽ bị xóa",
                  deletePreview.summary.alerts,
                  <>
                    {deletePreview.details.alerts_by_type.length > 0 ? (
                      <div style={{ marginBottom: 12 }}>
                        <b>Nhóm theo loại cảnh báo</b>
                        {deletePreview.details.alerts_by_type.map(
                          (item, index) => (
                            <p key={`${item.alert_type}_${index}`}>
                              - {item.alert_type || "unknown"} /{" "}
                              {item.severity || "unknown"}: {item.count} cảnh báo
                            </p>
                          )
                        )}
                      </div>
                    ) : (
                      <p>Không có cảnh báo.</p>
                    )}

                    {deletePreview.details.latest_alerts.length > 0 && (
                      <div>
                        <b>5 cảnh báo gần nhất</b>
                        {deletePreview.details.latest_alerts.map((alert) => (
                          <div
                            key={alert.id}
                            style={{
                              padding: 10,
                              border: "1px solid #e2e8f0",
                              borderRadius: 12,
                              marginTop: 8,
                            }}
                          >
                            <p style={{ margin: "4px 0" }}>
                              <b>{alert.alert_type}</b> - {alert.severity}
                            </p>
                            <p style={{ margin: "4px 0" }}>{alert.message}</p>
                            <p style={{ margin: "4px 0" }}>
                              {formatDate(alert.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {renderAccordion(
                  "thresholds",
                  "Cấu hình ngưỡng sẽ bị xóa",
                  deletePreview.summary.alert_thresholds,
                  deletePreview.details.thresholds.length > 0 ? (
                    <div>
                      {deletePreview.details.thresholds.map((item, index) => (
                        <pre
                          key={index}
                          style={{
                            background: "#f8fafc",
                            padding: 10,
                            borderRadius: 12,
                            overflowX: "auto",
                          }}
                        >
                          {JSON.stringify(item, null, 2)}
                        </pre>
                      ))}
                    </div>
                  ) : (
                    <p>Không có cấu hình ngưỡng.</p>
                  )
                )}

                {renderAccordion(
                  "snapshots",
                  "Camera snapshot sẽ bị xóa",
                  deletePreview.summary.camera_snapshots,
                  deletePreview.details.camera_snapshots.table_exists ? (
                    deletePreview.details.camera_snapshots.details.length > 0 ? (
                      <pre
                        style={{
                          background: "#f8fafc",
                          padding: 10,
                          borderRadius: 12,
                          overflowX: "auto",
                        }}
                      >
                        {JSON.stringify(
                          deletePreview.details.camera_snapshots.details,
                          null,
                          2
                        )}
                      </pre>
                    ) : (
                      <p>Không có camera snapshot liên quan.</p>
                    )
                  ) : (
                    <p>Bảng camera_snapshots hiện chưa tồn tại.</p>
                  )
                )}

                {renderAccordion(
                  "modules",
                  "Module GPIO/Wireless sẽ bị xóa",
                  deletePreview.summary.device_modules,
                  deletePreview.details.device_modules.table_exists ? (
                    deletePreview.details.device_modules.details.length > 0 ? (
                      <pre
                        style={{
                          background: "#f8fafc",
                          padding: 10,
                          borderRadius: 12,
                          overflowX: "auto",
                        }}
                      >
                        {JSON.stringify(
                          deletePreview.details.device_modules.details,
                          null,
                          2
                        )}
                      </pre>
                    ) : (
                      <p>Không có module liên quan.</p>
                    )
                  ) : (
                    <p>Bảng device_modules hiện chưa tồn tại.</p>
                  )
                )}

                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: 12,
                    border: "1px solid #fecdd3",
                    background: "#fff1f2",
                    borderRadius: 14,
                    marginTop: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={deleteConfirmed}
                    onChange={(e) => setDeleteConfirmed(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    Tôi hiểu rằng bể cá và toàn bộ dữ liệu liên quan sẽ bị xóa
                    vĩnh viễn, không thể khôi phục.
                  </span>
                </label>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    marginTop: 18,
                  }}
                >
                  <button
                    onClick={closeDeleteModal}
                    disabled={isDeleting}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      cursor: isDeleting ? "not-allowed" : "pointer",
                    }}
                  >
                    Hủy
                  </button>

                  <button
                    onClick={handleDeleteTank}
                    disabled={!deleteConfirmed || isDeleting}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #dc2626",
                      background:
                        !deleteConfirmed || isDeleting ? "#fecaca" : "#dc2626",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor:
                        !deleteConfirmed || isDeleting
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {isDeleting ? "Đang xóa..." : "Xóa vĩnh viễn bể cá"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}