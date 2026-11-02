import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import LogoutButton from "@/components/LogoutButton";
import NavLinks from "@/components/NavLinks";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "ตารางเวร · หน่วยเจาะเลือด",
  description: "ระบบจัดตารางเวร หน่วยเจาะเลือด เก็บสิ่งส่งตรวจและ POCT",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17142e" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&family=Mitr:wght@400;500;600&family=Pixelify+Sans:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ToastProvider>
        <nav className="topnav no-print">
          <span className="brand">ตารางเวร</span>
          <NavLinks />
          <span className="spacer" />
          <LogoutButton />
        </nav>
        <main>{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
