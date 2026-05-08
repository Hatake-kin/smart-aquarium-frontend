"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserInfo {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [updating, setUpdating] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.replace("/login");
          return;
        }

        const res = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Không thể lấy thông tin người dùng");

        const data = await res.json();
        setUser(data.user);
        setFullName(data.user.full_name || "");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Lỗi tải thông tin";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ full_name: fullName }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Cập nhật thất bại");

      alert("Cập nhật thông tin thành công!");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Cập nhật thất bại";
      alert(message);
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setPasswordMessage("Mật khẩu mới không khớp");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    setChangingPassword(true);
    setPasswordMessage("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users/me/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Đổi mật khẩu thất bại");

      setPasswordMessage("Đổi mật khẩu thành công!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Đổi mật khẩu thất bại";
      setPasswordMessage(message);
    } finally {
      setChangingPassword(false);
    }
  };

  const passwordInputClass =
    "w-full px-4 py-3 pr-12 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500";

  const eyeButtonClass =
    "absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800";

  if (loading) {
    return (
      <div className="text-center py-20">
        Đang tải thông tin cá nhân...
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 p-6">Lỗi: {error}</div>;
  }

  if (!user) return null;

  return (
    <div className="profile-page max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Thông tin cá nhân
        </h1>
        <p className="text-gray-600 mt-1">Quản lý tài khoản của bạn</p>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-gray-100">
        <h2 className="text-xl font-semibold mb-6">Thông tin tài khoản</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Email
            </label>
            <p className="text-lg font-medium text-gray-900">{user.email}</p>
          </div>

          <form
          onSubmit={handleUpdateProfile}
         className="space-y-4 !bg-transparent !border-0 !p-0 !shadow-none"
          >
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Họ và tên
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={updating}
              className="!bg-cyan-600 !text-white !border-cyan-600 px-6 py-3 rounded-2xl hover:!bg-cyan-700 transition disabled:opacity-70"
            >
              {updating ? "Đang cập nhật..." : "Cập nhật thông tin"}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-gray-100">
        <h2 className="text-xl font-semibold mb-6">Đổi mật khẩu</h2>
        <form
          onSubmit={handleChangePassword}
          className="space-y-4 !bg-transparent !border-0 !p-0 !shadow-none"
          >
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Mật khẩu cũ
            </label>

            <div className="relative">
              <input
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={passwordInputClass}
              />

              <button
                type="button"
                onClick={() => setShowOldPassword((prev) => !prev)}
                aria-label={showOldPassword ? "Ẩn mật khẩu cũ" : "Hiện mật khẩu cũ"}
                title={showOldPassword ? "Ẩn mật khẩu cũ" : "Hiện mật khẩu cũ"}
                className={eyeButtonClass}
              >
                {showOldPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Mật khẩu mới
            </label>

            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={passwordInputClass}
              />

              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-label={showNewPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                title={showNewPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                className={eyeButtonClass}
              >
                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Xác nhận mật khẩu mới
            </label>

            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={passwordInputClass}
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword
                    ? "Ẩn xác nhận mật khẩu"
                    : "Hiện xác nhận mật khẩu"
                }
                title={
                  showConfirmPassword
                    ? "Ẩn xác nhận mật khẩu"
                    : "Hiện xác nhận mật khẩu"
                }
                className={eyeButtonClass}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {passwordMessage && (
            <div
              className={`p-3 rounded-xl text-sm ${
                passwordMessage.includes("thành công")
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {passwordMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={changingPassword}
            className="!bg-slate-800 !text-white !border-slate-800 px-6 py-3 rounded-2xl hover:!bg-slate-900 transition disabled:opacity-70"
          >
            {changingPassword ? "Đang đổi mật khẩu..." : "Đổi mật khẩu"}
          </button>
        </form>
      </div>
    </div>
  );
}