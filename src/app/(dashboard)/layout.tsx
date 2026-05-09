"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import io from "socket.io-client";
import {
  LayoutDashboard,
  Fish,
  Cpu,
  Power,
  LogOut,
  Loader2,
  Bell,
  ChevronRight,
  Camera,
  SlidersHorizontal,
  TriangleAlert,
  FileText,
  Users,
  UserCircle,
  Waves,
  X,
  CheckCheck,
} from "lucide-react";

type UserData = {
  id?: number;
  name?: string;
  full_name?: string;
  email?: string;
  role?: "user" | "admin" | "moderator";
};

type NavItem = {
  name: string;
  href: string;
  icon: any;
  adminOnly?: boolean;
  managerOnly?: boolean;
};

type RealtimeNotification = {
  id: string;
  tankId?: number;
  message: string;
  severity?: "low" | "medium" | "high" | string;
  timestamp: string;
};

const getRealtimeUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:5000";
    }

    if (
      host.startsWith("169.254.") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    ) {
      return `http://${host}:5000`;
    }

    return window.location.origin;
  }

  return "http://localhost:5000";
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);

  const [notifications, setNotifications] = useState<RealtimeNotification[]>(
    []
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [socketStatus, setSocketStatus] = useState<"online" | "offline">(
    "offline"
  );

  const [greeting, setGreeting] = useState("Chào bạn");

  const updateGreeting = useCallback(() => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 11) {
      setGreeting("Chào buổi sáng");
    } else if (hour >= 11 && hour < 13) {
      setGreeting("Chào buổi trưa");
    } else if (hour >= 13 && hour < 18) {
      setGreeting("Chào buổi chiều");
    } else if (hour >= 18 && hour < 22) {
      setGreeting("Chào buổi tối");
    } else {
      setGreeting("Chào buổi khuya");
    }
  }, []);

  useEffect(() => {
    updateGreeting();

    const timer = setInterval(() => {
      updateGreeting();
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, [updateGreeting]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        handleLogout();
        return;
      }

      try {
        const res = await fetch("/api/users/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error("Session expired");
        }

        const data = await res.json();

        const apiUser = data.user || data;

        const rawLocalUser = localStorage.getItem("user");
        const localUser = rawLocalUser ? JSON.parse(rawLocalUser) : {};

        const finalUser = {
          ...localUser,
          ...apiUser,
          role: apiUser.role || localUser.role,
        };

        setUserData(finalUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Xác thực thất bại:", error);
        handleLogout();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [handleLogout]);

  useEffect(() => {
    if (!isAuthenticated || !userData?.id) return;

    const token = localStorage.getItem("token") || "";
    const realtimeUrl = getRealtimeUrl();

   const socketOptions = {
  path: "/realtime",
  transports: ["polling"],
  upgrade: false,
  auth: {
    token,
  },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 10000,
};

    const socket = realtimeUrl
      ? io(realtimeUrl, socketOptions)
      : io(socketOptions);

    socket.on("connect", () => {
      setSocketStatus("online");

      socket.emit("join_user_room", userData.id);
      socket.emit("join_user", userData.id);

      if (userData.role === "admin" || userData.role === "moderator") {
        socket.emit("join_manager_room", userData.role);
      }
    });

    socket.on("disconnect", () => {
      setSocketStatus("offline");
    });

    socket.on("connect_error", (err: Error) => {
      console.warn("Socket connect error:", err.message);
      setSocketStatus("offline");
    });

    socket.on("alert", (payload: any) => {
      const item: RealtimeNotification = {
        id: `${Date.now()}_${Math.random()}`,
        tankId: payload.tankId || payload.tank_id,
        message: payload.message || "Có cảnh báo mới từ hệ thống",
        severity: payload.severity || "medium",
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      setNotifications((prev) => [item, ...prev].slice(0, 10));
      setUnreadCount((prev) => prev + 1);
    });

    socket.on("sensor_update", (payload: any) => {
      if (!payload?.alert && !payload?.message) return;

      const item: RealtimeNotification = {
        id: `${Date.now()}_${Math.random()}`,
        tankId: payload.tankId || payload.tank_id,
        message:
          payload.message ||
          payload.alert ||
          "Dữ liệu cảm biến bất thường",
        severity: payload.severity || "medium",
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      setNotifications((prev) => [item, ...prev].slice(0, 10));
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, userData?.id, userData?.role]);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const navigation: NavItem[] = [
    { name: "Tổng quan", href: "/", icon: LayoutDashboard },
    { name: "Bể cá của tôi", href: "/tanks", icon: Fish },
    { name: "Thiết bị", href: "/devices", icon: Cpu },
    { name: "Cấu hình module", href: "/modules", icon: SlidersHorizontal },
    { name: "Điều khiển", href: "/actuators", icon: Power },
    { name: "Camera", href: "/camera", icon: Camera },
    { name: "Cài đặt ngưỡng", href: "/thresholds", icon: SlidersHorizontal },
    { name: "Lịch sử cảnh báo", href: "/alerts", icon: TriangleAlert },
    {
      name: "Nhật ký hệ thống",
      href: "/system-logs",
      icon: FileText,
      managerOnly: true,
    },
    {
      name: "Quản lý người dùng",
      href: "/admin/users",
      icon: Users,
      managerOnly: true,
    },
    { name: "Cá nhân", href: "/profile", icon: UserCircle },
  ];

  const visibleNavigation = navigation.filter((item) => {
    if (item.adminOnly && userData?.role !== "admin") {
      return false;
    }

    if (
      item.managerOnly &&
      userData?.role !== "admin" &&
      userData?.role !== "moderator"
    ) {
      return false;
    }

    return true;
  });

  const displayName =
    userData?.name || userData?.full_name || userData?.email || "User";

  const roleLabel =
    userData?.role === "admin"
      ? "Quản trị viên"
      : userData?.role === "moderator"
      ? "Điều phối viên"
      : "Thành viên SmartAquarium";

  const pageTitle = isActive("/")
    ? "Bảng điều khiển"
    : isActive("/tanks")
    ? "Quản lý bể cá"
    : isActive("/devices")
    ? "Quản lý thiết bị"
    : isActive("/modules")
    ? "Cấu hình module"
    : isActive("/actuators")
    ? "Điều khiển thiết bị"
    : isActive("/camera")
    ? "Camera"
    : isActive("/thresholds")
    ? "Cài đặt ngưỡng"
    : isActive("/alerts")
    ? "Lịch sử cảnh báo"
    : isActive("/system-logs")
    ? "Nhật ký hệ thống"
    : isActive("/admin/users")
    ? "Quản lý người dùng"
    : isActive("/profile")
    ? "Thông tin cá nhân"
    : "Smart Aquarium";

  const formatTime = (value: string) => {
    try {
      return new Date(value).toLocaleString("vi-VN");
    } catch {
      return value;
    }
  };

  const getSeverityStyle = (severity?: string) => {
    if (severity === "high") {
      return {
        color: "#dc2626",
        background: "#fff1f2",
        border: "#fecdd3",
        label: "Nghiêm trọng",
      };
    }

    if (severity === "low") {
      return {
        color: "#2563eb",
        background: "#eff6ff",
        border: "#bfdbfe",
        label: "Nhẹ",
      };
    }

    return {
      color: "#d97706",
      background: "#fffbeb",
      border: "#fde68a",
      label: "Trung bình",
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <div className="relative flex items-center justify-center">
          <Loader2 className="h-14 w-14 animate-spin text-blue-600" />
          <Waves className="absolute h-5 w-5 text-blue-400 animate-pulse" />
        </div>
        <p className="mt-4 text-slate-500 font-semibold tracking-wide">
          ĐANG XÁC THỰC...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex">
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col fixed h-full z-20 shadow-xl shadow-slate-200/50">
        <div className="p-8 border-b border-slate-50">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
              <Waves className="text-white" size={26} strokeWidth={2.8} />
            </div>
            <span className="text-xl font-black text-slate-800 tracking-tighter">
              SMART<span className="text-blue-600">AQ</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4 mb-4">
            Menu chính
          </p>

          {visibleNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                isActive(item.href)
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                  : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
              }`}
            >
              <div className="flex items-center gap-3 font-bold text-sm">
                <item.icon
                  size={22}
                  strokeWidth={isActive(item.href) ? 2.8 : 2.3}
                />
                <span>{item.name}</span>
              </div>

              {isActive(item.href) && (
                <ChevronRight
                  size={16}
                  className="animate-in slide-in-from-left-2"
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-5 py-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-200 font-bold text-sm active:scale-95"
          >
            <LogOut size={20} />
            <span>Đăng xuất hệ thống</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col ml-72">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-10 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-slate-800 font-black text-xl tracking-tight">
              {pageTitle}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {greeting}, {displayName}!
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotificationOpen((prev) => !prev);
                  setUnreadCount(0);
                }}
                className="relative p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all group"
                title={
                  socketStatus === "online"
                    ? "Thông báo realtime đang kết nối"
                    : "Thông báo realtime chưa kết nối"
                }
              >
                <Bell size={22} />

                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}

                <span
                  className={`absolute bottom-1 right-1 w-2 h-2 rounded-full border border-white ${
                    socketStatus === "online" ? "bg-green-500" : "bg-slate-400"
                  }`}
                />
              </button>

              {isNotificationOpen && (
                <div className="absolute right-0 mt-3 w-96 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/70 overflow-hidden z-50">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-800">
                        Thông báo realtime
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Trạng thái:{" "}
                        <b
                          className={
                            socketStatus === "online"
                              ? "text-green-600"
                              : "text-red-500"
                          }
                        >
                          {socketStatus === "online"
                            ? "Đang kết nối"
                            : "Mất kết nối"}
                        </b>
                      </p>
                    </div>

                    <button
                      onClick={() => setIsNotificationOpen(false)}
                      className="p-2 rounded-xl hover:bg-slate-50 text-slate-400"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 && (
                      <div className="p-6 text-center">
                        <p className="text-slate-500 font-semibold">
                          Chưa có thông báo mới
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          Khi MQTT phát hiện cảnh báo, thông báo sẽ xuất hiện ở
                          đây.
                        </p>
                      </div>
                    )}

                    {notifications.map((item) => {
                      const s = getSeverityStyle(item.severity);

                      return (
                        <div
                          key={item.id}
                          className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-2xl flex items-center justify-center"
                              style={{
                                background: s.background,
                                border: `1px solid ${s.border}`,
                                color: s.color,
                              }}
                            >
                              <TriangleAlert size={20} />
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className="text-[10px] font-bold uppercase px-2 py-1 rounded-full"
                                  style={{
                                    color: s.color,
                                    background: s.background,
                                    border: `1px solid ${s.border}`,
                                  }}
                                >
                                  {s.label}
                                </span>

                                {item.tankId && (
                                  <span className="text-[10px] text-slate-400 font-bold">
                                    Bể #{item.tankId}
                                  </span>
                                )}
                              </div>

                              <p className="text-sm text-slate-700 font-semibold leading-relaxed">
                                {item.message}
                              </p>

                              <p className="text-[11px] text-slate-400 mt-2">
                                {formatTime(item.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setUnreadCount(0);
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-2"
                    >
                      <CheckCheck size={15} />
                      Đánh dấu đã xem
                    </button>

                    <Link
                      href="/alerts"
                      onClick={() => setIsNotificationOpen(false)}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Xem lịch sử cảnh báo
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pl-6 border-l border-slate-100">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-slate-700 leading-none">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-tighter">
                  {roleLabel}
                </p>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-white shadow-md flex items-center justify-center text-white font-bold">
                {displayName?.charAt(0)?.toUpperCase() || (
                  <UserCircle size={22} />
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-10">
          <div className="max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-700">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}