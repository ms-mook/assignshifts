// ไกด์ชื่อจากระบบจองเวร (อ่านอย่างเดียว) สำหรับตาราง Key
// อ่านเฉพาะ Booking Data: B วันที่ · C ชื่อ · D นามสกุล · G Station · H ช่วงเวลาเช้า
// ใช้เฉพาะ Station = "จุดลงทะเบียนรายการตรวจ" ที่จองช่วงเช้า (H) — ไม่อ่านคอลัมน์ F (ห้อง) เพราะผู้จัดเลือกจุดเอง
import "server-only";
import { batchGet } from "../google";
import { SHEETS } from "../config";
import { serialFromYMD, toSerial, ymdFromSerial } from "../sheets-date";
import type { BookingGuide, GuideItem } from "../guide-types";

export const KEY_STATION = "จุดลงทะเบียนรายการตรวจ";
/** ช่องตำแหน่ง Key ในตาราง: OPD Key1–Key5 (B–F) และ กว. Key1–Key4 (J–M) */
export const KEY_GUIDE_COLS = ["B", "C", "D", "E", "F", "J", "K", "L", "M"];

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** ระยะแก้ไข (Levenshtein) */
function dist(a: string, b: string): number {
  const A = Array.from(a), B = Array.from(b);
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[B.length];
}

/**
 * จับคู่ชื่อในระบบจองกับรายชื่อในตาราง: ตรงกัน → ใช้ชื่อในตาราง
 * สะกดต่างเล็กน้อย (ต่างไม่เกิน 2 ตัวอักษร และมีชื่อที่ใกล้ที่สุดชื่อเดียว เช่น กฤณา → กฤษณา) → ใช้ชื่อในตาราง พร้อมบอกว่าจับคู่ให้
 * ไม่พบ → ใช้ชื่อตามระบบจอง
 */
export function matchName(booked: string, known: string[]): { name: string; matched: "exact" | "near" | "none" } {
  const b = norm(booked);
  const exact = known.find((k) => norm(k) === b);
  if (exact) return { name: exact, matched: "exact" };
  if (Array.from(b).length >= 3) {
    const scored = known.map((k) => ({ k, d: dist(norm(k), b) })).filter((x) => x.d <= 2).sort((x, y) => x.d - y.d);
    if (scored.length > 0 && (scored.length === 1 || scored[1].d > scored[0].d)) return { name: scored[0].k, matched: "near" };
  }
  return { name: booked, matched: "none" };
}

/** ไกด์รายวันของเดือน (yearBE/month) จากระบบจองเวร */
export async function loadKeyBookingGuide(yearBE: number, month: number, known: string[]): Promise<BookingGuide> {
  const base: BookingGuide = { cols: KEY_GUIDE_COLS, title: `จองเวรไว้ · ${KEY_STATION} (เช้า)`, byDay: {} };
  try {
    const [g] = await batchGet(SHEETS.booking, ["'Booking Data'!B2:H20000"]);
    const y = yearBE - 543;
    const start = serialFromYMD(y, month, 1), end = serialFromYMD(y, month + 1, 0);
    const knownList = Array.from(new Set(known.map((k) => k.trim()).filter((k) => k !== "")));
    for (const r of g) {
      if (str(r[5]) !== KEY_STATION) continue; // G
      const slot = str(r[6]); // H (ช่วงเช้า)
      if (slot === "") continue;
      const d = toSerial(r[0]);
      if (d === null || d < start || d > end) continue;
      const first = str(r[1]), last = str(r[2]);
      if (first === "") continue;
      const day = ymdFromSerial(d).d;
      const m = matchName(first, knownList);
      const list = (base.byDay[day] ??= []);
      if (list.some((x) => x.name === m.name)) continue;
      const item: GuideItem = { name: m.name, booked: `${first}${last ? " " + last : ""}`, slot };
      if (m.matched === "near") item.note = `ระบบจองสะกด "${first}"`;
      if (m.matched === "none") item.note = "ไม่มีในรายชื่อตาราง";
      list.push(item);
    }
  } catch (e) {
    const msg = (e as Error).message;
    base.error = /\b(403|404)\b|PERMISSION|not found/i.test(msg)
      ? "อ่านชีตระบบจองเวรไม่ได้ — ต้องแชร์ชีตระบบจองเวรให้บัญชีของเว็บ (assignshifts@assignshifts.iam.gserviceaccount.com) สิทธิ์ผู้อ่าน"
      : `ดึงข้อมูลระบบจองเวรไม่สำเร็จ: ${msg.slice(0, 160)}`;
  }
  return base;
}
