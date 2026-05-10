"use client";

import { useState } from "react";
import { Eye, EyeOff, Waves } from "lucide-react";
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
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info"
  );
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
        setMessageType("error");
        return;
      }

      setUserId(data.user_id);
      setStep(2);
      setMessage(
        "Mã OTP đã được gửi về Gmail đăng ký. Vui lòng kiểm tra hộp thư đến hoặc spam."
      );
      setMessageType("success");
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend hoặc lỗi gửi OTP Gmail");
      setMessageType("error");
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
        setMessageType("error");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      router.push("/");
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-pink-300 px-4 py-3 text-slate-800 outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-100";

  const buttonClass =
    "rounded-2xl border border-pink-400 px-5 py-3 font-black text-pink-700 transition hover:bg-pink-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f8fafc] px-4 py-8 flex items-center justify-center">
      <section className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="rounded-2xl bg-pink-500 p-3 shadow-lg shadow-pink-200">
            <Waves className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">
              SMART<span className="text-pink-600">AQ</span>
            </h1>
            <p className="text-xs font-semibold text-slate-400">
              Smart Aquarium IoT
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-pink-200 bg-white p-5 shadow-xl shadow-pink-100/50 sm:p-7">
          <h2 className="mb-5 text-xl font-black text-slate-800">
            {step === 1 ? "Đăng nhập" : "Xác thực OTP"}
          </h2>

          {step === 1 && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-2 block font-bold text-pink-900">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  value={loginForm.email}
                  onChange={handleLoginChange}
                  autoComplete="email"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block font-bold text-pink-900">
                  Mật khẩu
                </label>

                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    autoComplete="current-password"
                    className={inputClass + " pr-12"}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-pink-600 hover:bg-pink-50"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? "Đang gửi OTP..." : "Tiếp tục"}
              </button>

              <div className="space-y-2 pt-1 text-sm text-slate-600">
                <p>
                  Chưa có tài khoản?{" "}
                  <Link
                    href="/register"
                    className="font-black text-pink-700 hover:underline"
                  >
                    Đăng ký
                  </Link>
                </p>

                <p>
                  <Link
                    href="/forgot-password"
                    className="font-semibold text-pink-700 hover:underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </p>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-semibold text-cyan-800">
                Mã OTP đã được gửi về Gmail đăng ký. Vui lòng kiểm tra hộp thư
                đến hoặc mục spam.
              </p>

              <div>
                <label className="mb-2 block font-bold text-pink-900">
                  Nhập mã OTP
                </label>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: A7K2P9QX"
                  className={inputClass + " uppercase tracking-widest"}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={loading} className={buttonClass}>
                  {loading ? "Đang xác thực..." : "Xác thực OTP"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtp("");
                    setMessage("");
                  }}
                  className="rounded-2xl border border-slate-200 px-5 py-3 font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Quay lại
                </button>
              </div>
            </form>
          )}

          {message && (
            <p
              className={[
                "mt-5 rounded-2xl border p-3 text-sm font-bold",
                messageType === "error"
                  ? "border-red-200 bg-red-50 text-red-600"
                  : messageType === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-slate-200 bg-slate-50 text-slate-600",
              ].join(" ")}
            >
              {message}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
