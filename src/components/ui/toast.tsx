'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3200);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  };
  

  return (
    <div className={`fixed bottom-6 right-6 ${colors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-4 duration-300`}>
      {type === 'success' && <CheckCircle size={22} />}
      {type === 'error' && <XCircle size={22} />}
      {type === 'info' && <AlertCircle size={22} />}
      <span className="font-medium pr-2">{message}</span>
    </div>
  );
}