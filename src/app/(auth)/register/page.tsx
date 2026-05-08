"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });

  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!form.full_name.trim()) {
      setMessage("Vui lòng nhập họ tên");
      return;
    }

    if (!form.email.trim()) {
      setMessage("Vui lòng nhập email");
      return;
    }

    if (!form.password) {
      setMessage("Vui lòng nhập mật khẩu");
      return;
    }

    if (form.password.length < 6) {
      setMessage("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    if (form.password !== confirmPassword) {
      setMessage("Mật khẩu nhập lại không khớp");
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Đăng ký thất bại");
        return;
      }

      setMessage("Tạo tài khoản thành công. Đang chuyển sang đăng nhập...");

      setTimeout(() => {
        router.push("/login");
      }, 1000);
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const inputStyle = {
    width: "100%",
    padding: 8,
    boxSizing: "border-box" as const,
  };

  const passwordInputStyle = {
    width: "100%",
    padding: "8px 40px 8px 8px",
    boxSizing: "border-box" as const,
  };

  const eyeButtonStyle = {
    position: "absolute" as const,
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#9f4772",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  };

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", fontFamily: "Arial" }}>
      <h1>Tạo tài khoản</h1>

      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: 12 }}>
          <label>Họ tên</label>
          <input
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Số điện thoại</label>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            autoComplete="tel"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Mật khẩu</label>

          <div style={{ position: "relative" }}>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              style={passwordInputStyle}
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              style={eyeButtonStyle}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Nhập lại mật khẩu</label>

          <div style={{ position: "relative" }}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              style={passwordInputStyle}
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={
                showConfirmPassword
                  ? "Ẩn mật khẩu nhập lại"
                  : "Hiện mật khẩu nhập lại"
              }
              title={
                showConfirmPassword
                  ? "Ẩn mật khẩu nhập lại"
                  : "Hiện mật khẩu nhập lại"
              }
              style={eyeButtonStyle}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" style={{ padding: "10px 16px" }}>
          Đăng ký
        </button>
      </form>

      {message && (
        <p
          style={{
            color:
              message.includes("thành công") || message.includes("Đang chuyển")
                ? "green"
                : "red",
          }}
        >
          {message}
        </p>
      )}

      <p>
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          style={{
            color: "#9f4772",
            fontWeight: 600,
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = "underline";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = "none";
          }}
        >
          Đăng nhập
        </Link>
      </p>
    </main>
  );
}