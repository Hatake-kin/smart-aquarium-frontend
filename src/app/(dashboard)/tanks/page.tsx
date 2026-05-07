"use client";

import { useEffect, useState } from "react";

type Tank = {
  id: number;
  user_id: number;
  tank_code: string;
  name: string;
  package_type: "basic" | "premium";
  created_at: string;
  updated_at?: string;
  email?: string;
  full_name?: string;
};

export default function TanksPage() {
  const API_URL = "";

  const [tanks, setTanks] = useState<Tank[]>([]);
  const [name, setName] = useState("");
  const [packageType, setPackageType] = useState<"basic" | "premium">("basic");
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

  const loadTanks = async () => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/tanks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Không lấy được danh sách bể cá");
        return;
      }

      setTanks(data.tanks || []);
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadTanks();
  }, []);

  const handleCreateTank = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!name.trim()) {
      setMessage("Vui lòng nhập tên bể cá");
      return;
    }

    try {
      const token = getToken();

      const body: any = {
        name: name.trim(),
      };

      // Chỉ admin mới gửi package_type lên backend.
      // User/Moderator không gửi, backend tự gán basic.
      if (currentUser?.role === "admin") {
        body.package_type = packageType;
      }

      const res = await fetch(`${API_URL}/api/tanks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Tạo bể cá thất bại");
        return;
      }

      setMessage("Tạo bể cá thành công");
      setName("");
      setPackageType("basic");

      loadTanks();
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const isAdmin = currentUser?.role === "admin";

  return (
    <main style={{ padding: 24, maxWidth: 1000 }}>
      <h1>Bể cá của tôi</h1>

      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
          background: "#fff",
        }}
      >
        <h2>Tạo bể cá mới</h2>

        <form onSubmit={handleCreateTank}>
          <div style={{ marginBottom: 12 }}>
            <label>Tên bể cá</label>
            <br />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bể cá phòng khách"
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          {isAdmin ? (
            <div style={{ marginBottom: 12 }}>
              <label>Gói sử dụng</label>
              <br />
              <select
                value={packageType}
                onChange={(e) =>
                  setPackageType(e.target.value as "basic" | "premium")
                }
                style={{ width: "100%", padding: 8 }}
              >
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
              </select>

              <p style={{ marginTop: 8, color: "#555" }}>
                {packageType === "basic"
                  ? "Basic: gói mặc định, tối đa 1 bể cho user thường, tối đa 3 thiết bị/bể, biểu đồ 20 điểm."
                  : "Premium: gói nâng cấp do admin cấp, nhiều bể, nhiều thiết bị, biểu đồ 100 điểm, hỗ trợ camera/cảnh báo nâng cao."}
              </p>
            </div>
          ) : (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                background: "#eef6ff",
                borderRadius: 8,
              }}
            >
              <b>Gói hiện tại khi tạo bể: Basic</b>
              <p style={{ margin: "8px 0 0", color: "#555" }}>
                Người dùng thường không thể tự chọn Premium. Vui lòng liên hệ
                admin để nâng cấp gói.
              </p>
            </div>
          )}

          <button type="submit" style={{ padding: "10px 16px" }}>
            Tạo bể cá
          </button>
        </form>

        {message && (
          <p
            style={{
              color:
                message.includes("thất bại") ||
                message.includes("Không") ||
                message.includes("không") ||
                message.includes("chỉ cho phép")
                  ? "red"
                  : "green",
            }}
          >
            {message}
          </p>
        )}
      </section>

      <section>
        <h2>Danh sách bể cá</h2>

        <table
          border={1}
          cellPadding={8}
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
          }}
        >
          <thead>
            <tr>
              <th>ID</th>
              <th>Mã bể</th>
              <th>Tên bể</th>
              <th>Gói</th>
              <th>Người sở hữu</th>
              <th>Ngày tạo</th>
            </tr>
          </thead>

          <tbody>
            {tanks.map((tank) => (
              <tr key={tank.id}>
                <td>{tank.id}</td>
                <td>{tank.tank_code}</td>
                <td>{tank.name}</td>
                <td>
                  <span
                    style={{
                      fontWeight: "bold",
                      color:
                        tank.package_type === "premium" ? "#7c3aed" : "#2563eb",
                    }}
                  >
                    {tank.package_type}
                  </span>
                </td>
                <td>{tank.full_name || tank.email || tank.user_id}</td>
                <td>
                  {tank.created_at
                    ? new Date(tank.created_at).toLocaleString()
                    : ""}
                </td>
              </tr>
            ))}

            {tanks.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  Chưa có bể cá nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}