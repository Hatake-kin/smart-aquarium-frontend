"use client";

import { useEffect, useState } from "react";

type CameraDevice = {
  id: number;
  tank_id: number;
  device_code: string;
  name: string;
  device_status: string;
  camera_url: string | null;
  tank_name: string | null;
  tank_code: string | null;
  tank_status: string;
  owner_id: number;
  owner_email: string;
  owner_full_name: string | null;
  plan_type: "basic" | "premium";
  plan_expires_at: string | null;
  effective_plan: "basic" | "premium" | "manager";
  is_premium_expired: boolean;
  can_use_camera: boolean;
};

export default function CameraPage() {
  const API_URL = "http://localhost:5000";

  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [selectedCamera, setSelectedCamera] = useState<CameraDevice | null>(null);
  const [cameraUrl, setCameraUrl] = useState("");
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [displayMode, setDisplayMode] = useState<"img" | "iframe">("img");

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

  const loadCameraDevices = async () => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/camera`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Không lấy được danh sách camera");
        return;
      }

      const list: CameraDevice[] = data.devices || [];
      setDevices(list);

      if (list.length > 0) {
        setSelectedDeviceId(String(list[0].id));
      }
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const loadCameraDetail = async (deviceId: string) => {
    if (!deviceId) return;

    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/camera/devices/${deviceId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setSelectedCamera(data.device || null);
        setCameraUrl(data.device?.camera_url || "");
        setMessage(data.message || "Không xem được camera");
        return;
      }

      setSelectedCamera(data.device);
      setCameraUrl(data.camera_url || data.device?.camera_url || "");
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  const updateCameraUrl = async () => {
    if (!selectedDeviceId) {
      setMessage("Vui lòng chọn thiết bị");
      return;
    }

    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/api/camera/devices/${selectedDeviceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          camera_url: cameraUrl.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Cập nhật camera_url thất bại");
        return;
      }

      setMessage(data.message || "Cập nhật camera_url thành công");
      loadCameraDevices();
      loadCameraDetail(selectedDeviceId);
    } catch (err) {
      console.error(err);
      setMessage("Không kết nối được backend");
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadCameraDevices();
  }, []);

  useEffect(() => {
    if (selectedDeviceId) {
      loadCameraDetail(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  const getPlanLabel = (device?: CameraDevice | null) => {
    if (!device) return "Đang tải";

    if (device.effective_plan === "manager") {
      return "Quản trị viên / Moderator";
    }

    if (device.is_premium_expired) {
      return "Premium đã hết hạn";
    }

    if (device.effective_plan === "premium") {
      return "Premium còn hiệu lực";
    }

    return "Basic";
  };

  const canEditCamera =
    currentUser?.role === "admin" ||
    (currentUser?.role === "user" && selectedCamera?.can_use_camera);

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Camera ESP32-CAM</h1>
      <p>
        Tính năng camera dùng cho gói Premium. Camera có thể xem khác WiFi nếu
        camera_url là link public từ Cloudflare Tunnel, ngrok hoặc server public.
      </p>

      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
          background: "#fff",
        }}
      >
        <h2>Chọn thiết bị camera</h2>

        <select
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        >
          <option value="">-- Chọn thiết bị --</option>

          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              ID {device.id} - {device.name} - Bể {device.tank_name || device.tank_id}
            </option>
          ))}
        </select>

        {selectedCamera && (
          <div>
            <p>
              <b>Thiết bị:</b> {selectedCamera.name}
            </p>

            <p>
              <b>Mã thiết bị:</b> {selectedCamera.device_code}
            </p>

            <p>
              <b>Bể cá:</b> {selectedCamera.tank_name || selectedCamera.tank_id}
            </p>

            <p>
              <b>Chủ thiết bị:</b> {selectedCamera.owner_email}
            </p>

            <p>
              <b>Gói sử dụng:</b>{" "}
              <span
                style={{
                  fontWeight: "bold",
                  color: selectedCamera.can_use_camera ? "green" : "red",
                }}
              >
                {getPlanLabel(selectedCamera)}
              </span>
            </p>

            {selectedCamera.plan_expires_at && (
              <p>
                <b>Hạn Premium:</b>{" "}
                {new Date(selectedCamera.plan_expires_at).toLocaleString()}
              </p>
            )}

            {!selectedCamera.can_use_camera && (
              <p style={{ color: "red", fontWeight: "bold" }}>
                Tài khoản này không có quyền dùng camera. Cần Premium còn hiệu lực
                hoặc tài khoản quản trị.
              </p>
            )}
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
          background: "#fff",
        }}
      >
        <h2>Cấu hình camera_url</h2>

        <p>
          Với ESP32-CAM, URL thường có dạng local:
        </p>

        <pre
          style={{
            background: "#f1f5f9",
            padding: 12,
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
{`http://192.168.1.xxx:81/stream`}
        </pre>

        <p>
          Nếu muốn xem khác WiFi, dùng URL public từ Cloudflare Tunnel hoặc ngrok,
          ví dụ:
        </p>

        <pre
          style={{
            background: "#f1f5f9",
            padding: 12,
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
{`https://ten-tunnel.trycloudflare.com/stream`}
        </pre>

        <input
          value={cameraUrl}
          onChange={(e) => setCameraUrl(e.target.value)}
          placeholder="Nhập camera URL, ví dụ https://xxx.trycloudflare.com/stream"
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 12,
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        />

        <button
          onClick={updateCameraUrl}
          disabled={!canEditCamera}
          style={{
            padding: "10px 16px",
            cursor: canEditCamera ? "pointer" : "not-allowed",
          }}
        >
          Lưu camera_url
        </button>

        {!canEditCamera && (
          <p style={{ color: "#777" }}>
            Chỉ admin hoặc user Premium còn hiệu lực mới được cập nhật camera_url.
            Moderator chỉ được xem.
          </p>
        )}
      </section>

      {message && (
        <p
          style={{
            color:
              message.includes("thành công") || message.includes("Lấy camera")
                ? "green"
                : "red",
            fontWeight: "bold",
          }}
        >
          {message}
        </p>
      )}

      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 8,
          background: "#fff",
        }}
      >
        <h2>Xem camera</h2>

        <div style={{ marginBottom: 12 }}>
          <label>
            <input
              type="radio"
              checked={displayMode === "img"}
              onChange={() => setDisplayMode("img")}
            />{" "}
            Stream MJPEG bằng thẻ ảnh
          </label>

          <label style={{ marginLeft: 16 }}>
            <input
              type="radio"
              checked={displayMode === "iframe"}
              onChange={() => setDisplayMode("iframe")}
            />{" "}
            Nhúng bằng iframe
          </label>
        </div>

        {!selectedCamera?.can_use_camera && (
          <p style={{ color: "red" }}>
            Không thể xem camera vì gói hiện tại không hỗ trợ hoặc Premium đã hết hạn.
          </p>
        )}

        {selectedCamera?.can_use_camera && !cameraUrl && (
          <p>Thiết bị này chưa được cấu hình camera_url.</p>
        )}

        {selectedCamera?.can_use_camera && cameraUrl && (
          <div>
            <p>
              <b>URL đang xem:</b> {cameraUrl}
            </p>

            {displayMode === "img" ? (
              <div
                style={{
                  width: "100%",
                  minHeight: 360,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={cameraUrl}
                  alt="ESP32-CAM Stream"
                  style={{
                    maxWidth: "100%",
                    width: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
            ) : (
              <iframe
                src={cameraUrl}
                style={{
                  width: "100%",
                  height: 520,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                }}
              />
            )}
          </div>
        )}
      </section>
    </main>
  );
}