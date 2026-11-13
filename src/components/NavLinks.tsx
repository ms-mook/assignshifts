"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TABLES } from "@/lib/tables";
import Icon, { type IconName } from "./Icon";

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

const TABLE_ICON: Record<string, IconName> = { s1: "Sunrise", s2: "Sun", s3: "Sunset", key: "KeyRound", smc: "Stethoscope", ot: "Timer", off: "CalendarDays" };

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
  const isOt = path.startsWith("/schedule/ot/") || path.startsWith("/ot/");
  const isKey = path.startsWith("/schedule/key/") || path.startsWith("/key/");
  const isSmc = path.startsWith("/schedule/smc/") || path.startsWith("/smc/");
  const isOff = path.startsWith("/schedule/off/") || path.startsWith("/off/");
  const ctx = isOff ? "off" : isSmc ? "smc" : isKey ? "key" : isOt ? "ot" : "s";
  const sub: { href: string; label: string; icon: IconName }[] =
    ctx === "off"
      ? [{ href: "/off/summary", label: "สรุปสะสม", icon: "ChartColumn" }, { href: "/off/settings", label: "ตั้งค่า", icon: "Settings" }]
      : ctx === "smc"
      ? [
          { href: "/smc/plan", label: "สรุปรายปี", icon: "ChartColumn" },
          { href: "/smc/leaves", label: "ลา-แลกเวร", icon: "Repeat" },
          { href: "/smc/settings", label: "ตั้งค่า", icon: "Settings" },
        ]
      : ctx === "key"
        ? [
            { href: "/key/plan", label: "สรุปรายปี", icon: "ChartColumn" },
            { href: "/key/leaves", label: "ลา-แลกเวร", icon: "Repeat" },
            { href: "/key/settings", label: "ตั้งค่า", icon: "Settings" },
          ]
        : ctx === "ot"
          ? [
              { href: "/ot/plan", label: "แผน/สรุป", icon: "CalendarRange" },
              { href: "/ot/leaves", label: "ลา-แลกเวร", icon: "Repeat" },
              { href: "/ot/settings", label: "ตั้งค่า", icon: "Settings" },
            ]
          : [
              { href: "/plan", label: "แผนรายสัปดาห์", icon: "CalendarRange" },
              { href: "/summary", label: "สรุปการเวียนจุด", icon: "ChartColumn" },
              { href: "/leaves", label: "ลา-แลกเวร", icon: "Repeat" },
              { href: "/settings", label: "ตั้งค่า", icon: "Settings" },
            ];
  const ctxLabel = ctx === "off" ? "นอกเวลา" : ctx === "smc" ? "SMC" : ctx === "key" ? "Key" : ctx === "ot" ? "OT" : "6.00-16.30";
  const ctxTone = ctx === "s" ? "s3" : ctx;
  return (
    <>
      <div className="nav-main" role="navigation" aria-label="ตาราง">
        {TABLES.map((t) => {
          const on = path.startsWith(`/schedule/${t.id}/`);
          return (
            <Link key={t.id} href={ym ? `/schedule/${t.id}/${ym}` : `/?t=${t.id}`} className={`nav-pill tone-${t.id}${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
              <span className="ico">
                <Icon name={TABLE_ICON[t.id] ?? "CalendarDays"} size={14} strokeWidth={2.4} />
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
      <div className="nav-sub" role="navigation" aria-label="เมนูของตาราง">
        <span className={`sub-ctx tone-${ctxTone}`}>
          <Icon name={ctx === "s" ? "LayoutGrid" : TABLE_ICON[ctx]} size={20} />
          {ctxLabel}
        </span>
        {sub.map((x) => {
          const on = path.startsWith(x.href);
          return (
            <Link key={x.href} href={x.href} className={on ? "sub-link on" : "sub-link"} aria-current={on ? "page" : undefined}>
              <Icon name={x.icon} size={16} />
              {x.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
