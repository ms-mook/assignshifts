"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABLES } from "@/lib/tables";

export default function NavLinks() {
  const path = usePathname() ?? "";
  const cls = (on: boolean) => (on ? "navlink on" : "navlink");
  return (
    <>
      {TABLES.map((t) => (
        <Link key={t.id} href={`/?t=${t.id}`} className={cls(path.startsWith(`/schedule/${t.id}/`))}>
          {t.label}
        </Link>
      ))}
      <span className="navsep" />
      <Link href="/leaves" className={cls(path.startsWith("/leaves"))}>ลา-แลกเวร</Link>
      <Link href="/settings" className={cls(path.startsWith("/settings"))}>ตั้งค่า</Link>
    </>
  );
}
