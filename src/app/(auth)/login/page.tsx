"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<number | null>(null);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginForm({
      ...loginForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Đăng nhập thất bại");
        return;
      }

      setUserId(data.user_id);
      setStep(2);
      setMessage(
        "Mã OTP đã được gửi về Gmail đăng ký. Vui lòng kiểm tra hộp thư đến hoặc spam."
      );
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend hoặc lỗi gửi OTP Gmail");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          otp: otp.toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Xác thực OTP thất bại");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      router.push("/");
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "80px auto",
        fontFamily: "Arial",
      }}
    >
      <h1>Đăng nhập</h1>

      {step === 1 && (
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input
              name="email"
              type="email"
              value={loginForm.email}
              onChange={handleLoginChange}
              autoComplete="email"
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Mật khẩu</label>

            <div style={{ position: "relative" }}>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={loginForm.password}
                onChange={handleLoginChange}
                autoComplete="current-password"
                style={{
                  width: "100%",
                  padding: "8px 40px 8px 8px",
                  boxSizing: "border-box",
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                style={{
                  position: "absolute",
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
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ padding: "10px 16px" }}
          >
            {loading ? "Đang gửi OTP..." : "Tiếp tục"}
          </button>

          <div style={{ marginTop: 12 }}>
            <p style={{ margin: "8px 0" }}>
              Chưa có tài khoản?{" "}
<Link
  href="/register"
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
  Đăng ký
</Link>
            </p>

            <p style={{ margin: "8px 0" }}>
              <Link href="/forgot-password">Quên mật khẩu?</Link>
            </p>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyOtp}>
          <p style={{ background: "#eef6ff", padding: 8 }}>
            Mã OTP đã được gửi về Gmail đăng ký. Vui lòng kiểm tra hộp thư đến
            hoặc mục spam.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label>Nhập mã OTP</label>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.toUpperCase())}
              placeholder="Ví dụ: A7K2P9QX"
              style={{
                width: "100%",
                padding: 8,
                textTransform: "uppercase",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ padding: "10px 16px" }}
          >
            {loading ? "Đang xác thực..." : "Xác thực OTP"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep(1);
              setOtp("");
              setMessage("");
            }}
            style={{ padding: "10px 16px", marginLeft: 8 }}
          >
            Quay lại
          </button>
        </form>
      )}

      {message && (
        <p
          style={{
            marginTop: 16,
            color:
              message.includes("thất bại") || message.includes("Không")
                ? "red"
                : "green",
          }}
        >
          {message}
        </p>
      )}
    </main>
  );
}