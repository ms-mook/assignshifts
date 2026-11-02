import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = { title: "จัดตารางเวร", description: "ระบบจัดตารางเวร หน่วยเจาะเลือด เก็บสิ่งส่งตรวจและ POCT" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <nav className="topnav no-print">
          <span className="brand">ตารางเวร</span>
          <Link href="/">ตาราง 6.00-8.30 / 8.30-12.30 / 12.30-16.30</Link>
          <Link href="/leaves">ลา-แลกเวร</Link>
          <Link href="/settings">ตั้งค่า</Link>
          <span className="spacer" />
          <LogoutButton />
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
