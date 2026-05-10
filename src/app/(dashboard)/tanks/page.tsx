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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

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

      const res = await fetch(API_URL + "/api/tanks", {
        headers: {
          Authorization: "Bearer " + token,
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

      const res = await fetch(API_URL + "/api/tanks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
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

      const res = await fetch(
        API_URL + "/api/tanks/" + tank.id + "/delete-preview",
        {
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

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

      const res = await fetch(API_URL + "/api/tanks/" + deletePreview.tank.id, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token,
        },
      });

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

  const isErrorMessage =
    message.includes("thất bại") ||
    message.includes("Không") ||
    message.includes("không") ||
    message.includes("chỉ cho phép");

  const renderAccordion = (
    key: string,
    title: string,
    count: number,
    children: React.ReactNode
  ) => {
    const isOpen = Boolean(expandedSections[key]);

    return (
      <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => toggleSection(key)}
          className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left font-black text-slate-800"
        >
          <span>
            {isOpen ? "−" : "+"} {title}
          </span>
          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-black",
              count > 0 ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-600",
            ].join(" ")}
          >
            {count}
          </span>
        </button>

        {isOpen && <div className="p-4 text-sm leading-6 text-slate-700">{children}</div>}
      </div>
    );
  };

  const renderDeleteButton = (tank: Tank) => {
    if (!canDeleteTank(tank)) {
      return <span className="text-sm font-bold text-slate-400">Không có quyền</span>;
    }

    return (
      <button
        onClick={() => openDeletePreview(tank)}
        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-600 transition hover:bg-red-100"
      >
        Xóa
      </button>
    );
  };

  const packageBadge = (value: string) => (
    <span
      className={[
        "rounded-full px-3 py-1 text-xs font-black uppercase",
        value === "premium"
          ? "bg-violet-50 text-violet-700"
          : "bg-blue-50 text-blue-700",
      ].join(" ")}
    >
      {value}
    </span>
  );

  return (
    <main className="w-full max-w-6xl px-0 md:px-2">
      <h1 className="mb-4 text-2xl font-black text-slate-800">Bể cá của tôi</h1>

      <section className="mb-6 rounded-3xl border border-pink-200 bg-white p-4 shadow-sm shadow-pink-100/50 md:p-6">
        <h2 className="mb-4 text-xl font-black text-slate-800">Tạo bể cá mới</h2>

        <form onSubmit={handleCreateTank} className="space-y-4">
          <div>
            <label className="mb-2 block font-bold text-pink-900">Tên bể cá</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bể cá phòng khách"
              className="w-full rounded-2xl border border-pink-300 px-4 py-3 outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-100"
            />
          </div>

          {isAdmin ? (
            <div>
              <label className="mb-2 block font-bold text-pink-900">
                Gói sử dụng
              </label>
              <select
                value={packageType}
                onChange={(e) =>
                  setPackageType(e.target.value as "basic" | "premium")
                }
                className="w-full rounded-2xl border border-pink-300 px-4 py-3 outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-100"
              >
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
              </select>

              <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                {packageType === "basic"
                  ? "Basic: gói mặc định, tối đa 1 bể cho user thường, tối đa 3 thiết bị/bể, biểu đồ 20 điểm."
                  : "Premium: gói nâng cấp do admin cấp, nhiều bể, nhiều thiết bị, biểu đồ 100 điểm, hỗ trợ camera/cảnh báo nâng cao."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <b className="text-cyan-900">Gói hiện tại khi tạo bể: Basic</b>
              <p className="mt-2 text-sm font-semibold text-cyan-800">
                Người dùng thường không thể tự chọn Premium. Vui lòng liên hệ
                admin để nâng cấp gói.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="rounded-2xl border border-pink-400 px-5 py-3 font-black text-pink-700 transition hover:bg-pink-50 active:scale-95"
          >
            Tạo bể cá
          </button>
        </form>

        {message && (
          <p
            className={[
              "mt-4 rounded-2xl border p-3 font-black",
              isErrorMessage
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-green-200 bg-green-50 text-green-700",
            ].join(" ")}
          >
            {message}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-pink-200 bg-white p-4 shadow-sm shadow-pink-100/50 md:p-6">
        <h2 className="mb-4 text-xl font-black text-slate-800">Danh sách bể cá</h2>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[850px] border-collapse overflow-hidden rounded-2xl bg-white text-sm">
            <thead>
              <tr className="bg-pink-50 text-pink-900">
                <th className="border border-pink-100 p-3 text-left">ID</th>
                <th className="border border-pink-100 p-3 text-left">Mã bể</th>
                <th className="border border-pink-100 p-3 text-left">Tên bể</th>
                <th className="border border-pink-100 p-3 text-left">Gói</th>
                <th className="border border-pink-100 p-3 text-left">
                  Người sở hữu
                </th>
                <th className="border border-pink-100 p-3 text-left">
                  Ngày tạo
                </th>
                <th className="border border-pink-100 p-3 text-left">
                  Hành động
                </th>
              </tr>
            </thead>

            <tbody>
              {tanks.map((tank) => (
                <tr key={tank.id} className="hover:bg-slate-50">
                  <td className="border border-pink-100 p-3">{tank.id}</td>
                  <td className="border border-pink-100 p-3 font-bold">
                    {tank.tank_code}
                  </td>
                  <td className="border border-pink-100 p-3">{tank.name}</td>
                  <td className="border border-pink-100 p-3">
                    {packageBadge(tank.package_type)}
                  </td>
                  <td className="border border-pink-100 p-3">
                    {tank.full_name || tank.email || tank.user_id}
                  </td>
                  <td className="border border-pink-100 p-3">
                    {formatDate(tank.created_at)}
                  </td>
                  <td className="border border-pink-100 p-3">
                    {renderDeleteButton(tank)}
                  </td>
                </tr>
              ))}

              {tanks.length === 0 && (
                <tr>
                  <td colSpan={7} className="border border-pink-100 p-6 text-center">
                    Chưa có bể cá nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {tanks.map((tank) => (
            <article
              key={tank.id}
              className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-800">{tank.name}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    ID #{tank.id} · {tank.tank_code}
                  </p>
                </div>
                {packageBadge(tank.package_type)}
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  <b>Người sở hữu:</b>{" "}
                  {tank.full_name || tank.email || tank.user_id}
                </p>
                <p>
                  <b>Ngày tạo:</b> {formatDate(tank.created_at)}
                </p>
              </div>

              <div className="mt-4">{renderDeleteButton(tank)}</div>
            </article>
          ))}

          {tanks.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center font-semibold text-slate-500">
              Chưa có bể cá nào
            </div>
          )}
        </div>
      </section>

      {(deletePreview || isPreviewLoading || deleteMessage) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 md:p-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl md:p-6">
            <h2 className="mb-4 text-xl font-black text-red-600">
              Xác nhận xóa bể cá
            </h2>

            {isPreviewLoading && <p>Đang tải thông tin sẽ bị xóa...</p>}

            {deleteMessage && (
              <p className="rounded-2xl border border-red-200 bg-red-50 p-3 font-black text-red-600">
                {deleteMessage}
              </p>
            )}

            {deletePreview && (
              <>
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-slate-700">
                  <p>
                    <b>Bể:</b> {deletePreview.tank.name}
                  </p>
                  <p>
                    <b>Mã bể:</b> {deletePreview.tank.tank_code}
                  </p>
                  <p>
                    <b>Chủ bể:</b>{" "}
                    {deletePreview.tank.owner.full_name ||
                      deletePreview.tank.owner.email ||
                      deletePreview.tank.owner.id}
                  </p>
                  <p>
                    <b>Quyền xóa:</b> {deletePreview.permission_note}
                  </p>

                  {isAdmin &&
                    Number(deletePreview.tank.user_id) !==
                      Number(currentUser?.id) && (
                      <p className="mt-2 font-black text-amber-700">
                        Bạn đang xóa bể của user khác.
                      </p>
                    )}
                </div>

                <p className="mb-4 font-black text-red-600">
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
                          className="mb-2 rounded-2xl border border-slate-200 p-3"
                        >
                          <b>
                            {device.name || "Không tên"} #{device.id}
                          </b>
                          <p>Mã: {device.device_code || "Không có"}</p>
                          <p>Trạng thái: {device.status || "Không rõ"}</p>
                          <p>Last seen: {formatDate(device.last_seen)}</p>
                          <p>
                            Sensor data: {device.sensor_data_count || 0} bản ghi
                            · Actuator state: {device.actuator_state_count || 0}
                            · Alerts: {device.alert_count || 0}
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
                      {deletePreview.details.sensor_data_by_device.map((item) => (
                        <div
                          key={item.device_id}
                          className="mb-2 rounded-2xl border border-slate-200 p-3"
                        >
                          <b>
                            {item.device_name || "Thiết bị"} #{item.device_id}
                          </b>
                          <p>Mã: {item.device_code || "Không có"}</p>
                          <p>Số bản ghi: {item.count || 0}</p>
                          <p>Từ: {formatDate(item.first_created_at)}</p>
                          <p>Đến: {formatDate(item.last_created_at)}</p>
                        </div>
                      ))}
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
                          className="mb-2 rounded-2xl border border-slate-200 p-3"
                        >
                          <b>
                            {item.device_name || "Thiết bị"} #{item.device_id}
                          </b>
                          <p>
                            Pump: {item.pump ? "ON" : "OFF"} · Light:{" "}
                            {item.light ? "ON" : "OFF"} · Oxygen:{" "}
                            {item.oxygen ? "ON" : "OFF"} · Auto:{" "}
                            {item.auto_mode ? "ON" : "OFF"}
                          </p>
                          <p>Lệnh cuối: {formatDate(item.last_command_at)}</p>
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
                      <div className="mb-3">
                        <b>Nhóm theo loại cảnh báo</b>
                        {deletePreview.details.alerts_by_type.map((item, index) => (
                          <p key={String(item.alert_type) + "_" + String(index)}>
                            - {item.alert_type || "unknown"} /{" "}
                            {item.severity || "unknown"}: {item.count} cảnh báo
                          </p>
                        ))}
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
                            className="mt-2 rounded-2xl border border-slate-200 p-3"
                          >
                            <p>
                              <b>{alert.alert_type}</b> - {alert.severity}
                            </p>
                            <p>{alert.message}</p>
                            <p>{formatDate(alert.created_at)}</p>
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
                          className="overflow-x-auto rounded-2xl bg-slate-50 p-3 text-xs"
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
                      <pre className="overflow-x-auto rounded-2xl bg-slate-50 p-3 text-xs">
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
                      <pre className="overflow-x-auto rounded-2xl bg-slate-50 p-3 text-xs">
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

                <label className="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={deleteConfirmed}
                    onChange={(e) => setDeleteConfirmed(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Tôi hiểu rằng bể cá và toàn bộ dữ liệu liên quan sẽ bị xóa
                    vĩnh viễn, không thể khôi phục.
                  </span>
                </label>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={closeDeleteModal}
                    disabled={isDeleting}
                    className="rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed"
                  >
                    Hủy
                  </button>

                  <button
                    onClick={handleDeleteTank}
                    disabled={!deleteConfirmed || isDeleting}
                    className="rounded-2xl border border-red-600 bg-red-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:border-red-200 disabled:bg-red-200"
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
