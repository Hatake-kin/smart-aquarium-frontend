"use client";

import { useEffect, useState } from "react";

type Role = "user" | "admin" | "moderator";
type PlanType = "basic" | "premium";
type ComputedStatus = "active" | "offline" | "locked";

type User = {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  plan_type: PlanType;
  plan_expires_at: string | null;
  is_active: number;
  last_login: string | null;
  created_at: string;
  computed_status?: ComputedStatus;
  status_label?: string;
};

export default function AdminUsersPage() {
  const API_URL = "";

  const [users, setUsers] = useState<User[]>([]);
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

  const loadUsers = async () => {
    try {
      const token = getToken();

      const res = await fetch(API_URL + "/api/admin/users", {
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Không lấy được danh sách người dùng");
        return;
      }

      setUsers(data.users || []);
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadUsers();
  }, []);

  const updateRole = async (userId: number, role: string) => {
    try {
      const token = getToken();

      const res = await fetch(API_URL + "/api/admin/users/" + userId + "/role", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Cập nhật role thất bại");
        return;
      }

      setMessage("Cập nhật role thành công");
      loadUsers();
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const updateStatus = async (userId: number, isActive: boolean) => {
    try {
      const token = getToken();

      const res = await fetch(API_URL + "/api/admin/users/" + userId + "/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ is_active: isActive }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Cập nhật trạng thái thất bại");
        return;
      }

      setMessage(data.message || "Cập nhật trạng thái thành công");
      loadUsers();
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const updatePlan = async (
    userId: number,
    planType: PlanType,
    durationDays?: number
  ) => {
    const label =
      planType === "basic"
        ? "hạ về Basic"
        : durationDays && durationDays > 0
        ? "nâng cấp Premium " + durationDays + " ngày"
        : "nâng cấp Premium không giới hạn";

    const ok = confirm(
      "Bạn có chắc muốn " + label + " cho tài khoản này không?"
    );

    if (!ok) return;

    try {
      const token = getToken();

      const body: any = {
        plan_type: planType,
      };

      if (planType === "premium") {
        body.duration_days = durationDays || 0;
      }

      const res = await fetch(API_URL + "/api/admin/users/" + userId + "/plan", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Cập nhật gói thất bại");
        return;
      }

      setMessage(data.message || "Cập nhật gói thành công");
      loadUsers();
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const deleteUser = async (userId: number, email: string, force = false) => {
    const ok = confirm(
      force
        ? "Bạn có chắc muốn XÓA KÈM TOÀN BỘ DỮ LIỆU của tài khoản " +
            email +
            " không?\n\nHành động này sẽ xóa bể cá, thiết bị và dữ liệu cảm biến liên quan."
        : "Bạn có chắc muốn xóa tài khoản " + email + " không?"
    );

    if (!ok) return;

    try {
      const token = getToken();

      const url = force
        ? API_URL + "/api/admin/users/" + userId + "?force=1"
        : API_URL + "/api/admin/users/" + userId;

      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.need_force_delete) {
          const forceOk = confirm(
            data.message +
              "\n\nBạn có muốn xóa kèm toàn bộ dữ liệu liên quan không?"
          );

          if (forceOk) {
            deleteUser(userId, email, true);
          }

          return;
        }

        setMessage(data.message || "Xóa tài khoản thất bại");
        return;
      }

      setMessage(data.message || "Xóa tài khoản thành công");
      loadUsers();
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const parseDbDate = (value?: string | null) => {
    if (!value) return null;

    const raw = String(value).trim();

    if (!raw) return null;

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

  const formatDateTime = (value?: string | null) => {
    const date = parseDbDate(value);

    if (!date) {
      return "Chưa đăng nhập";
    }

    return date.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
    });
  };

  const isPlanExpired = (user: User) => {
    if (user.plan_type !== "premium") return false;
    if (!user.plan_expires_at) return false;

    const expires = parseDbDate(user.plan_expires_at);

    if (!expires) return false;

    return expires.getTime() < Date.now();
  };

  const formatPlanExpire = (user: User) => {
    if (user.plan_type === "basic") return "-";
    if (!user.plan_expires_at) return "Không giới hạn";

    return formatDateTime(user.plan_expires_at);
  };

  const getUserStatus = (user: User) => {
    if (!Number(user.is_active)) {
      return {
        key: "locked" as ComputedStatus,
        label: "Bị khóa",
        className: "bg-red-50 text-red-600 border-red-200",
      };
    }

    if (user.computed_status === "active") {
      return {
        key: "active" as ComputedStatus,
        label: "Đang hoạt động",
        className: "bg-green-50 text-green-700 border-green-200",
      };
    }

    if (user.computed_status === "locked") {
      return {
        key: "locked" as ComputedStatus,
        label: "Bị khóa",
        className: "bg-red-50 text-red-600 border-red-200",
      };
    }

    const lastLogin = parseDbDate(user.last_login);
    const isRecentlyActive =
      Boolean(lastLogin) && Date.now() - lastLogin!.getTime() <= 15 * 60 * 1000;

    if (isRecentlyActive) {
      return {
        key: "active" as ComputedStatus,
        label: "Đang hoạt động",
        className: "bg-green-50 text-green-700 border-green-200",
      };
    }

    return {
      key: "offline" as ComputedStatus,
      label: "Ngoại tuyến",
      className: "bg-slate-50 text-slate-500 border-slate-200",
    };
  };

  const canOpenPage =
    currentUser?.role === "admin" || currentUser?.role === "moderator";

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

  const isErrorMessage =
    message.includes("thất bại") ||
    message.includes("Không") ||
    message.includes("không") ||
    message.includes("lỗi");

  const packageBadge = (user: User) => {
    const expired = isPlanExpired(user);

    return (
      <span
        className={[
          "inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase",
          user.plan_type === "premium"
            ? expired
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-violet-200 bg-violet-50 text-violet-700"
            : "border-blue-200 bg-blue-50 text-blue-700",
        ].join(" ")}
      >
        {user.plan_type}
        {expired ? " hết hạn" : ""}
      </span>
    );
  };

  return (
    <main className="w-full max-w-7xl px-0 md:px-2">
      <h1 className="text-2xl font-black text-slate-800">
        Quản lý người dùng
      </h1>

      <p className="mt-2 max-w-3xl text-slate-600">
        Admin có toàn quyền. Moderator chỉ được khóa/mở tài khoản user thường.
        Gói Premium chỉ admin được cấp hoặc gia hạn.
      </p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <b>Quy ước trạng thái:</b>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 font-bold text-green-700">
            Đang hoạt động: đăng nhập trong 15 phút gần nhất
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-bold text-slate-500">
            Ngoại tuyến: quá 15 phút hoặc chưa đăng nhập
          </span>
          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-bold text-red-600">
            Bị khóa: tài khoản đã bị khóa
          </span>
        </div>
      </div>

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

      <section className="mt-5 rounded-3xl border border-pink-200 bg-white p-3 shadow-sm md:p-5">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1150px] border-collapse text-sm">
            <thead>
              <tr className="bg-pink-50 text-pink-900">
                <th className="border border-pink-100 p-3 text-left">ID</th>
                <th className="border border-pink-100 p-3 text-left">Email</th>
                <th className="border border-pink-100 p-3 text-left">Họ tên</th>
                <th className="border border-pink-100 p-3 text-left">SĐT</th>
                <th className="border border-pink-100 p-3 text-left">Role</th>
                <th className="border border-pink-100 p-3 text-left">Gói</th>
                <th className="border border-pink-100 p-3 text-left">Hạn gói</th>
                <th className="border border-pink-100 p-3 text-left">
                  Trạng thái
                </th>
                <th className="border border-pink-100 p-3 text-left">
                  Lần đăng nhập
                </th>
                <th className="border border-pink-100 p-3 text-left">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => {
                const isCurrentUser = currentUser?.id === user.id;
                const isAdminLogin = currentUser?.role === "admin";
                const isModeratorLogin = currentUser?.role === "moderator";

                const moderatorCanTouch =
                  isModeratorLogin && user.role === "user" && !isCurrentUser;

                const canChangeRole = isAdminLogin && !isCurrentUser;
                const canChangeStatus =
                  (isAdminLogin && !isCurrentUser) || moderatorCanTouch;
                const canDelete = isAdminLogin && !isCurrentUser;
                const canChangePlan = isAdminLogin && !isCurrentUser;
                const status = getUserStatus(user);

                return (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="border border-pink-100 p-3">{user.id}</td>
                    <td className="border border-pink-100 p-3">{user.email}</td>
                    <td className="border border-pink-100 p-3">
                      {user.full_name || ""}
                    </td>
                    <td className="border border-pink-100 p-3">
                      {user.phone || ""}
                    </td>

                    <td className="border border-pink-100 p-3">
                      <select
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value)}
                        disabled={!canChangeRole}
                        className="rounded-xl border border-pink-200 px-3 py-2"
                      >
                        <option value="user">user</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>

                    <td className="border border-pink-100 p-3 align-top">
                      {packageBadge(user)}

                      {isAdminLogin && (
                        <div className="mt-2 grid gap-1">
                          <button
                            onClick={() => updatePlan(user.id, "premium", 7)}
                            disabled={!canChangePlan}
                            className="rounded-xl border border-pink-300 px-2 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                          >
                            Premium 7 ngày
                          </button>
                          <button
                            onClick={() => updatePlan(user.id, "premium", 30)}
                            disabled={!canChangePlan}
                            className="rounded-xl border border-pink-300 px-2 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                          >
                            Premium 30 ngày
                          </button>
                          <button
                            onClick={() => updatePlan(user.id, "premium", 90)}
                            disabled={!canChangePlan}
                            className="rounded-xl border border-pink-300 px-2 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                          >
                            Premium 90 ngày
                          </button>
                          <button
                            onClick={() => updatePlan(user.id, "premium", 0)}
                            disabled={!canChangePlan}
                            className="rounded-xl border border-pink-300 px-2 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                          >
                            Premium không hạn
                          </button>
                          <button
                            onClick={() => updatePlan(user.id, "basic")}
                            disabled={!canChangePlan}
                            className="rounded-xl border border-amber-300 px-2 py-1 text-xs font-bold text-amber-700 disabled:opacity-50"
                          >
                            Hạ Basic
                          </button>
                        </div>
                      )}

                      {!isAdminLogin && (
                        <p className="mt-2 text-xs text-slate-500">
                          Moderator không được đổi gói
                        </p>
                      )}
                    </td>

                    <td className="border border-pink-100 p-3">
                      {formatPlanExpire(user)}
                    </td>

                    <td className="border border-pink-100 p-3">
                      <span
                        className={[
                          "inline-flex rounded-full border px-3 py-1 text-xs font-black",
                          status.className,
                        ].join(" ")}
                      >
                        {status.label}
                      </span>
                    </td>

                    <td className="border border-pink-100 p-3">
                      {user.last_login
                        ? formatDateTime(user.last_login)
                        : "Chưa đăng nhập"}
                    </td>

                    <td className="border border-pink-100 p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => updateStatus(user.id, !user.is_active)}
                          disabled={!canChangeStatus}
                          className="rounded-xl border border-pink-300 px-3 py-2 text-sm font-bold text-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {Number(user.is_active) ? "Khóa" : "Mở khóa"}
                        </button>

                        {isAdminLogin && (
                          <button
                            onClick={() => deleteUser(user.id, user.email)}
                            disabled={!canDelete}
                            className="rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Xóa
                          </button>
                        )}
                      </div>

                      {isCurrentUser && (
                        <p className="mt-2 text-xs text-slate-500">
                          Không thể thao tác với tài khoản đang đăng nhập
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={10} className="border border-pink-100 p-6 text-center">
                    Chưa có người dùng
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {users.map((user) => {
            const isCurrentUser = currentUser?.id === user.id;
            const isAdminLogin = currentUser?.role === "admin";
            const isModeratorLogin = currentUser?.role === "moderator";

            const moderatorCanTouch =
              isModeratorLogin && user.role === "user" && !isCurrentUser;

            const canChangeRole = isAdminLogin && !isCurrentUser;
            const canChangeStatus =
              (isAdminLogin && !isCurrentUser) || moderatorCanTouch;
            const canDelete = isAdminLogin && !isCurrentUser;
            const canChangePlan = isAdminLogin && !isCurrentUser;
            const status = getUserStatus(user);

            return (
              <article
                key={user.id}
                className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-800">
                      {user.full_name || user.email}
                    </h3>
                    <p className="text-xs font-bold text-slate-400">
                      ID #{user.id}
                    </p>
                  </div>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-black",
                      status.className,
                    ].join(" ")}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <p>
                    <b>Email:</b> {user.email}
                  </p>
                  <p>
                    <b>SĐT:</b> {user.phone || "Không có"}
                  </p>
                  <p>
                    <b>Role:</b> {user.role}
                  </p>
                  <p>
                    <b>Gói:</b> {packageBadge(user)}
                  </p>
                  <p>
                    <b>Hạn gói:</b> {formatPlanExpire(user)}
                  </p>
                  <p>
                    <b>Lần đăng nhập:</b>{" "}
                    {user.last_login
                      ? formatDateTime(user.last_login)
                      : "Chưa đăng nhập"}
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">
                      Đổi role
                    </label>
                    <select
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                      disabled={!canChangeRole}
                      className="w-full rounded-xl border border-pink-200 px-3 py-2"
                    >
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>

                  {isAdminLogin && (
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-500">
                        Cập nhật gói
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updatePlan(user.id, "premium", 7)}
                          disabled={!canChangePlan}
                          className="rounded-xl border border-pink-300 px-2 py-2 text-xs font-bold text-pink-700 disabled:opacity-50"
                        >
                          Premium 7 ngày
                        </button>
                        <button
                          onClick={() => updatePlan(user.id, "premium", 30)}
                          disabled={!canChangePlan}
                          className="rounded-xl border border-pink-300 px-2 py-2 text-xs font-bold text-pink-700 disabled:opacity-50"
                        >
                          Premium 30 ngày
                        </button>
                        <button
                          onClick={() => updatePlan(user.id, "premium", 90)}
                          disabled={!canChangePlan}
                          className="rounded-xl border border-pink-300 px-2 py-2 text-xs font-bold text-pink-700 disabled:opacity-50"
                        >
                          Premium 90 ngày
                        </button>
                        <button
                          onClick={() => updatePlan(user.id, "premium", 0)}
                          disabled={!canChangePlan}
                          className="rounded-xl border border-pink-300 px-2 py-2 text-xs font-bold text-pink-700 disabled:opacity-50"
                        >
                          Không hạn
                        </button>
                        <button
                          onClick={() => updatePlan(user.id, "basic")}
                          disabled={!canChangePlan}
                          className="col-span-2 rounded-xl border border-amber-300 px-2 py-2 text-xs font-bold text-amber-700 disabled:opacity-50"
                        >
                          Hạ Basic
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateStatus(user.id, !user.is_active)}
                      disabled={!canChangeStatus}
                      className="rounded-xl border border-pink-300 px-3 py-2 text-sm font-bold text-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {Number(user.is_active) ? "Khóa" : "Mở khóa"}
                    </button>

                    {isAdminLogin && (
                      <button
                        onClick={() => deleteUser(user.id, user.email)}
                        disabled={!canDelete}
                        className="rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    )}
                  </div>

                  {isCurrentUser && (
                    <p className="text-xs text-slate-500">
                      Không thể thao tác với tài khoản đang đăng nhập
                    </p>
                  )}
                </div>
              </article>
            );
          })}

          {users.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center font-semibold text-slate-500">
              Chưa có người dùng
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
