// ระบบจองเวร (อ่านอย่างเดียว · แท็บ Booking Data) — ใช้ทำไกด์ชื่อในป๊อปอัปเลือกชื่อ
// คอลัมน์: B วันที่ · C ชื่อ · D นามสกุล · F ห้องปฏิบัติการ · G Station · H เช้า · I สาย · J บ่าย · K นอกเวลาเย็น · L ดึก
import "server-only";
import { batchGet } from "./google";
import { SHEETS } from "./config";
import { serialFromYMD, toSerial, ymdFromSerial } from "./sheets-date";
import type { BookingGuide, GuideItem } from "./guide-types";

export interface Booking {
  date: number;
  first: string;
  last: string;
  room: string;
  station: string;
  /** H..L */
  slots: string[];
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const TITLE = /^(นางสาว|นาง|นาย|น\.ส\.|ดร\.)\s*/;
const norm = (s: string) => s.replace(TITLE, "").replace(/\s+/g, "").toLowerCase();

let memo: { at: number; p: Promise<Booking[]> } | null = null;
/** ล้างผลที่จำไว้ (อ่านใหม่ครั้งถัดไป) */
export function invalidateBookings() {
  memo = null;
}

/** อ่าน Booking Data ทั้งหมด (จำผลไว้ 15 วินาที) */
export function readBookings(): Promise<Booking[]> {
  if (memo && Date.now() - memo.at < 15_000) return memo.p;
  const p = (async () => {
    const [g] = await batchGet(SHEETS.booking, ["'Booking Data'!B2:L20000"]);
    const out: Booking[] = [];
    for (const r of g) {
      const date = toSerial(r[0]);
      const first = str(r[1]).replace(TITLE, "").trim();
      if (date === null || first === "") continue;
      out.push({ date, first, last: str(r[2]), room: str(r[4]), station: str(r[5]), slots: [5, 6, 7, 8, 9].map((i) => str(r[i + 1])) });
    }
    return out;
  })();
  memo = { at: Date.now(), p };
  p.catch(() => (memo = null));
  return p;
}

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
 * จับคู่ชื่อในระบบจองกับรายชื่อในตาราง: ตรงกัน (ไม่สนคำนำหน้า/ช่องว่าง) → ใช้ชื่อในตาราง
 * ไม่ตรง → ใช้ชื่อตามระบบจอง (ไม่เดาแทน เพราะชื่อคล้ายกันอาจเป็นคนละคน เช่น นภาพร / นิภาพร)
 *   ถ้ามีชื่อในตารางที่สะกดใกล้กัน (ต่างไม่เกิน 2 ตัวอักษร) จะบอกไว้เป็นคำแนะนำ (similar)
 */
export function matchName(booked: string, known: string[]): { name: string; matched: "exact" | "none"; similar?: string } {
  const b = norm(booked);
  const exact = known.find((k) => norm(k) === b);
  if (exact) return { name: exact, matched: "exact" };
  const name = booked.replace(TITLE, "").trim();
  if (Array.from(b).length >= 3) {
    const near = known.map((k) => ({ k, d: dist(norm(k), b) })).filter((x) => x.d <= 2).sort((x, y) => x.d - y.d);
    if (near.length > 0) return { name, matched: "none", similar: near[0].k };
  }
  return { name, matched: "none" };
}

export const BOOKING_ERROR = (e: unknown) => {
  const msg = (e as Error).message;
  return /\b(403|404)\b|PERMISSION|not found/i.test(msg)
    ? "อ่านชีตระบบจองเวรไม่ได้ — ต้องแชร์ชีตระบบจองเวรให้บัญชีของเว็บ (assignshifts@assignshifts.iam.gserviceaccount.com) สิทธิ์ผู้อ่าน"
    : `ดึงข้อมูลระบบจองเวรไม่สำเร็จ: ${msg.slice(0, 160)}`;
};

/**
 * สร้างไกด์รายวันของเดือน
 *  - filter: เลือกแถวการจองที่ใช้
 *  - slot: index ช่วงเวลา (0 = H เช้า, 1 = I สาย, …) ที่ต้องจองไว้
 */
export async function buildGuide(o: {
  yearBE: number;
  month: number;
  cols: string[];
  title: string;
  known: string[];
  filter: (b: Booking) => boolean;
  slot: number;
  /** ข้อความเพิ่มในแต่ละชื่อ (เช่น จุดที่จอง) */
  meta?: (b: Booking) => string;
  /** ส่วนของตารางที่จองไว้ (ใช้กับ "ใส่ชื่อเดียวกันในตารางอื่นด้วย") */
  secs?: (b: Booking) => string[];
}): Promise<BookingGuide> {
  const guide: BookingGuide = { cols: o.cols, title: o.title, byDay: {} };
  try {
    const all = await readBookings();
    const y = o.yearBE - 543;
    const start = serialFromYMD(y, o.month, 1), end = serialFromYMD(y, o.month + 1, 0);
    const known = Array.from(new Set(o.known.map((k) => k.trim()).filter((k) => k !== "")));
    for (const b of all) {
      if (b.date < start || b.date > end || !o.filter(b)) continue;
      const slot = b.slots[o.slot] ?? "";
      if (slot === "") continue;
      const day = ymdFromSerial(b.date).d;
      const m = matchName(b.first, known);
      const list = (guide.byDay[day] ??= []);
      const dup = list.find((x) => x.name === m.name);
      if (dup) {
        // จองหลายแถววันเดียวกัน → รวมช่วงที่จองไว้
        if (o.secs && dup.secs) dup.secs = Array.from(new Set([...dup.secs, ...o.secs(b)])).sort();
        continue;
      }
      const extra = o.meta?.(b);
      const item: GuideItem = { name: m.name, booked: `${b.first}${b.last ? " " + b.last : ""}`, slot: extra ? `${slot} · ${extra}` : slot };
      // ชื่อที่สะกดคล้ายกันถือเป็นคนละคน (ผู้ใช้ยืนยัน: นภาพร ≠ นิภาพร · ปรียาพร ≠ ประภาพร) — ไม่เตือน ไม่จับคู่
      if (m.matched === "none") item.note = "ไม่มีในรายชื่อตาราง";
      if (o.secs) item.secs = o.secs(b);
      list.push(item);
    }
  } catch (e) {
    guide.error = BOOKING_ERROR(e);
  }
  return guide;
}
