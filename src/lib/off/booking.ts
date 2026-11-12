// ไกด์ชื่อจากระบบจองเวร สำหรับตาราง "นอกเวลา" ช่อง Key 4
// ใช้ Station = "จุดลงทะเบียนรายการตรวจ" ทุกช่วงเวลาที่จอง — แสดงวันที่ · ชื่อ · ช่วงเวลาให้ผู้จัดเลือกเอง (ไม่ใส่ให้อัตโนมัติ)
import "server-only";
import { buildGuide } from "../booking";
import { KEY_STATION } from "../key/booking";
import { OT_STATION } from "../ot/booking";
import { SHIFT3_STATION } from "../shift3/booking";
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

/** ช่อง เก็บ 1 · เก็บ 2 · บัตรคิว · เก็บ SMC ในตาราง (คอลัมน์ Q, R, S, W ของหน้าเว็บ) */
export const OFF_COLLECT_GUIDE_COLS = ["Q", "R", "S", "W"];

export function loadOffCollectGuide(yearBE: number, month: number, known: string[]): Promise<BookingGuide> {
  return buildGuide({
    yearBE, month, known,
    cols: OFF_COLLECT_GUIDE_COLS,
    title: `จองเวรไว้ · ${OT_STATION} (ทุกช่วงเวลา)`,
    filter: (b) => b.station === OT_STATION,
    slot: -1,
  });
}

/** ช่อง 9 · ช่อง 10 ในตาราง (คอลัมน์ K, L ของหน้าเว็บ) */
export const OFF_DRAW_GUIDE_COLS = ["K", "L"];

export function loadOffDrawGuide(yearBE: number, month: number, known: string[]): Promise<BookingGuide> {
  return buildGuide({
    yearBE, month, known,
    cols: OFF_DRAW_GUIDE_COLS,
    title: `จองเวรไว้ · ${SHIFT3_STATION} (ทุกช่วงเวลา)`,
    filter: (b) => b.station === SHIFT3_STATION,
    slot: -1,
  });
}
