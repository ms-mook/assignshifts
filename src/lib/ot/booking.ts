// ไกด์ชื่อจากระบบจองเวร สำหรับตาราง OT
// ใช้เฉพาะ Station = "จุดอื่นๆ (บัตรคิว, นำ-ส่ง สิ่งส่งตรวจ)" ที่จองช่วงเช้า (H)
// ไม่นับผู้ที่จองห้องเจาะเลือด SMC (จุด OT อยู่ห้อง OPD / กว. เท่านั้น)
// แสดงที่ช่อง (06.00-08.30) ทั้ง 3 คอลัมน์: B จุดบัตรคิว · D จุดตรวจสอบเอกสาร/เก็บ 3 OPD · J จุดเก็บ รับ-นำส่ง กว.
import "server-only";
import { buildGuide } from "../booking";
import type { BookingGuide } from "../guide-types";

export const OT_STATION = "จุดอื่นๆ (บัตรคิว, นำ-ส่ง สิ่งส่งตรวจ)";
export const OT_GUIDE_COLS = ["B", "D", "J"];

const roomShort = (r: string) => (r.includes("SMC") ? "SMC" : r.includes("กว") || r.includes("กัลยา") ? "กว." : r.includes("OPD") ? "OPD" : r);

export function loadOtBookingGuide(yearBE: number, month: number, known: string[]): Promise<BookingGuide> {
  return buildGuide({
    yearBE, month, known,
    cols: OT_GUIDE_COLS,
    title: "จองเวรไว้ · จุดอื่นๆ (บัตรคิว, นำ-ส่ง) (เช้า 06:00-08:30)",
    filter: (b) => b.station === OT_STATION && !b.room.includes("SMC"),
    slot: 0,
    meta: (b) => (b.room ? `ห้อง ${roomShort(b.room)}` : ""),
  });
}
