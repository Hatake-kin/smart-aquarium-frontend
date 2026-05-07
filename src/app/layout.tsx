// src/app/layout.tsx

import './globals.css';

export const metadata = {
  title: 'Smart Aquarium',
  description: 'Hệ thống quản lý bể cá thông minh',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}