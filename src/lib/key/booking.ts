// ไกด์ชื่อจากระบบจองเวร สำหรับตาราง Key
// ใช้เฉพาะ Station = "จุดลงทะเบียนรายการตรวจ" ที่จองช่วงเช้า (H) — ไม่ใช้คอลัมน์ F (ห้อง) เพราะผู้จัดเลือกจุดเอง
import "server-only";
import { buildGuide } from "../booking";
import type { BookingGuide } from "../guide-types";

export { matchName } from "../booking";
export const KEY_STATION = "จุดลงทะเบียนรายการตรวจ";
/** ช่องตำแหน่ง Key ในตาราง: OPD Key1–Key5 (B–F) และ กว. Key1–Key4 (J–M) */
export const KEY_GUIDE_COLS = ["B", "C", "D", "E", "F", "J", "K", "L", "M"];

export function loadKeyBookingGuide(yearBE: number, month: number, known: string[]): Promise<BookingGuide> {
  return buildGuide({
    yearBE, month, known,
    cols: KEY_GUIDE_COLS,
    title: `จองเวรไว้ · ${KEY_STATION} (เช้า)`,
    filter: (b) => b.station === KEY_STATION,
    slot: 0,
  });
}
