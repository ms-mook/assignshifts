// ไกด์ชื่อจากระบบจองเวร สำหรับตาราง 3 ช่วงเวลา (6.00-8.30 / 8.30-12.30 / 12.30-16.30)
// ใช้เฉพาะ Station = "จุดเจาะเลือด" · ช่วงเวลา H = 06:00-08:30 → ส่วนที่ 1 · I = 08:30-12:30 → ส่วนที่ 2 · J = 12:30-16:30 → ส่วนที่ 3
// แสดงเฉพาะช่องที่ยังว่าง · ใต้ชื่อบอกห้องที่จอง และช่วงเวลาอื่นที่คนนั้นจองไว้ด้วย (ใช้คู่กับ "ใส่ชื่อเดียวกันในตารางอื่นด้วย")
import "server-only";
import { buildGuide, type Booking } from "../booking";
import type { BookingGuide } from "../guide-types";
import type { SectionNo } from "./types";

export const SHIFT3_STATION = "จุดเจาะเลือด";
const SLOT_NAME = ["เช้า 06:00-08:30", "สาย 08:30-12:30", "บ่าย 12:30-16:30"];
const roomShort = (r: string) => (r.includes("SMC") ? "SMC" : r.includes("กว") || r.includes("กัลยา") ? "กว." : r.includes("OPD") ? "OPD" : r);

export function loadShift3BookingGuide(yearBE: number, month: number, section: SectionNo, known: string[]): Promise<BookingGuide> {
  const idx = section - 1;
  return buildGuide({
    yearBE, month, known,
    cols: ["*"],
    title: `จองเวรไว้ · ${SHIFT3_STATION} (${SLOT_NAME[idx]})`,
    filter: (b) => b.station === SHIFT3_STATION,
    slot: idx,
    meta: (b: Booking) => {
      const others = [0, 1, 2].filter((i) => i !== idx && b.slots[i]).map((i) => b.slots[i]);
      return [b.room ? `ห้อง ${roomShort(b.room)}` : "", others.length ? `จองด้วย ${others.join(", ")}` : ""].filter(Boolean).join(" · ");
    },
    secs: (b: Booking) => [0, 1, 2].filter((i) => b.slots[i]).map((i) => String(i + 1)),
  }).then((g) => ({ ...g, sec: String(section), onlyEmpty: true }));
}
