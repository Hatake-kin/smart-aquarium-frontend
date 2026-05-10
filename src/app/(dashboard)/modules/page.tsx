"use client";

import { useEffect, useMemo, useState } from "react";
import io from "socket.io-client";

type DeviceInfo = {
  id: number;
  tank_id: number;
  device_code: string;
  name: string;
  status?: string;
  tank_name?: string;
  tank_code?: string;
  tank_status?: string;
  owner_id?: number;
  owner_email?: string;
};

type TankOption = {
  id: number;
  name: string;
  code?: string;
  owner_email?: string;
};

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

type ModuleOptions = {
  gpio_pins: number[];
  connection_types: string[];
  io_modes: string[];
  input_module_types: string[];
  output_module_types: string[];
  wireless_protocols: string[];
};

type DeviceModuleResponse = {
  message: string;
  device?: any;
  modules?: ModuleItem[];
  gpio?: {
    safe_pins: number[];
    used_pins: {
      pin: number;
      module_id: number;
      module_name: string;
      module_type: string;
    }[];
    free_pins: number[];
  };
};

type MessageType = "idle" | "success" | "error" | "loading";

type ConfigAckPayload = {
  userId?: number;
  tankId?: number;
  deviceId?: number;
  device_id?: number;
  status?: "applied" | "error" | "ignored" | string;
  message?: string;
  module_count?: number | null;
  millis?: number | null;
  timestamp?: string;
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

const defaultConfigByType = (moduleType: string) => {
  switch (moduleType) {
    case "ds18b20":
      return {
        read_interval_ms: 5000,
      };

    case "hc_sr04":
      return {
        trig_pin: 6,
        echo_pin: 7,
        tank_depth_cm: 30,
        mount_offset_cm: 0,
        read_interval_ms: 5000,
      };

    case "ph_sensor":
      return {
        analog_pin: 34,
        read_interval_ms: 5000,
        calibration_offset: 0,
      };

    case "turbidity_sensor":
      return {
        analog_pin: 35,
        read_interval_ms: 5000,
      };

    case "dht22":
      return {
        read_interval_ms: 5000,
      };

    case "light":
      return {
        active_high: true,
      };

    case "servo_feeder":
      return {
        default_angle: 0,
        feed_angle: 90,
        duration_ms: 900,
      };

    case "pump":
    case "oxygen":
    case "buzzer":
    case "relay":
      return {
        active_high: true,
      };

    default:
      return {};
  }
};

const defaultUnitByType = (moduleType: string) => {
  switch (moduleType) {
    case "ds18b20":
      return "°C";
    case "hc_sr04":
      return "%";
    case "ph_sensor":
      return "pH";
    case "turbidity_sensor":
      return "NTU";
    case "dht22":
      return "%";
    default:
      return "";
  }
};

const MODULE_META: Record<
  string,
  {
    label: string;
    defaultName: string;
    codeBase: string;
    description: string;
    pinLabels: [string, string, string];
    pinPlaceholders: [string, string, string];
  }
> = {
  ds18b20: {
    label: "Cảm biến nhiệt độ nước DS18B20",
    defaultName: "Cảm biến nhiệt độ nước",
    codeBase: "temp_ds18b20_main",
    description:
      "Đo nhiệt độ nước bằng cảm biến DS18B20. Người dùng chỉ cần chọn chân DATA.",
    pinLabels: ["Chân DATA của DS18B20", "Chân phụ 1", "Chân phụ 2"],
    pinPlaceholders: [
      "-- Chọn chân DATA --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
  hc_sr04: {
    label: "Cảm biến mực nước HC-SR04",
    defaultName: "Cảm biến mực nước",
    codeBase: "water_hcsr04_main",
    description:
      "Đo khoảng cách tới mặt nước. Cần 2 chân: TRIG để phát xung và ECHO để nhận tín hiệu.",
    pinLabels: [
      "Chân TRIG của HC-SR04",
      "Chân ECHO của HC-SR04",
      "Chân phụ 2",
    ],
    pinPlaceholders: [
      "-- Chọn chân TRIG --",
      "-- Chọn chân ECHO --",
      "-- Không dùng --",
    ],
  },
  ph_sensor: {
    label: "Cảm biến pH",
    defaultName: "Cảm biến pH",
    codeBase: "ph_sensor_main",
    description:
      "Đọc tín hiệu pH qua chân analog/ADC. Nên chọn chân ADC phù hợp trên ESP32.",
    pinLabels: [
      "Chân analog/ADC của cảm biến pH",
      "Chân phụ 1",
      "Chân phụ 2",
    ],
    pinPlaceholders: [
      "-- Chọn chân analog/ADC --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
  turbidity_sensor: {
    label: "Cảm biến độ đục nước",
    defaultName: "Cảm biến độ đục nước",
    codeBase: "turbidity_main",
    description:
      "Đọc độ đục nước qua chân analog/ADC. Nên chọn chân ADC phù hợp trên ESP32.",
    pinLabels: [
      "Chân analog/ADC của cảm biến độ đục",
      "Chân phụ 1",
      "Chân phụ 2",
    ],
    pinPlaceholders: [
      "-- Chọn chân analog/ADC --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
  dht22: {
    label: "Cảm biến nhiệt độ/độ ẩm DHT22",
    defaultName: "Cảm biến DHT22",
    codeBase: "dht22_main",
    description:
      "Đo nhiệt độ/độ ẩm không khí bằng DHT22. Người dùng chỉ cần chọn chân DATA.",
    pinLabels: ["Chân DATA của DHT22", "Chân phụ 1", "Chân phụ 2"],
    pinPlaceholders: [
      "-- Chọn chân DATA --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
  analog_sensor: {
    label: "Cảm biến analog",
    defaultName: "Cảm biến analog",
    codeBase: "analog_sensor_main",
    description: "Cảm biến đọc tín hiệu analog qua chân ADC.",
    pinLabels: ["Chân analog/ADC", "Chân phụ 1", "Chân phụ 2"],
    pinPlaceholders: [
      "-- Chọn chân analog/ADC --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
  light: {
    label: "Đèn hồ cá",
    defaultName: "Đèn hồ cá",
    codeBase: "light_main",
    description: "Điều khiển đèn ON/OFF bằng GPIO qua relay hoặc MOSFET.",
    pinLabels: ["Chân điều khiển đèn", "Chân phụ 1", "Chân phụ 2"],
    pinPlaceholders: [
      "-- Chọn chân điều khiển đèn --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
  servo_feeder: {
    label: "Servo cho ăn",
    defaultName: "Servo cho ăn",
    codeBase: "servo_feeder_main",
    description:
      "Điều khiển servo cho ăn bằng tín hiệu PWM. Người dùng chỉ cần chọn chân tín hiệu servo.",
    pinLabels: ["Chân tín hiệu PWM servo", "Chân phụ 1", "Chân phụ 2"],
    pinPlaceholders: [
      "-- Chọn chân PWM servo --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
  pump: {
    label: "Máy bơm",
    defaultName: "Máy bơm",
    codeBase: "pump_main",
    description: "Điều khiển máy bơm ON/OFF qua relay hoặc MOSFET.",
    pinLabels: ["Chân điều khiển máy bơm", "Chân phụ 1", "Chân phụ 2"],
    pinPlaceholders: [
      "-- Chọn chân điều khiển máy bơm --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
  oxygen: {
    label: "Sủi oxy",
    defaultName: "Sủi oxy",
    codeBase: "oxygen_main",
    description: "Điều khiển sủi oxy ON/OFF qua relay hoặc MOSFET.",
    pinLabels: ["Chân điều khiển sủi oxy", "Chân phụ 1", "Chân phụ 2"],
    pinPlaceholders: [
      "-- Chọn chân điều khiển sủi oxy --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
  buzzer: {
    label: "Còi cảnh báo",
    defaultName: "Còi cảnh báo",
    codeBase: "buzzer_main",
    description: "Điều khiển còi cảnh báo bằng GPIO.",
    pinLabels: ["Chân điều khiển còi", "Chân phụ 1", "Chân phụ 2"],
    pinPlaceholders: [
      "-- Chọn chân điều khiển còi --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
  relay: {
    label: "Relay",
    defaultName: "Relay",
    codeBase: "relay_main",
    description: "Điều khiển relay ON/OFF bằng GPIO.",
    pinLabels: ["Chân điều khiển relay", "Chân phụ 1", "Chân phụ 2"],
    pinPlaceholders: [
      "-- Chọn chân điều khiển relay --",
      "-- Không dùng --",
      "-- Không dùng --",
    ],
  },
};

const getModuleMeta = (moduleType: string) => {
  return (
    MODULE_META[moduleType] || {
      label: moduleType,
      defaultName: moduleType,
      codeBase: `${moduleType}_main`,
      description: "",
      pinLabels: ["Chân điều khiển", "Chân phụ 1", "Chân phụ 2"] as [
        string,
        string,
        string
      ],
      pinPlaceholders: [
        "-- Chọn GPIO --",
        "-- Không dùng --",
        "-- Không dùng --",
      ] as [string, string, string],
    }
  );
};

const getRequiredPinCount = (moduleType: string) => {
  switch (moduleType) {
    case "hc_sr04":
      return 2;
    default:
      return 1;
  }
};

const getPinSuggestionText = (moduleType: string, freePins: number[] = []) => {
  const meta = getModuleMeta(moduleType);
  const requiredCount = getRequiredPinCount(moduleType);
  const suggestedPins = freePins.slice(0, requiredCount);

  if (suggestedPins.length < requiredCount) {
    return `Không đủ GPIO trống cho ${meta.label}. Hãy xóa hoặc chuyển module khác sang chân khác.`;
  }

  if (moduleType === "hc_sr04") {
    return `Gợi ý đấu HC-SR04: TRIG dùng GPIO ${suggestedPins[0]}, ECHO dùng GPIO ${suggestedPins[1]}. Lưu ý ECHO của HC-SR04 thường là 5V, cần hạ áp về 3.3V trước khi đưa vào ESP32.`;
  }

  if (moduleType === "ds18b20") {
    return `Gợi ý đấu DS18B20: DATA dùng GPIO ${suggestedPins[0]}, VCC dùng 3V3, GND dùng GND. Nếu module DS18B20 chưa có điện trở kéo lên thì thêm 4.7kΩ giữa DATA và 3V3.`;
  }

  if (moduleType === "servo_feeder") {
    return `Gợi ý đấu servo: dây tín hiệu servo dùng GPIO ${suggestedPins[0]}, VCC servo nên cấp nguồn 5V riêng, GND servo nối chung GND với ESP32.`;
  }

  if (moduleType === "light") {
    return `Gợi ý đấu đèn: GPIO ${suggestedPins[0]} dùng làm chân điều khiển relay/MOSFET cho đèn.`;
  }

  if (moduleType === "oxygen") {
    return `Gợi ý đấu sủi oxy: GPIO ${suggestedPins[0]} dùng làm chân điều khiển relay/MOSFET cho sủi oxy.`;
  }

  if (moduleType === "pump") {
    return `Gợi ý đấu máy bơm: GPIO ${suggestedPins[0]} dùng làm chân điều khiển relay/MOSFET cho bơm.`;
  }

  return `Gợi ý: dùng GPIO ${suggestedPins[0]} cho ${meta.pinLabels[0].toLowerCase()}.`;
};

const autoPickPins = (moduleType: string, freePins: number[] = []) => {
  const requiredCount = getRequiredPinCount(moduleType);
  const picked = freePins.slice(0, requiredCount);

  return {
    pin: picked[0] ? String(picked[0]) : "",
    pin2: picked[1] ? String(picked[1]) : "",
    pin3: picked[2] ? String(picked[2]) : "",
  };
};

const makeModuleCode = (
  moduleType: string,
  existingModules: ModuleItem[] = []
) => {
  const base = getModuleMeta(moduleType).codeBase;
  const exists = existingModules.some((item) => item.module_code === base);

  if (!exists) return base;

  let index = 2;
  let nextCode = `${base}_${index}`;

  while (existingModules.some((item) => item.module_code === nextCode)) {
    index += 1;
    nextCode = `${base}_${index}`;
  }

  return nextCode;
};

export default function ModulesPage() {
  const API_URL = "";

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedTankId, setSelectedTankId] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [options, setOptions] = useState<ModuleOptions | null>(null);
  const [gpioInfo, setGpioInfo] = useState<DeviceModuleResponse["gpio"] | null>(
    null
  );

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("idle");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [publishingConfig, setPublishingConfig] = useState(false);
  const [configAck, setConfigAck] = useState<ConfigAckPayload | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [editConfigText, setEditConfigText] = useState("");
  const [updatingModuleId, setUpdatingModuleId] = useState<number | null>(null);

  const [connectionType, setConnectionType] = useState<"gpio" | "wireless">(
    "gpio"
  );
  const [ioMode, setIoMode] = useState<"input" | "output">("input");
  const [moduleType, setModuleType] = useState("ds18b20");
  const [moduleName, setModuleName] = useState("Cảm biến nhiệt độ nước");
  const [moduleCode, setModuleCode] = useState("");
  const [unit, setUnit] = useState("°C");

  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pin3, setPin3] = useState("");

  const [protocol, setProtocol] = useState("esp_now");
  const [nodeType, setNodeType] = useState("esp32_s3mini");
  const [nodeCode, setNodeCode] = useState("S3_WATER_01");

  const [configText, setConfigText] = useState(
    JSON.stringify(defaultConfigByType("ds18b20"), null, 2)
  );

  const currentModuleMeta = getModuleMeta(moduleType);
  const requiredPinCount = getRequiredPinCount(moduleType);
  const freePins = gpioInfo?.free_pins || options?.gpio_pins || [];

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

  const formatDateTime = (value?: string | null) => {
    if (!value) return "Chưa có";

    try {
      return new Date(value).toLocaleString("vi-VN", {
        hour12: false,
      });
    } catch {
      return value;
    }
  };

  const tankOptions = useMemo(() => {
    const map = new Map<number, TankOption>();

    for (const device of devices) {
      const tankId = Number(device.tank_id);

      if (!map.has(tankId)) {
        map.set(tankId, {
          id: tankId,
          name: device.tank_name || `Bể ID ${tankId}`,
          code: device.tank_code,
          owner_email: device.owner_email,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.id - b.id);
  }, [devices]);

  const devicesInSelectedTank = useMemo(() => {
    if (!selectedTankId) return [];
    return devices.filter((device) => String(device.tank_id) === selectedTankId);
  }, [devices, selectedTankId]);

  const selectedTank = tankOptions.find(
    (tank) => String(tank.id) === selectedTankId
  );

  const selectedDevice = devices.find(
    (device) => String(device.id) === selectedDeviceId
  );

  const moduleTypeOptions =
    ioMode === "input"
      ? options?.input_module_types || []
      : options?.output_module_types || [];

  const setStatus = (type: MessageType, text: string) => {
    setMessageType(type);
    setMessage(text);
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

  const loadDevices = async () => {
    const token = getToken();

    const res = await fetch(`${API_URL}/api/devices`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await readJsonSafe(res);

    if (!res.ok) {
      throw new Error(data.message || "Không lấy được danh sách thiết bị");
    }

    const list: DeviceInfo[] = data.devices || [];
    setDevices(list);

    if (list.length === 0) {
      setSelectedTankId("");
      setSelectedDeviceId("");
      return;
    }

    setSelectedTankId((prevTankId) => {
      const validTank = list.some(
        (device) => String(device.tank_id) === String(prevTankId)
      );

      const nextTankId = validTank ? prevTankId : String(list[0].tank_id);

      const devicesInTank = list.filter(
        (device) => String(device.tank_id) === nextTankId
      );

      setSelectedDeviceId((prevDeviceId) => {
        const validDevice = devicesInTank.some(
          (device) => String(device.id) === String(prevDeviceId)
        );

        if (validDevice) return prevDeviceId;
        return devicesInTank[0] ? String(devicesInTank[0].id) : "";
      });

      return nextTankId;
    });
  };

  const loadDeviceModules = async (deviceId = selectedDeviceId) => {
    if (!deviceId) {
      setModules([]);
      setGpioInfo(null);
      return;
    }

    const token = getToken();

    const res = await fetch(
      `${API_URL}/api/device-modules/devices/${deviceId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = (await readJsonSafe(res)) as DeviceModuleResponse;

    if (!res.ok) {
      throw new Error(data.message || "Không lấy được module của thiết bị");
    }

    setModules(data.modules || []);
    setGpioInfo(data.gpio || null);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setStatus("loading", "Đang tải cấu hình module...");

      await Promise.all([loadOptions(), loadDevices()]);

      setStatus("idle", "");
    } catch (err) {
      console.error(err);
      setStatus(
        "error",
        err instanceof Error ? err.message : "Không kết nối được backend"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedDeviceId) return;

    const token = getToken();
    if (!token) return;

    let localUser: any = null;

    try {
      const rawUser = localStorage.getItem("user");
      localUser = rawUser ? JSON.parse(rawUser) : null;
    } catch {
      localUser = null;
    }

    const socket = io(getRealtimeUrl(), {
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
    });

    socket.on("connect", () => {
      if (localUser?.id) {
        socket.emit("join_user_room", localUser.id);
        socket.emit("join_user", localUser.id);
      }

      if (localUser?.role === "admin" || localUser?.role === "moderator") {
        socket.emit("join_manager_room", localUser.role);
      }
    });

    socket.on("connect_error", (err: Error) => {
      console.warn("Config ACK socket error:", err.message);
    });

    socket.on("config_ack", (payload: ConfigAckPayload) => {
      const ackDeviceId = payload.deviceId ?? payload.device_id;

      if (String(ackDeviceId) !== String(selectedDeviceId)) {
        return;
      }

      const nextAck = {
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      setConfigAck(nextAck);

      if (payload.status === "applied") {
        setStatus(
          "success",
          `ESP đã nhận cấu hình thành công (${payload.module_count ?? "?"} module).`
        );
      } else {
        setStatus(
          "error",
          `ESP phản hồi cấu hình: ${
            payload.message || payload.status || "unknown"
          }`
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!selectedDeviceId) {
      setModules([]);
      setGpioInfo(null);
      return;
    }

    loadDeviceModules(selectedDeviceId).catch((err) => {
      console.error(err);
      setModules([]);
      setGpioInfo(null);
      setStatus(
        "error",
        err instanceof Error ? err.message : "Lỗi server khi lấy module"
      );
    });
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!options) return;

    const nextOptions =
      ioMode === "input" ? options.input_module_types : options.output_module_types;

    if (!nextOptions.includes(moduleType)) {
      const nextType = nextOptions[0] || "";
      const meta = getModuleMeta(nextType);

      setModuleType(nextType);
      setUnit(defaultUnitByType(nextType));
      setConfigText(JSON.stringify(defaultConfigByType(nextType), null, 2));
      setModuleName(meta.defaultName);
      setModuleCode(makeModuleCode(nextType, modules));

      const picked = autoPickPins(nextType, gpioInfo?.free_pins || []);
      setPin(picked.pin);
      setPin2(picked.pin2);
      setPin3(picked.pin3);
    }
  }, [ioMode, options, modules, gpioInfo?.free_pins, moduleType]);

  useEffect(() => {
    if (!moduleType) return;

    const meta = getModuleMeta(moduleType);
    const picked = autoPickPins(moduleType, gpioInfo?.free_pins || []);

    setUnit(defaultUnitByType(moduleType));
    setConfigText(JSON.stringify(defaultConfigByType(moduleType), null, 2));
    setModuleName(meta.defaultName);
    setModuleCode(makeModuleCode(moduleType, modules));

    if (connectionType === "gpio") {
      setPin(picked.pin);
      setPin2(picked.pin2);
      setPin3(picked.pin3);
    }
  }, [moduleType, modules, gpioInfo?.free_pins, connectionType]);

  const handleTankChange = (tankId: string) => {
    setSelectedTankId(tankId);
    setConfigAck(null);

    const nextDevices = devices.filter(
      (device) => String(device.tank_id) === tankId
    );

    setSelectedDeviceId(nextDevices[0] ? String(nextDevices[0].id) : "");
  };

  const publishConfigToEsp = async () => {
    if (!selectedDeviceId) {
      setStatus("error", "Vui lòng chọn thiết bị ESP trước");
      return;
    }

    try {
      setPublishingConfig(true);
      setConfigAck(null);
      setStatus("loading", "Đang gửi cấu hình xuống ESP...");

      const token = getToken();

      const res = await fetch(
        `${API_URL}/api/device-modules/devices/${selectedDeviceId}/publish-config`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await readJsonSafe(res);

      if (!res.ok) {
        throw new Error(data.message || "Gửi cấu hình xuống ESP thất bại");
      }

      setStatus("success", "Đã gửi cấu hình xuống ESP. Đang chờ ESP xác nhận...");
    } catch (err) {
      console.error(err);
      setStatus(
        "error",
        err instanceof Error ? err.message : "Không kết nối được backend"
      );
    } finally {
      setPublishingConfig(false);
    }
  };

  const createModule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDeviceId) {
      setStatus("error", "Vui lòng chọn thiết bị ESP trước");
      return;
    }

    if (!moduleName.trim()) {
      setStatus("error", "Vui lòng nhập tên module");
      return;
    }

    if (!moduleCode.trim()) {
      setStatus("error", "Vui lòng nhập mã module");
      return;
    }

    if (connectionType === "gpio" && !pin) {
      setStatus("error", `Vui lòng chọn ${currentModuleMeta.pinLabels[0]}`);
      return;
    }

    if (connectionType === "gpio" && requiredPinCount >= 2 && !pin2) {
      setStatus("error", `Vui lòng chọn ${currentModuleMeta.pinLabels[1]}`);
      return;
    }

    if (connectionType === "wireless") {
      if (!nodeCode.trim()) {
        setStatus("error", "Module không dây phải có node_code");
        return;
      }

      if (!nodeType.trim()) {
        setStatus("error", "Module không dây phải có node_type");
        return;
      }
    }

    let parsedConfig: any = {};

    try {
      parsedConfig = configText.trim() ? JSON.parse(configText) : {};
    } catch {
      setStatus("error", "config_json không đúng định dạng JSON");
      return;
    }

    try {
      setCreating(true);
      setConfigAck(null);
      setStatus("loading", "Đang tạo module...");

      const token = getToken();

      const body: any = {
        device_id: Number(selectedDeviceId),
        module_code: moduleCode.trim(),
        name: moduleName.trim(),
        connection_type: connectionType,
        io_mode: ioMode,
        module_type: moduleType,
        unit: unit.trim() || null,
        config_json: parsedConfig,
        enabled: true,
      };

      if (connectionType === "gpio") {
        body.pin = Number(pin);
        body.pin2 = pin2 ? Number(pin2) : null;
        body.pin3 = pin3 ? Number(pin3) : null;
      }

      if (connectionType === "wireless") {
        body.protocol = protocol;
        body.node_type = nodeType.trim();
        body.node_code = nodeCode.trim();
      }

      const res = await fetch(`${API_URL}/api/device-modules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        throw new Error(data.message || "Tạo module thất bại");
      }

      setStatus("success", "Tạo module thành công. Đã gửi cấu hình mới xuống ESP.");
      setPin("");
      setPin2("");
      setPin3("");
      setModuleCode(makeModuleCode(moduleType, modules));

      await loadDeviceModules(selectedDeviceId);
    } catch (err) {
      console.error(err);
      setStatus(
        "error",
        err instanceof Error ? err.message : "Không kết nối được backend"
      );
    } finally {
      setCreating(false);
    }
  };

  const deleteModule = async (moduleId: number) => {
    const ok = window.confirm("Bạn chắc chắn muốn xóa module này?");
    if (!ok) return;

    try {
      setLoading(true);
      setConfigAck(null);
      setStatus("loading", "Đang xóa module...");

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

      setStatus("success", "Xóa module thành công. Đã gửi cấu hình mới xuống ESP.");
      await loadDeviceModules(selectedDeviceId);
    } catch (err) {
      console.error(err);
      setStatus(
        "error",
        err instanceof Error ? err.message : "Không kết nối được backend"
      );
    } finally {
      setLoading(false);
    }
  };

  const startEditModuleConfig = (module: ModuleItem) => {
    setEditingModuleId(module.id);
    setEditConfigText(JSON.stringify(module.config_json || {}, null, 2));
    setConfigAck(null);
  };

  const cancelEditModuleConfig = () => {
    setEditingModuleId(null);
    setEditConfigText("");
  };

  const saveModuleConfig = async (module: ModuleItem) => {
    let parsedConfig: any = {};

    try {
      parsedConfig = editConfigText.trim() ? JSON.parse(editConfigText) : {};
    } catch {
      setStatus("error", "config_json khong dung dinh dang JSON");
      return;
    }

    try {
      setUpdatingModuleId(module.id);
      setConfigAck(null);
      setStatus("loading", "Dang luu config_json va gui config xuong ESP...");

      const token = getToken();

      const res = await fetch(`${API_URL}/api/device-modules/${module.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          config_json: parsedConfig,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        throw new Error(data.message || "Cap nhat module that bai");
      }

      setStatus(
        "success",
        "Da luu config_json. Backend da gui config moi xuong ESP, dang cho ACK..."
      );

      setEditingModuleId(null);
      setEditConfigText("");

      await loadDeviceModules(selectedDeviceId);
    } catch (err) {
      console.error(err);
      setStatus(
        "error",
        err instanceof Error ? err.message : "Khong ket noi duoc backend"
      );
    } finally {
      setUpdatingModuleId(null);
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

  const cardStyle = {
    border: "1px solid #67e8f9",
    padding: 18,
    borderRadius: 18,
    background: "rgba(255,255,255,0.92)",
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #67e8f9",
    background: "#fff",
    marginTop: 6,
  };

  const statusStyle = {
    marginTop: 12,
    color:
      messageType === "success"
        ? "#16a34a"
        : messageType === "error"
        ? "#dc2626"
        : messageType === "loading"
        ? "#d97706"
        : "#475569",
    fontWeight: "bold",
  };

  return (
    <main style={{ padding: 24, maxWidth: 1250 }}>
      <h1>Cấu hình module</h1>

      <p style={{ color: "#475569" }}>
        Chọn bể cá, chọn thiết bị ESP, sau đó cấu hình module có dây GPIO hoặc
        module không dây.
      </p>

      <section style={{ ...cardStyle, marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Chọn phạm vi cấu hình</h2>
            <p style={{ margin: "6px 0 0", color: "#475569" }}>
              Đã tải <b>{devices.length}</b> thiết bị, đang cấu hình{" "}
              <b>{modules.length}</b> module cho thiết bị đang chọn.
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <label>
            <b>Chọn bể cá</b>
            <select
              value={selectedTankId}
              onChange={(e) => handleTankChange(e.target.value)}
              style={inputStyle}
            >
              {tankOptions.length === 0 && (
                <option value="">-- Chưa có bể/thiết bị --</option>
              )}

              {tankOptions.map((tank) => (
                <option key={tank.id} value={tank.id}>
                  ID {tank.id} - {tank.name}
                  {tank.code ? ` - ${tank.code}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <b>Chọn thiết bị ESP</b>
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                setConfigAck(null);
              }}
              style={inputStyle}
            >
              {devicesInSelectedTank.length === 0 && (
                <option value="">-- Bể này chưa có thiết bị --</option>
              )}

              {devicesInSelectedTank.map((device) => (
                <option key={device.id} value={device.id}>
                  ID {device.id} - {device.name} - {device.device_code}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedTank && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              background: "#ecfeff",
              border: "1px solid #67e8f9",
              color: "#475569",
            }}
          >
            <b>Bể đang chọn:</b> {selectedTank.name}
            {selectedTank.code ? ` (${selectedTank.code})` : ""} |{" "}
            <b>Số thiết bị trong bể:</b> {devicesInSelectedTank.length}
            {selectedTank.owner_email && (
              <>
                {" "}
                | <b>Owner:</b> {selectedTank.owner_email}
              </>
            )}
          </div>
        )}

        {selectedDevice && (
          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 14,
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <b>Đồng bộ cấu hình với ESP</b>

              <p style={{ margin: "6px 0", color: "#475569" }}>
                Gửi toàn bộ module của thiết bị đang chọn xuống ESP qua MQTT
                topic config.
              </p>

              {configAck ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 12,
                    background:
                      configAck.status === "applied" ? "#f0fdf4" : "#fff1f2",
                    border:
                      configAck.status === "applied"
                        ? "1px solid #86efac"
                        : "1px solid #fecdd3",
                    color:
                      configAck.status === "applied" ? "#166534" : "#dc2626",
                  }}
                >
                  <b>
                    {configAck.status === "applied"
                      ? "ESP đã nhận cấu hình"
                      : "ESP phản hồi lỗi cấu hình"}
                  </b>

                  <p style={{ margin: "6px 0 0" }}>
                    Trạng thái: <b>{configAck.status || "unknown"}</b> | Module
                    đã áp dụng: <b>{configAck.module_count ?? "N/A"}</b> | Thời
                    gian: <b>{formatDateTime(configAck.timestamp)}</b>
                  </p>

                  {configAck.message && (
                    <p style={{ margin: "6px 0 0" }}>
                      Message: <code>{configAck.message}</code>
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                  Chưa có ACK trong phiên này. Bấm gửi cấu hình để kiểm tra ESP
                  đã nhận chưa.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={publishConfigToEsp}
              disabled={publishingConfig || loading || !selectedDeviceId}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #0891b2",
                background:
                  publishingConfig || loading || !selectedDeviceId
                    ? "#94a3b8"
                    : "#0891b2",
                color: "#fff",
                fontWeight: "bold",
                cursor:
                  publishingConfig || loading || !selectedDeviceId
                    ? "not-allowed"
                    : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {publishingConfig ? "Đang gửi..." : "Gửi lại cấu hình xuống ESP"}
            </button>
          </div>
        )}

        {message && <p style={statusStyle}>{message}</p>}
      </section>

      {options && (
        <section
          style={{
            ...cardStyle,
            marginBottom: 24,
            border: "1px solid #cbd5e1",
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

      {selectedDevice && (
        <section style={{ ...cardStyle, marginBottom: 24 }}>
          <h2>GPIO của thiết bị đang chọn</h2>

          <p>
            <b>Thiết bị:</b> {selectedDevice.name} ({selectedDevice.device_code})
          </p>

          {gpioInfo ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                }}
              >
                <b>GPIO còn trống</b>
                <p style={{ marginBottom: 0 }}>
                  {gpioInfo.free_pins.length > 0
                    ? gpioInfo.free_pins.join(", ")
                    : "Không còn GPIO trống"}
                </p>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                }}
              >
                <b>GPIO đã dùng</b>

                {gpioInfo.used_pins.length === 0 ? (
                  <p style={{ marginBottom: 0 }}>Chưa có GPIO nào được dùng.</p>
                ) : (
                  <ul style={{ marginBottom: 0 }}>
                    {gpioInfo.used_pins.map((item) => (
                      <li key={`${item.module_id}_${item.pin}`}>
                        GPIO {item.pin}: {item.module_name} ({item.module_type})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p>Chưa tải được GPIO info.</p>
          )}
        </section>
      )}

      <section style={{ ...cardStyle, marginBottom: 24 }}>
        <h2>Thêm module mới</h2>

        <form onSubmit={createModule}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <label>
              <b>Kiểu kết nối</b>
              <select
                value={connectionType}
                onChange={(e) =>
                  setConnectionType(e.target.value as "gpio" | "wireless")
                }
                style={inputStyle}
              >
                <option value="gpio">Có dây / GPIO</option>
                <option value="wireless">Không dây / Wireless</option>
              </select>
            </label>

            <label>
              <b>Input / Output</b>
              <select
                value={ioMode}
                onChange={(e) => setIoMode(e.target.value as "input" | "output")}
                style={inputStyle}
              >
                <option value="input">Input / Cảm biến</option>
                <option value="output">Output / Chấp hành</option>
              </select>
            </label>

            <label>
              <b>Loại module</b>
              <select
                value={moduleType}
                onChange={(e) => setModuleType(e.target.value)}
                style={inputStyle}
              >
                {moduleTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type} - {getModuleMeta(type).label}
                  </option>
                ))}
              </select>

              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
                {currentModuleMeta.description}
              </p>
            </label>

            <label>
              <b>Tên module</b>
              <input
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                style={inputStyle}
                placeholder="Ví dụ: Cảm biến nhiệt độ nước"
              />
            </label>

            <label>
              <b>Mã module</b>
              <input
                value={moduleCode}
                onChange={(e) => setModuleCode(e.target.value)}
                style={inputStyle}
                placeholder="Ví dụ: temp_ds18b20_main"
              />
              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
                Web tự gợi ý mã kỹ thuật. Nên dùng chữ thường, không dấu, không
                khoảng trắng.
              </p>
            </label>

            <label>
              <b>Đơn vị</b>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={inputStyle}
                placeholder="Ví dụ: °C, %, pH"
              />
            </label>
          </div>

          {connectionType === "gpio" && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 16,
                background: "#ecfeff",
                border: "1px solid #67e8f9",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Cấu hình GPIO có dây</h3>

              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  color: "#166534",
                  marginBottom: 12,
                }}
              >
                <b>Gợi ý đấu dây:</b>

                <p style={{ margin: "6px 0 10px" }}>
                  {getPinSuggestionText(moduleType, gpioInfo?.free_pins || [])}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    const picked = autoPickPins(
                      moduleType,
                      gpioInfo?.free_pins || []
                    );

                    setPin(picked.pin);
                    setPin2(picked.pin2);
                    setPin3(picked.pin3);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #16a34a",
                    background: "#16a34a",
                    color: "#fff",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Tự chọn GPIO phù hợp
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <label>
                  <b>{currentModuleMeta.pinLabels[0]}</b>
                  <select
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">
                      {currentModuleMeta.pinPlaceholders[0]}
                    </option>

                    {freePins.map((gpio) => (
                      <option key={gpio} value={gpio}>
                        GPIO {gpio}
                      </option>
                    ))}
                  </select>
                </label>

                {requiredPinCount >= 2 && (
                  <label>
                    <b>{currentModuleMeta.pinLabels[1]}</b>
                    <select
                      value={pin2}
                      onChange={(e) => setPin2(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">
                        {currentModuleMeta.pinPlaceholders[1]}
                      </option>

                      {freePins
                        .filter((gpio) => String(gpio) !== pin)
                        .map((gpio) => (
                          <option key={gpio} value={gpio}>
                            GPIO {gpio}
                          </option>
                        ))}
                    </select>
                  </label>
                )}

                {requiredPinCount >= 3 && (
                  <label>
                    <b>{currentModuleMeta.pinLabels[2]}</b>
                    <select
                      value={pin3}
                      onChange={(e) => setPin3(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">
                        {currentModuleMeta.pinPlaceholders[2]}
                      </option>

                      {freePins
                        .filter(
                          (gpio) =>
                            String(gpio) !== pin && String(gpio) !== pin2
                        )
                        .map((gpio) => (
                          <option key={gpio} value={gpio}>
                            GPIO {gpio}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          )}

          {connectionType === "wireless" && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 16,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Cấu hình module không dây</h3>

              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1d4ed8",
                  marginBottom: 12,
                }}
              >
                <b>Gợi ý:</b>
                <p style={{ margin: "6px 0 0" }}>
                  Với ESP32-S3 mini không dây, đặt Node code cố định như{" "}
                  <b>S3_WATER_01</b>. Gateway ESP32 chính sẽ dùng node code này
                  để nhận diện dữ liệu gửi về qua ESP-NOW hoặc MQTT direct.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(160px, 1fr))",
                  gap: 12,
                }}
              >
                <label>
                  <b>Protocol</b>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                    style={inputStyle}
                  >
                    {(options?.wireless_protocols || ["esp_now"]).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <b>Node type</b>
                  <input
                    value={nodeType}
                    onChange={(e) => setNodeType(e.target.value)}
                    style={inputStyle}
                    placeholder="esp32_s3mini"
                  />
                </label>

                <label>
                  <b>Node code</b>
                  <input
                    value={nodeCode}
                    onChange={(e) => setNodeCode(e.target.value)}
                    style={inputStyle}
                    placeholder="S3_WATER_01"
                  />
                </label>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label>
              <b>config_json</b>
              <textarea
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                style={{
                  ...inputStyle,
                  minHeight: 150,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={creating || loading || !selectedDeviceId}
            style={{
              marginTop: 16,
              padding: "12px 18px",
              borderRadius: 12,
              border: "1px solid #0891b2",
              background:
                creating || loading || !selectedDeviceId ? "#94a3b8" : "#0891b2",
              color: "#fff",
              fontWeight: "bold",
              cursor:
                creating || loading || !selectedDeviceId
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {creating ? "Đang tạo..." : "Tạo module"}
          </button>
        </form>
      </section>

      <section style={cardStyle}>
        <h2>Danh sách module của thiết bị đang chọn</h2>

        {!selectedDeviceId && <p>Vui lòng chọn thiết bị ESP.</p>}

        {selectedDeviceId && modules.length === 0 && <p>Chưa có module nào.</p>}

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
                      .filter((gpio) => gpio !== null && gpio !== undefined)
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
                <div style={{ marginTop: 10 }}>
                  <details open={editingModuleId === module.id ? true : undefined}>
                    <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
                      config_json
                    </summary>

                    {editingModuleId === module.id ? (
                      <div style={{ marginTop: 10 }}>
                        <textarea
                          value={editConfigText}
                          onChange={(e) => setEditConfigText(e.target.value)}
                          disabled={updatingModuleId === module.id}
                          style={{
                            width: "100%",
                            minHeight: 190,
                            padding: 12,
                            borderRadius: 12,
                            border: "1px solid #67e8f9",
                            background: "#fff",
                            fontSize: 12,
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          }}
                        />

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => saveModuleConfig(module)}
                            disabled={updatingModuleId === module.id || loading}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #16a34a",
                              background:
                                updatingModuleId === module.id || loading
                                  ? "#94a3b8"
                                  : "#16a34a",
                              color: "#fff",
                              fontWeight: "bold",
                              cursor:
                                updatingModuleId === module.id || loading
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {updatingModuleId === module.id ? "Dang luu..." : "Luu JSON"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEditModuleConfig}
                            disabled={updatingModuleId === module.id}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #cbd5e1",
                              background: "#f8fafc",
                              color: "#334155",
                              fontWeight: "bold",
                              cursor:
                                updatingModuleId === module.id ? "not-allowed" : "pointer",
                            }}
                          >
                            Huy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <pre
                        style={{
                          background: "#f8fafc",
                          borderRadius: 12,
                          padding: 12,
                          overflowX: "auto",
                          fontSize: 12,
                        }}
                      >
                        {JSON.stringify(module.config_json || {}, null, 2)}
                      </pre>
                    )}
                  </details>

                  {editingModuleId !== module.id && (
                    <button
                      type="button"
                      onClick={() => startEditModuleConfig(module)}
                      disabled={loading || updatingModuleId === module.id}
                      style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #0891b2",
                        background: "#ecfeff",
                        color: "#0e7490",
                        fontWeight: "bold",
                        cursor:
                          loading || updatingModuleId === module.id
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      Sua JSON
                    </button>
                  )}
                </div>
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