import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./ui.css";
import "./globals.css";
import Icon from "@/components/Icon";
import LogoutButton from "@/components/LogoutButton";
import NavLinks from "@/components/NavLinks";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "ตารางเวร · หน่วยเจาะเลือด",
  description: "ระบบจัดตารางเวร หน่วยเจาะเลือด เก็บสิ่งส่งตรวจและ POCT",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1f3a68" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" data-theme="shiftglass">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ToastProvider>
        <nav className="topnav no-print">
          <span className="brand">
            <span className="brand-mark">
              <Icon name="CalendarDays" size={20} />
            </span>
            <span className="brand-text grad-text">ตารางเวร</span>
          </span>
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
