// ไกด์ชื่อจากระบบจองเวร สำหรับตาราง SMC
// ใช้เฉพาะ ห้องปฏิบัติการ (F) = "ห้องเจาะเลือด SMC" ทุก Station
//  - ช่อง3 / ช่อง4 / ช่อง5 (07.00–08.30 · คอลัมน์ G H I) ← จองช่วงเช้า (H)
//  - ช่อง3,4 / ช่อง5 (08.30–12.30 · คอลัมน์ O P) ← จองช่วงสาย (I)
import "server-only";
import { buildGuide } from "../booking";
import type { BookingGuide } from "../guide-types";

export const SMC_ROOM = "ห้องเจาะเลือด SMC";

export async function loadSmcBookingGuides(yearBE: number, month: number, known: string[]): Promise<BookingGuide[]> {
  const base = { yearBE, month, known, filter: (b: { room: string }) => b.room === SMC_ROOM, meta: (b: { station: string }) => b.station };
  return Promise.all([
    buildGuide({ ...base, cols: ["G", "H", "I"], title: `จองเวรไว้ · ${SMC_ROOM} (เช้า 06:00-08:30)`, slot: 0 }),
    buildGuide({ ...base, cols: ["O", "P"], title: `จองเวรไว้ · ${SMC_ROOM} (สาย 08:30-12:30)`, slot: 1 }),
  ]);
}
