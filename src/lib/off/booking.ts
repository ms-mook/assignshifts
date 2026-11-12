// ไกด์ชื่อจากระบบจองเวร สำหรับตาราง "นอกเวลา" ช่อง Key 4
// ใช้ Station = "จุดลงทะเบียนรายการตรวจ" ทุกช่วงเวลาที่จอง — แสดงวันที่ · ชื่อ · ช่วงเวลาให้ผู้จัดเลือกเอง (ไม่ใส่ให้อัตโนมัติ)
import "server-only";
import { buildGuide } from "../booking";
import { KEY_STATION } from "../key/booking";
import type { BookingGuide } from "../guide-types";

/** ช่อง Key 4 ในตาราง (คอลัมน์ F ของหน้าเว็บ) */
export const OFF_GUIDE_COLS = ["F"];

export function loadOffBookingGuide(yearBE: number, month: number, known: string[]): Promise<BookingGuide> {
  return buildGuide({
    yearBE, month, known,
    cols: OFF_GUIDE_COLS,
    title: `จองเวรไว้ · ${KEY_STATION} (ทุกช่วงเวลา)`,
    filter: (b) => b.station === KEY_STATION,
    slot: -1,
  });
}
