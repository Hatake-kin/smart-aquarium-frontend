"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const API_URL = "";

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!email.trim()) {
      setMessage("Vui lòng nhập email");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Gửi OTP thất bại");
        return;
      }

      setMessage(data.message || "OTP đã được gửi về Gmail");
      setStep("reset");
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!email.trim() || !otp.trim() || !newPassword) {
      setMessage("Vui lòng nhập đầy đủ email, OTP và mật khẩu mới");
      return;
    }

    if (newPassword.length < 6) {
      setMessage("Mật khẩu mới phải từ 6 ký tự trở lên");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Mật khẩu xác nhận không khớp");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          new_password: newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Đặt lại mật khẩu thất bại");
        return;
      }

      setMessage("Đặt lại mật khẩu thành công. Đang chuyển về đăng nhập...");

      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
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
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 430,
          border: "1.5px solid #f9a8d4",
          borderRadius: 22,
          padding: 24,
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 20px 50px rgba(236,72,153,0.12)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Lấy lại mật khẩu</h1>

        <p style={{ color: "#8b5f73" }}>
          Nhập email đăng ký để nhận OTP đặt lại mật khẩu qua Gmail.
        </p>

        {step === "request" && (
          <form onSubmit={requestOtp}>
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email tài khoản"
              type="email"
              style={{ width: "100%", padding: 10 }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: 12, padding: "10px 16px" }}
            >
              {loading ? "Đang gửi OTP..." : "Gửi OTP"}
            </button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={resetPassword}>
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email tài khoản"
              type="email"
              style={{ width: "100%", padding: 10 }}
            />

            <label>Mã OTP</label>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.toUpperCase())}
              placeholder="Nhập mã OTP trong Gmail"
              style={{ width: "100%", padding: 10 }}
            />

            <label>Mật khẩu mới</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mật khẩu mới"
              type="password"
              style={{ width: "100%", padding: 10 }}
            />

            <label>Xác nhận mật khẩu mới</label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              type="password"
              style={{ width: "100%", padding: 10 }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button type="submit" disabled={loading}>
                {loading ? "Đang đổi..." : "Đổi mật khẩu"}
              </button>

              <button
                type="button"
                onClick={() => setStep("request")}
                disabled={loading}
              >
                Gửi lại OTP
              </button>
            </div>
          </form>
        )}

        {message && (
          <p
            style={{
              marginTop: 14,
              fontWeight: "bold",
              color:
                message.includes("thành công") || message.includes("gửi")
                  ? "#16a34a"
                  : "#dc2626",
            }}
          >
            {message}
          </p>
        )}

        <p style={{ marginTop: 18 }}>
          <Link href="/login">Quay lại đăng nhập</Link>
        </p>
      </section>
    </main>
  );
}