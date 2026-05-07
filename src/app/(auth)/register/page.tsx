"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: ""
  });

  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
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
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Số điện thoại</label>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Mật khẩu</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <button type="submit" style={{ padding: "10px 16px" }}>
          Đăng ký
        </button>
      </form>

      {message && <p>{message}</p>}

      <p>
        Đã có tài khoản? <a href="/login">Đăng nhập</a>
      </p>
    </main>
  );
}