"use client";

import { useEffect, useState } from "react";

type SupportRequest = {
  id: number;
  user_id: number;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  handled_by: number | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
  email?: string;
  full_name?: string | null;
  phone?: string | null;
  plan_type?: string | null;
  handled_by_email?: string | null;
  handled_by_name?: string | null;
};

const requestTypeLabels: Record<string, string> = {
  upgrade_plan: "Yêu cầu nâng cấp Premium",
  device_issue: "Báo lỗi thiết bị",
  technical_support: "Hỗ trợ kỹ thuật",
  billing: "Thanh toán / gói dịch vụ",
  other: "Khác",
};

const statusLabels: Record<string, string> = {
  pending: "Chưa xử lý",
  in_progress: "Đang xử lý",
  resolved: "Đã xử lý",
  rejected: "Từ chối",
};

const statusStyles: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  resolved: "border-green-200 bg-green-50 text-green-700",
  rejected: "border-red-200 bg-red-50 text-red-600",
};

const getStatusButtonClass = (value: string, currentStatus: string) => {
  const base =
    "rounded-2xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60";

  const activeMap: Record<string, string> = {
    pending: "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-100",
    in_progress: "border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-100",
    resolved: "border-green-600 bg-green-600 text-white shadow-md shadow-green-100",
    rejected: "border-red-600 bg-red-600 text-white shadow-md shadow-red-100",
  };

  const inactiveMap: Record<string, string> = {
    pending: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
    in_progress: "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
    resolved: "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
    rejected: "border-red-300 bg-red-50 text-red-600 hover:bg-red-100",
  };

  return base + " " + (value === currentStatus ? activeMap[value] : inactiveMap[value]);
};

export default function AdminSupportPage() {
  const API_URL = "";

  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const getToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("token") || "";
  };

  const parseDate = (value?: string | null) => {
    if (!value) return null;

    const raw = String(value).trim();
    let normalized = raw;

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) {
      normalized = raw.replace(" ", "T") + "Z";
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)) {
      normalized = raw + "Z";
    }

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  };

  const formatDate = (value?: string | null) => {
    const date = parseDate(value);

    if (!date) return "-";

    return date.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
    });
  };

  const loadCurrentUser = () => {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem("user");

    if (raw) {
      setCurrentUser(JSON.parse(raw));
    }
  };

  const loadRequests = async (statusValue = filterStatus) => {
    try {
      const token = getToken();

      const res = await fetch(
        API_URL + "/api/support/admin?status=" + encodeURIComponent(statusValue),
        {
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Không lấy được danh sách hỗ trợ");
        return;
      }

      const nextRequests = data.requests || [];
      const nextDrafts: Record<number, string> = {};

      nextRequests.forEach((item: SupportRequest) => {
        nextDrafts[item.id] = item.admin_reply || "";
      });

      setRequests(nextRequests);
      setReplyDrafts(nextDrafts);
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadRequests("all");

    if (typeof window !== "undefined") {
      const handleSupportCreated = () => {
        loadRequests(filterStatus);
      };

      window.addEventListener("support_request_created", handleSupportCreated);

      return () => {
        window.removeEventListener(
          "support_request_created",
          handleSupportCreated
        );
      };
    }
  }, []);

  const canOpenPage =
    currentUser?.role === "admin" || currentUser?.role === "moderator";

  const handleFilterChange = (value: string) => {
    setFilterStatus(value);
    loadRequests(value);
  };

  const updateRequest = async (id: number, status: string) => {
    try {
      setLoadingId(id);

      const token = getToken();

      const res = await fetch(API_URL + "/api/support/admin/" + id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          status,
          admin_reply: replyDrafts[id] || "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Cập nhật yêu cầu thất bại");
        return;
      }

      setMessage("Cập nhật yêu cầu hỗ trợ thành công");
      await loadRequests(filterStatus);
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    } finally {
      setLoadingId(null);
    }
  };

  if (currentUser && !canOpenPage) {
    return (
      <main className="p-4 md:p-6">
        <h1 className="text-2xl font-black text-slate-800">
          Không có quyền truy cập
        </h1>
        <p className="mt-2 text-slate-600">
          Trang này chỉ dành cho admin hoặc moderator.
        </p>
      </main>
    );
  }

  const isError =
    message.includes("thất bại") ||
    message.includes("Không") ||
    message.includes("không") ||
    message.includes("lỗi");

  return (
    <main className="w-full max-w-7xl px-0 md:px-2">
      <h1 className="text-2xl font-black text-slate-800">Quản lý hỗ trợ</h1>

      <p className="mt-2 max-w-3xl text-slate-600">
        Admin/Moderator xem và xử lý yêu cầu nâng cấp gói, báo lỗi thiết bị và
        hỗ trợ kỹ thuật từ người dùng.
      </p>

      <section className="mt-5 rounded-3xl border border-pink-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-800">
            Danh sách yêu cầu
          </h2>

          <select
            value={filterStatus}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-2xl border border-pink-300 px-4 py-3 font-bold outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-100"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chưa xử lý</option>
            <option value="in_progress">Đang xử lý</option>
            <option value="resolved">Đã xử lý</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>

        {message && (
          <p
            className={[
              "mt-4 rounded-2xl border p-3 font-black",
              isError
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-green-200 bg-green-50 text-green-700",
            ].join(" ")}
          >
            {message}
          </p>
        )}

        <div className="mt-4 space-y-4">
          {requests.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-pink-100 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-800">{item.subject}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    #{item.id} · {requestTypeLabels[item.request_type] || item.request_type}
                  </p>
                </div>

                <span
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-black",
                    statusStyles[item.status] ||
                      "border-slate-200 bg-slate-50 text-slate-500",
                  ].join(" ")}
                >
                  {statusLabels[item.status] || item.status}
                </span>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <b>Người gửi</b>
                  <p className="mt-1">
                    {item.full_name || "Không tên"} · {item.email || "Không email"}
                  </p>
                  <p>SĐT: {item.phone || "Không có"}</p>
                  <p>Gói hiện tại: {item.plan_type || "Không rõ"}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <b>Thời gian</b>
                  <p className="mt-1">Gửi: {formatDate(item.created_at)}</p>
                  <p>Cập nhật: {formatDate(item.updated_at)}</p>
                  <p>
                    Người xử lý:{" "}
                    {item.handled_by_name ||
                      item.handled_by_email ||
                      item.handled_by ||
                      "Chưa có"}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <b>Nội dung user gửi</b>
                <p className="mt-2 whitespace-pre-wrap">{item.message}</p>
              </div>

              <div className="mt-3">
                <label className="mb-2 block font-bold text-pink-900">
                  Phản hồi admin
                </label>
                <p className="mb-2 text-xs font-semibold text-slate-500">
                  Bấm một trạng thái bên dưới để lưu phản hồi và cập nhật cho user.
                </p>
                <textarea
                  value={replyDrafts[item.id] || ""}
                  onChange={(e) =>
                    setReplyDrafts((prev) => ({
                      ...prev,
                      [item.id]: e.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(statusLabels).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => updateRequest(item.id, value)}
                    disabled={loadingId === item.id}
                    className={getStatusButtonClass(value, item.status)}
                  >
                    {loadingId === item.id ? "Đang lưu..." : label}
                  </button>
                ))}
              </div>
            </article>
          ))}

          {requests.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center font-semibold text-slate-500">
              Chưa có yêu cầu hỗ trợ nào.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
