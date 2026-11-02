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
  // อยู่ในส่วนตาราง OT (OT) → เมนูรองเป็นของ OT
  const isOt = path.startsWith("/schedule/ot/") || path.startsWith("/ot/");
  const isKey = path.startsWith("/schedule/key/") || path.startsWith("/key/");
  const isSmc = path.startsWith("/schedule/smc/") || path.startsWith("/smc/");
  return (
    <>
      {TABLES.map((t) => (
        <Link key={t.id} href={ym ? `/schedule/${t.id}/${ym}` : `/?t=${t.id}`} className={cls(path.startsWith(`/schedule/${t.id}/`))}>
          {t.label}
        </Link>
      ))}
      <span className="navsep" />
      {isSmc ? (
        <>
          <Link href="/smc/plan" className={cls(path.startsWith("/smc/plan"))}>สรุปรายปี (SMC)</Link>
          <Link href="/smc/leaves" className={cls(path.startsWith("/smc/leaves"))}>ตารางลา (SMC)</Link>
          <Link href="/smc/settings" className={cls(path.startsWith("/smc/settings"))}>ตั้งค่า (SMC)</Link>
        </>
      ) : isKey ? (
        <>
          <Link href="/key/plan" className={cls(path.startsWith("/key/plan"))}>สรุปรายปี (Key)</Link>
          <Link href="/key/leaves" className={cls(path.startsWith("/key/leaves"))}>ลา-แลกเวร (Key)</Link>
          <Link href="/key/settings" className={cls(path.startsWith("/key/settings"))}>ตั้งค่า (Key)</Link>
        </>
      ) : isOt ? (
        <>
          <Link href="/ot/plan" className={cls(path.startsWith("/ot/plan"))}>แผน/สรุป (OT)</Link>
          <Link href="/ot/leaves" className={cls(path.startsWith("/ot/leaves"))}>ลา-แลกเวร (OT)</Link>
          <Link href="/ot/settings" className={cls(path.startsWith("/ot/settings"))}>ตั้งค่า (OT)</Link>
        </>
      ) : (
        <>
          <Link href="/plan" className={cls(path.startsWith("/plan"))}>แผนรายสัปดาห์</Link>
          <Link href="/leaves" className={cls(path.startsWith("/leaves"))}>ลา-แลกเวร</Link>
          <Link href="/settings" className={cls(path.startsWith("/settings"))}>ตั้งค่า</Link>
        </>
      )}
    </>
  );
}
