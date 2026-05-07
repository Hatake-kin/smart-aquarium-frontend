"use client";

import { useEffect, useState } from "react";

type Role = "user" | "admin" | "moderator";
type PlanType = "basic" | "premium";

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
};

export default function AdminUsersPage() {
  const API_URL = "http://localhost:5000";

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

      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
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

      const res = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

      const res = await fetch(`${API_URL}/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
        ? `nâng cấp Premium ${durationDays} ngày`
        : "nâng cấp Premium không giới hạn";

    const ok = confirm(`Bạn có chắc muốn ${label} cho tài khoản này không?`);

    if (!ok) return;

    try {
      const token = getToken();

      const body: any = {
        plan_type: planType,
      };

      if (planType === "premium") {
        body.duration_days = durationDays || 0;
      }

      const res = await fetch(`${API_URL}/api/admin/users/${userId}/plan`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
        ? `Bạn có chắc muốn XÓA KÈM TOÀN BỘ DỮ LIỆU của tài khoản ${email} không?\n\nHành động này sẽ xóa bể cá, thiết bị và dữ liệu cảm biến liên quan.`
        : `Bạn có chắc muốn xóa tài khoản ${email} không?`
    );

    if (!ok) return;

    try {
      const token = getToken();

      const url = force
        ? `${API_URL}/api/admin/users/${userId}?force=1`
        : `${API_URL}/api/admin/users/${userId}`;

      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.need_force_delete) {
          const forceOk = confirm(
            `${data.message}\n\nBạn có muốn xóa kèm toàn bộ dữ liệu liên quan không?`
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

  const isPlanExpired = (user: User) => {
    if (user.plan_type !== "premium") return false;
    if (!user.plan_expires_at) return false;

    return new Date(user.plan_expires_at).getTime() < Date.now();
  };

  const formatPlanExpire = (user: User) => {
    if (user.plan_type === "basic") return "-";
    if (!user.plan_expires_at) return "Không giới hạn";

    return new Date(user.plan_expires_at).toLocaleString();
  };

  const canOpenPage =
    currentUser?.role === "admin" || currentUser?.role === "moderator";

  if (currentUser && !canOpenPage) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Không có quyền truy cập</h1>
        <p>Trang này chỉ dành cho admin hoặc moderator.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1400 }}>
      <h1>Quản lý người dùng</h1>

      <p>
        Admin có toàn quyền. Moderator chỉ được khóa/mở tài khoản user thường.
        Gói Premium chỉ admin được cấp hoặc gia hạn.
      </p>

      {message && (
        <p
          style={{
            color:
              message.includes("thất bại") ||
              message.includes("Không") ||
              message.includes("không") ||
              message.includes("lỗi")
                ? "red"
                : "green",
          }}
        >
          {message}
        </p>
      )}

      <table
        border={1}
        cellPadding={8}
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 16,
          background: "#fff",
        }}
      >
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Họ tên</th>
            <th>SĐT</th>
            <th>Role</th>
            <th>Gói</th>
            <th>Hạn gói</th>
            <th>Trạng thái</th>
            <th>Lần đăng nhập</th>
            <th>Thao tác</th>
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

            const expired = isPlanExpired(user);

            return (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.email}</td>
                <td>{user.full_name || ""}</td>
                <td>{user.phone || ""}</td>

                <td>
                  <select
                    value={user.role}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                    disabled={!canChangeRole}
                  >
                    <option value="user">user</option>
                    <option value="moderator">moderator</option>
                    <option value="admin">admin</option>
                  </select>

                  {!canChangeRole && (
                    <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                      {isCurrentUser
                        ? "Không thể đổi quyền chính mình"
                        : "Chỉ admin được đổi role"}
                    </div>
                  )}
                </td>

                <td>
                  <span
                    style={{
                      fontWeight: "bold",
                      color:
                        user.plan_type === "premium"
                          ? expired
                            ? "#dc2626"
                            : "#7c3aed"
                          : "#2563eb",
                    }}
                  >
                    {user.plan_type}
                    {expired ? " (hết hạn)" : ""}
                  </span>

                  {isAdminLogin && (
                    <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                      <button
                        onClick={() => updatePlan(user.id, "premium", 7)}
                        disabled={!canChangePlan}
                      >
                        Premium 7 ngày
                      </button>

                      <button
                        onClick={() => updatePlan(user.id, "premium", 30)}
                        disabled={!canChangePlan}
                      >
                        Premium 30 ngày
                      </button>

                      <button
                        onClick={() => updatePlan(user.id, "premium", 90)}
                        disabled={!canChangePlan}
                      >
                        Premium 90 ngày
                      </button>

                      <button
                        onClick={() => updatePlan(user.id, "premium", 0)}
                        disabled={!canChangePlan}
                      >
                        Premium không hạn
                      </button>

                      <button
                        onClick={() => updatePlan(user.id, "basic")}
                        disabled={!canChangePlan}
                        style={{ color: "#b45309" }}
                      >
                        Hạ Basic
                      </button>
                    </div>
                  )}

                  {!isAdminLogin && (
                    <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                      Moderator không được đổi gói
                    </div>
                  )}
                </td>

                <td>{formatPlanExpire(user)}</td>

                <td>
                  {user.is_active ? (
                    <span style={{ color: "green", fontWeight: "bold" }}>
                      Đang hoạt động
                    </span>
                  ) : (
                    <span style={{ color: "red", fontWeight: "bold" }}>
                      Đã khóa
                    </span>
                  )}
                </td>

                <td>
                  {user.last_login
                    ? new Date(user.last_login).toLocaleString()
                    : "Chưa đăng nhập"}
                </td>

                <td>
                  <button
                    onClick={() => updateStatus(user.id, !user.is_active)}
                    disabled={!canChangeStatus}
                    style={{
                      marginRight: 8,
                      cursor: canChangeStatus ? "pointer" : "not-allowed",
                    }}
                  >
                    {user.is_active ? "Khóa" : "Mở khóa"}
                  </button>

                  {isAdminLogin && (
                    <button
                      onClick={() => deleteUser(user.id, user.email)}
                      disabled={!canDelete}
                      style={{
                        color: "red",
                        borderColor: "red",
                        cursor: canDelete ? "pointer" : "not-allowed",
                      }}
                    >
                      Xóa
                    </button>
                  )}

                  {!isAdminLogin && (
                    <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                      Moderator không được xóa hoặc đổi role
                    </div>
                  )}

                  {isCurrentUser && (
                    <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                      Không thể thao tác với tài khoản đang đăng nhập
                    </div>
                  )}
                </td>
              </tr>
            );
          })}

          {users.length === 0 && (
            <tr>
              <td colSpan={10} style={{ textAlign: "center" }}>
                Chưa có người dùng
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}