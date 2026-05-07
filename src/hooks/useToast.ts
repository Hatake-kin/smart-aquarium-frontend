import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3300);
  }, []);

  return { toast, showToast };
}