// เดือนที่กำลังจัดทำ: ?ym= → เดือนที่เปิดล่าสุดในตารางเวร (cookie shift-ym) → เดือนปัจจุบัน (เวลาไทย)
import "server-only";
import { cookies } from "next/headers";
import { parseYm, ymString } from "./config";

export function currentYm(param?: string): string {
  const pick = [param, cookies().get("shift-ym")?.value].find((v) => v && parseYm(v));
  const p = pick ? parseYm(pick) : null;
  if (p) return ymString(p.yearBE, p.month);
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return ymString(now.getUTCFullYear() + 543, now.getUTCMonth() + 1);
}
