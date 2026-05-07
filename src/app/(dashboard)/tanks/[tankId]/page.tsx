'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
// Đã thêm 'Power' vào phần import để sửa lỗi "Cannot find name 'Power'"
import { Thermometer, Droplet, Zap, Power, Loader2, Waves, Activity } from 'lucide-react';
import { connectSocket, disconnectSocket } from '@/lib/socket';

// --- ĐỊNH NGHĨA KIỂU DỮ LIỆU (KHÔNG DÙNG ANY) ---
interface SensorData {
  temperature: number;
  ph: number;
  water_level: number;
  battery: number;
  rssi: number;
}

interface SocketPayload {
  tankId: number | string;
  data: SensorData;
}

interface Actuator {
  id: number;
  name: string;
  pin: number;
  status: 'on' | 'off' | 'auto' | 'feeding';
}

export default function TankDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tankId = params.tankId as string;

  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [actuators, setActuators] = useState<Actuator[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const API_BASE_URL = 'http://localhost:5000/api';

  // 1. Lấy danh sách thiết bị khi load trang
  useEffect(() => {
    const fetchActuators = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.replace('/login');
          return;
        }
        const res = await fetch(`${API_BASE_URL}/actuators/${tankId}/actuators`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch actuators');
        const data = await res.json();
        setActuators(data.actuators || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (tankId) fetchActuators();
  }, [tankId, router]);

  // 2. Kết nối Socket Realtime
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId') || '1'; 

    if (!token || !tankId) return;

    const socket = connectSocket(token);
    socket.emit('join_user', userId);

    const handleSensorUpdate = (payload: SocketPayload) => {
      console.log("📡 Data received via Socket:", payload);
      // Kiểm tra kỹ cấu trúc payload.data trước khi set state
      if (Number(payload.tankId) === Number(tankId) && payload.data) {
        setSensorData(payload.data);
      }
    };

    socket.on('sensor_update', handleSensorUpdate);

    return () => {
      socket.off('sensor_update', handleSensorUpdate);
      disconnectSocket();
    };
  }, [tankId]);

  // 3. Hàm điều khiển thiết bị
  const toggleActuator = async (actId: number, currentStatus: Actuator['status']) => {
    setActionLoading(actId);
    const newCommand = currentStatus === 'on' ? 'off' : 'on';
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/actuators/${tankId}/actuators/${actId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ command: newCommand }),
      });
      setActuators(prev => prev.map(act => act.id === actId ? { ...act, status: newCommand as Actuator['status'] } : act));
    } catch (err) {
      alert('Lỗi điều khiển thiết bị');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" size={40} /></div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Bể cá #{tankId}</h1>
          <p className="text-gray-500">Giám sát và điều khiển trực tiếp</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 text-green-600 px-4 py-2 rounded-full border border-green-100">
          <Activity size={16} className="animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest">Trực tuyến</span>
        </div>
      </div>

      {/* Grid thông số - Đã sửa logic hiển thị an toàn */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          icon={<Thermometer className="text-orange-500" />} 
          label="Nhiệt độ" 
          value={sensorData ? `${sensorData.temperature.toFixed(1)}°C` : '--'} 
        />
        <StatCard 
          icon={<Droplet className="text-blue-500" />} 
          label="Độ pH" 
          value={sensorData ? sensorData.ph.toFixed(1) : '--'} 
        />
        <StatCard 
          icon={<Waves className="text-cyan-500" />} 
          label="Mức nước" 
          value={sensorData ? `${sensorData.water_level}%` : '--'} 
        />
        <StatCard 
          icon={<Zap className="text-yellow-500" />} 
          label="Pin" 
          value={sensorData ? `${sensorData.battery}%` : '--'} 
        />
      </div>

      {/* Danh sách thiết bị */}
      <div className="bg-white rounded-3xl p-8 border shadow-sm">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Power size={20} className="text-blue-600" /> Thiết bị chấp hành
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actuators.map((act) => (
            <div key={act.id} className="p-5 bg-gray-50 border rounded-2xl flex justify-between items-center transition-all hover:bg-white hover:shadow-md">
              <div>
                <p className="font-bold text-gray-800">{act.name}</p>
                <p className="text-[10px] text-gray-400 font-mono">PORT: {act.pin} | STATUS: {act.status.toUpperCase()}</p>
              </div>
              <button
                onClick={() => toggleActuator(act.id, act.status)}
                disabled={actionLoading === act.id}
                className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${
                  act.status === 'on' 
                    ? 'bg-red-500 text-white shadow-lg shadow-red-100' 
                    : 'bg-slate-800 text-white'
                }`}
              >
                {actionLoading === act.id ? <Loader2 className="animate-spin" size={14} /> : act.status === 'on' ? 'TẮT' : 'BẬT'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Sub-component cho Stat Card
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col gap-4">
      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-gray-900">{value}</p>
      </div>
    </div>
  );
}