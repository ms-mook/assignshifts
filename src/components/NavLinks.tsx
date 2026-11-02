"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TABLES } from "@/lib/tables";

const YM_COOKIE = "shift-ym";

function readYmCookie(): string {
  try {
    const m = new RegExp(`(?:^|; )${YM_COOKIE}=(\\d{4}-\\d{2})`).exec(document.cookie);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

export function rememberYm(ym: string) {
  try {
    document.cookie = `${YM_COOKIE}=${ym}; path=/; max-age=31536000; samesite=lax`;
  } catch {}
}

export default function NavLinks() {
  const path = usePathname() ?? "";
  const onSchedule = /^\/schedule\/[^/]+\/(\d{4}-\d{2})/.exec(path);
  const [ym, setYm] = useState("");
  // ใช้เดือนที่กำลังทำอยู่ (เดือนที่เปิดล่าสุด) เวลาสลับไปมาระหว่างตาราง/หน้าอื่น
  useEffect(() => {
    if (onSchedule) {
      rememberYm(onSchedule[1]);
      setYm(onSchedule[1]);
    } else setYm(readYmCookie());
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  const cls = (on: boolean) => (on ? "navlink on" : "navlink");
  return (
    <>
      {TABLES.map((t) => (
        <Link key={t.id} href={ym ? `/schedule/${t.id}/${ym}` : `/?t=${t.id}`} className={cls(path.startsWith(`/schedule/${t.id}/`))}>
          {t.label}
        </Link>
      ))}
      <span className="navsep" />
      <Link href="/plan" className={cls(path.startsWith("/plan"))}>แผนรายสัปดาห์</Link>
      <Link href="/leaves" className={cls(path.startsWith("/leaves"))}>ลา-แลกเวร</Link>
      <Link href="/settings" className={cls(path.startsWith("/settings"))}>ตั้งค่า</Link>
    </>
  );
}
