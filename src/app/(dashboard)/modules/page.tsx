"use client";

import { useEffect, useState } from "react";

type ModuleItem = {
  id: number;
  device_id: number;
  tank_id: number;
  module_code: string;
  name: string;
  connection_type: "gpio" | "wireless";
  io_mode: "input" | "output";
  module_type: string;
  pin?: number | null;
  pin2?: number | null;
  pin3?: number | null;
  unit?: string | null;
  protocol?: string | null;
  node_type?: string | null;
  node_code?: string | null;
  enabled: boolean;
  device_name?: string;
  device_code?: string;
  tank_name?: string;
  tank_code?: string;
  owner_email?: string;
  config_json?: any;
};

type Options = {
  gpio_pins: number[];
  connection_types: string[];
  io_modes: string[];
  input_module_types: string[];
  output_module_types: string[];
  wireless_protocols: string[];
};

export default function ModulesPage() {
  const API_URL = "";

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const getToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("token") || "";
  };

  const readJsonSafe = async (res: Response) => {
    const text = await res.text();

    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  };

  const loadOptions = async () => {
    const token = getToken();

    const res = await fetch(`${API_URL}/api/device-modules/meta/options`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await readJsonSafe(res);

    if (!res.ok) {
      throw new Error(data.message || "Không lấy được cấu hình module");
    }

    setOptions(data);
  };

  const loadModules = async () => {
    const token = getToken();

    const res = await fetch(`${API_URL}/api/device-modules`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await readJsonSafe(res);

    if (!res.ok) {
      throw new Error(data.message || "Không lấy được danh sách module");
    }

    setModules(data.modules || []);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setMessage("");

      await Promise.all([loadOptions(), loadModules()]);
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Không kết nối được backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const deleteModule = async (moduleId: number) => {
    const ok = window.confirm("Bạn chắc chắn muốn xóa module này?");
    if (!ok) return;

    try {
      setLoading(true);
      setMessage("");

      const token = getToken();

      const res = await fetch(`${API_URL}/api/device-modules/${moduleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        throw new Error(data.message || "Xóa module thất bại");
      }

      setMessage("Xóa module thành công");
      await loadModules();
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Không kết nối được backend");
    } finally {
      setLoading(false);
    }
  };

  const connectionLabel = (value: string) => {
    if (value === "gpio") return "Có dây / GPIO";
    if (value === "wireless") return "Không dây / Wireless";
    return value;
  };

  const modeLabel = (value: string) => {
    if (value === "input") return "Input / Cảm biến";
    if (value === "output") return "Output / Chấp hành";
    return value;
  };

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1>Cấu hình module</h1>

      <p style={{ color: "#475569" }}>
        Quản lý module có dây GPIO và module không dây cho thiết bị ESP.
      </p>

      <section
        style={{
          border: "1px solid #67e8f9",
          padding: 18,
          borderRadius: 18,
          marginBottom: 24,
          background: "rgba(255,255,255,0.92)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Tổng quan module</h2>
            <p style={{ margin: "6px 0 0", color: "#475569" }}>
              Đã cấu hình <b>{modules.length}</b> module.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid #0891b2",
              background: "#0891b2",
              color: "#fff",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Đang tải..." : "Refresh"}
          </button>
        </div>

        {message && (
          <p
            style={{
              marginTop: 12,
              color:
                message.includes("thành công") || message.includes("OK")
                  ? "#16a34a"
                  : "#dc2626",
              fontWeight: "bold",
            }}
          >
            {message}
          </p>
        )}
      </section>

      {options && (
        <section
          style={{
            border: "1px solid #cbd5e1",
            padding: 18,
            borderRadius: 18,
            marginBottom: 24,
            background: "#fff",
          }}
        >
          <h2>Option hệ thống</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <b>GPIO an toàn</b>
              <p>{options.gpio_pins.join(", ")}</p>
            </div>

            <div>
              <b>Input module</b>
              <p>{options.input_module_types.join(", ")}</p>
            </div>

            <div>
              <b>Output module</b>
              <p>{options.output_module_types.join(", ")}</p>
            </div>

            <div>
              <b>Wireless protocol</b>
              <p>{options.wireless_protocols.join(", ")}</p>
            </div>
          </div>
        </section>
      )}

      <section
        style={{
          border: "1px solid #67e8f9",
          padding: 18,
          borderRadius: 18,
          background: "rgba(255,255,255,0.92)",
        }}
      >
        <h2>Danh sách module</h2>

        {modules.length === 0 && <p>Chưa có module nào.</p>}

        {modules.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 16,
            }}
          >
            {modules.map((module) => (
              <article
                key={module.id}
                style={{
                  border: "1px solid #bae6fd",
                  borderRadius: 18,
                  padding: 16,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>{module.name}</h3>
                    <p style={{ margin: "6px 0", color: "#475569" }}>
                      {module.module_code}
                    </p>
                  </div>

                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontWeight: "bold",
                      fontSize: 12,
                      background: module.enabled ? "#f0fdf4" : "#f8fafc",
                      color: module.enabled ? "#16a34a" : "#64748b",
                      border: module.enabled
                        ? "1px solid #86efac"
                        : "1px solid #cbd5e1",
                    }}
                  >
                    {module.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>

                <p>
                  <b>Thiết bị:</b> {module.device_name || module.device_id}{" "}
                  {module.device_code ? `(${module.device_code})` : ""}
                </p>

                <p>
                  <b>Bể:</b> {module.tank_name || module.tank_id}{" "}
                  {module.tank_code ? `(${module.tank_code})` : ""}
                </p>

                <p>
                  <b>Kết nối:</b> {connectionLabel(module.connection_type)}
                </p>

                <p>
                  <b>Mode:</b> {modeLabel(module.io_mode)}
                </p>

                <p>
                  <b>Loại:</b> {module.module_type}
                </p>

                {module.connection_type === "gpio" && (
                  <p>
                    <b>GPIO:</b>{" "}
                    {[module.pin, module.pin2, module.pin3]
                      .filter((pin) => pin !== null && pin !== undefined)
                      .join(", ")}
                  </p>
                )}

                {module.connection_type === "wireless" && (
                  <>
                    <p>
                      <b>Protocol:</b> {module.protocol || "N/A"}
                    </p>
                    <p>
                      <b>Node:</b> {module.node_type || "N/A"} /{" "}
                      {module.node_code || "N/A"}
                    </p>
                  </>
                )}

                {module.unit && (
                  <p>
                    <b>Đơn vị:</b> {module.unit}
                  </p>
                )}

                {module.config_json && (
                  <details>
                    <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
                      Xem config_json
                    </summary>
                    <pre
                      style={{
                        background: "#f8fafc",
                        borderRadius: 12,
                        padding: 12,
                        overflowX: "auto",
                        fontSize: 12,
                      }}
                    >
                      {JSON.stringify(module.config_json, null, 2)}
                    </pre>
                  </details>
                )}

                <button
                  onClick={() => deleteModule(module.id)}
                  disabled={loading}
                  style={{
                    marginTop: 12,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #fecdd3",
                    background: "#fff1f2",
                    color: "#dc2626",
                    fontWeight: "bold",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  Xóa module
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}