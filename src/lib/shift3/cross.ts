// ใส่ชื่อเดียวกันลงตาราง 3 ช่วงเวลา (6.00-8.30 / 8.30-12.30 / 12.30-16.30) ในจุดเดียวกัน วันเดียวกัน
// ใช้ได้เฉพาะคอลัมน์จุด MT/RN ที่หัวตารางเหมือนกันทุกช่วงเวลา (ผู้ใช้กำหนด)
import { GROUPS, HEADER_ROWS } from "./layout";
import { colIndex } from "./engine";
import type { MonthResult, SectionNo } from "./types";

/** OPD ผู้สูงอายุ 8, 9 · ทั่วไป 10 · กว. ทั่วไป 5, สวัสดิการ/ผู้สูงอายุ 6, 9 · SMC เจาะ2, เจาะ3/4/5 · เวชกรรมสังคม KEY1, เจาะ1 · SHE เก็บ1, เจาะ1 */
export const CROSS_COLS = ["I", "J", "K", "V", "W", "Z", "AF", "AG", "AH", "AI", "AJ", "AK"];
const GROUP_NAMES = ["OPD", "กว.", "SMC", "เวชกรรมสังคม", "SHE"];
const SECTION_LABEL: Record<SectionNo, { table: string; label: string }> = {
  1: { table: "s1", label: "6.00-8.30" },
  2: { table: "s2", label: "8.30-12.30" },
  3: { table: "s3", label: "12.30-16.30" },
};

/** ชื่อจุดของคอลัมน์ (กลุ่มอาคาร + ชื่อจุดแถว 2 + หมายเลขแถว 3) ใช้เทียบว่าเป็นจุดเดียวกันหรือไม่ */
export function pointLabel(sec: SectionNo, ci: number): string {
  const [, r2, r3] = HEADER_ROWS[sec];
  const g = GROUPS.findIndex(([a, b]) => ci >= a && ci < b);
  if (g < 0) return "";
  let name = "";
  for (let c = ci; c >= GROUPS[g][0]; c--)
    if (r2[c]) {
      name = r2[c];
      break;
    }
  return [GROUP_NAMES[g], name, r3[ci]].filter((x) => x).join(" ");
}

export interface CrossSection {
  sec: SectionNo;
  table: string;
  label: string;
  /** ชื่อจุดของคอลัมน์ CROSS_COLS ตามลำดับ */
  points: string[];
  /** วัน → ค่าทุกช่องในแถว (index 0..36) เฉพาะวันที่มีในเดือน */
  rows: Record<number, string[]>;
}
export interface CrossInfo {
  current: SectionNo;
  cols: string[];
  sections: CrossSection[];
}

export function crossInfo(res: MonthResult, current: SectionNo): CrossInfo {
  return {
    current,
    cols: CROSS_COLS,
    sections: res.sections.map((s) => {
      const sec = s.section as SectionNo;
      const rows: Record<number, string[]> = {};
      for (const r of s.rows) if (r.date !== null) rows[r.day] = r.cells;
      return { sec, ...SECTION_LABEL[sec], points: CROSS_COLS.map((c) => pointLabel(sec, colIndex(c))), rows };
    }),
  };
}
