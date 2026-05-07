'use client';

import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      {/* Bạn có thể thêm Header chung cho auth ở đây nếu muốn */}
      <main>
        {children}
      </main>
    </div>
  );
}