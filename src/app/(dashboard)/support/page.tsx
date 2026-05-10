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

export default function SupportPage() {
  const API_URL = "";

  const [requestType, setRequestType] = useState("upgrade_plan");
  const [subject, setSubject] = useState("Yêu cầu nâng cấp gói Premium");
  const [messageText, setMessageText] = useState(
    "Tôi muốn nâng cấp tài khoản lên Premium để sử dụng nhiều bể/thiết bị hơn."
  );
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

  const loadRequests = async () => {
    try {
      const token = getToken();

      const res = await fetch(API_URL + "/api/support/my", {
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(data.message || "Không lấy được danh sách yêu cầu");
        return;
      }

      setRequests(data.requests || []);
    } catch (err) {
      console.error(err);
      setStatusMessage("Không kết nối được backend");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const type = params.get("type");

      if (type && requestTypeLabels[type]) {
        setRequestType(type);

        if (type === "upgrade_plan") {
          setSubject("Yêu cầu nâng cấp gói Premium");
          setMessageText(
            "Tôi muốn nâng cấp tài khoản lên Premium để sử dụng nhiều bể/thiết bị hơn."
          );
        }
      }

      const handleSupportUpdated = () => {
        loadRequests();
      };

      window.addEventListener("support_request_updated", handleSupportUpdated);

      loadRequests();

      return () => {
        window.removeEventListener(
          "support_request_updated",
          handleSupportUpdated
        );
      };
    }

    loadRequests();
  }, []);

  const handleTypeChange = (value: string) => {
    setRequestType(value);

    if (value === "upgrade_plan") {
      setSubject("Yêu cầu nâng cấp gói Premium");
      setMessageText(
        "Tôi muốn nâng cấp tài khoản lên Premium để sử dụng nhiều bể/thiết bị hơn."
      );
    } else if (value === "device_issue") {
      setSubject("Báo lỗi thiết bị IoT");
      setMessageText("Thiết bị của tôi đang gặp lỗi, nhờ admin hỗ trợ kiểm tra.");
    } else if (value === "technical_support") {
      setSubject("Yêu cầu hỗ trợ kỹ thuật");
      setMessageText("Tôi cần hỗ trợ kỹ thuật khi sử dụng hệ thống Smart Aquarium.");
    } else {
      setSubject("");
      setMessageText("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage("");

    if (!subject.trim()) {
      setStatusMessage("Vui lòng nhập tiêu đề yêu cầu");
      return;
    }

    if (!messageText.trim()) {
      setStatusMessage("Vui lòng nhập nội dung yêu cầu");
      return;
    }

    try {
      setLoading(true);

      const token = getToken();

      const res = await fetch(API_URL + "/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          request_type: requestType,
          subject: subject.trim(),
          message: messageText.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(data.message || "Gửi yêu cầu thất bại");
        return;
      }

      setStatusMessage("Đã gửi yêu cầu hỗ trợ thành công");
      await loadRequests();
    } catch (err) {
      console.error(err);
      setStatusMessage("Không kết nối được backend");
    } finally {
      setLoading(false);
    }
  };

  const isError =
    statusMessage.includes("thất bại") ||
    statusMessage.includes("Không") ||
    statusMessage.includes("không") ||
    statusMessage.includes("Vui lòng");

  return (
    <main className="w-full max-w-5xl px-0 md:px-2">
      <h1 className="text-2xl font-black text-slate-800">Trung tâm hỗ trợ</h1>

      <p className="mt-2 max-w-3xl text-slate-600">
        Gửi yêu cầu hỗ trợ cho admin/moderator. Có thể dùng để yêu cầu nâng cấp
        Premium, báo lỗi thiết bị hoặc cần hỗ trợ kỹ thuật.
      </p>

      <section className="mt-5 rounded-3xl border border-pink-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 text-xl font-black text-slate-800">
          Gửi yêu cầu mới
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block font-bold text-pink-900">
              Loại yêu cầu
            </label>
            <select
              value={requestType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full rounded-2xl border border-pink-300 px-4 py-3 outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-100"
            >
              {Object.entries(requestTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block font-bold text-pink-900">
              Tiêu đề
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-2xl border border-pink-300 px-4 py-3 outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-100"
            />
          </div>

          <div>
            <label className="mb-2 block font-bold text-pink-900">
              Nội dung
            </label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-pink-300 px-4 py-3 outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl border border-pink-400 px-5 py-3 font-black text-pink-700 transition hover:bg-pink-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang gửi..." : "Gửi yêu cầu"}
          </button>
        </form>

        {statusMessage && (
          <p
            className={[
              "mt-4 rounded-2xl border p-3 font-black",
              isError
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-green-200 bg-green-50 text-green-700",
            ].join(" ")}
          >
            {statusMessage}
          </p>
        )}
      </section>

      <section className="mt-5 rounded-3xl border border-pink-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-800">
            Yêu cầu đã gửi
          </h2>

          <button
            type="button"
            onClick={loadRequests}
            className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-700 transition hover:bg-cyan-100"
          >
            Refresh phản hồi
          </button>
        </div>

        <div className="space-y-3">
          {requests.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm"
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

              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                {item.message}
              </p>

              {item.admin_reply && (
                <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
                  <b>Phản hồi admin:</b>
                  <p className="mt-1 whitespace-pre-wrap">{item.admin_reply}</p>
                </div>
              )}

              <p className="mt-3 text-xs font-semibold text-slate-400">
                Gửi lúc: {formatDate(item.created_at)} · Cập nhật:{" "}
                {formatDate(item.updated_at)}
              </p>
            </article>
          ))}

          {requests.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center font-semibold text-slate-500">
              Bạn chưa gửi yêu cầu hỗ trợ nào.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
