// รูปแบบตาราง (หัวตาราง/สี/ขนาด) — คัดลอกจากชีต ม.ค.70 ตามที่ผู้ใช้ยืนยัน
// ห้ามแก้ข้อความหัวตาราง: ค่าทั้งหมดดึงตรงจากชีตจริง (รวมช่องที่ว่างในชีต)

import type { SectionNo } from "./types";

const ROW4 = [
  "วันที่", "ห้องเจาะเลือด ฯ อาคารผู้ป่วยนอก OPD (OPD ชั้น 1)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
  "ห้องเจาะเลือด ฯ อาคารกัลยาณิวัฒนานุสรณ์ (กว. ชั้น 1)", "", "", "", "", "", "", "", "", "", "", "SMC(สว.1 ชั้น)", "", "",
  "", "", "เวชกรรมสังคม(อคร. ชั้น 1)", "", "ออกหน่วย SHE", "",
];
// ส่วนที่ 1-2: ใส่ชื่อจุดทุกช่อง ตามชีต ม.ค.70 ส่วนที่ 1 (ผู้ใช้ยืนยัน 6 พ.ย. 69) ใช้กับทุกเดือน
const ROW5 = [
  "", "KEY", "KEY", "KEY", "KEY", "KEY", "สวัสดิการ", "สวัสดิการ", "ผู้สูงอายุ", "ผู้สูงอายุ", "ทั่วไป", "ทั่วไป", "ทั่วไป",
  "ทั่วไป", "เด็ก", "รถเข็น", "รถเข็น", "KEY", "KEY", "KEY", "KEY", "ทั่วไป", "สวัสดิการ/ผู้สูงอายุ", "สวัสดิการ/ผู้สูงอายุ",
  "ทั่วไป", "POCT", "เด็ก", "รถเข็น", "KEY1", "KEY2", "เจาะ1", "เจาะ2", "เจาะ3/4/5", "KEY1", "เจาะ1", "เก็บ1", "เจาะ1",
];
const ROW6 = [
  "", "Key1", "Key2", "Key3", "Key4", "Key5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "Key1", "Key2",
  "Key3", "Key4", "5", "6", "7", "8", "9", "10", "11", "", "", "", "", "", "", "", "", "",
];
const ROW7 = [
  "เวลา", "จนท.", "MTF.", "จนท.", "จนท.", "จนท.", "MTF.", "MTF.", "MT/RN", "MT/RN", "MT/RN", "MT/RN", "MTF.", "MTF.", "MTF.",
  "MTF.", "MTF.", "MTF.", "จนท.", "จนท.", "จนท.", "MT/RN", "MT/RN", "MTF.", "MT(E)", "MT/RN", "MTF.", "MTF.", "จนท.", "MTF.",
  "MTF.", "MT/RN", "", "", "", "", "",
];

// ส่วนที่ 2: ชีตจริงแถว 45 ช่อง B:Q (merge) ไม่มีข้อความ — คงไว้ตามชีต
const ROW45 = ROW4.map((v, i) => (i >= 1 && i <= 16 ? "" : v));

// ส่วนที่ 3 (แถว 86-89)
// ในชีตต้นฉบับ A86 เป็นข้อความ "12.30 - 16.30 น." แต่ผู้ใช้ขอให้ใช้ "วันที่" เหมือนตารางอื่น
const ROW86 = ROW4;
const ROW87 = [
  // ผู้ใช้ขอ (2 พ.ย. 69): ใส่ชื่อจุดทุกช่อง และคอลัมน์ K/L (OPD) เป็น "ทั่วไป" แทน "POCT"
  "", "KEY", "KEY", "KEY", "KEY", "KEY", "สวัสดิการ", "สวัสดิการ", "ผู้สูงอายุ", "ผู้สูงอายุ", "ทั่วไป", "ทั่วไป", "ทั่วไป",
  "ทั่วไป", "เด็ก", "รถเข็น", "รถเข็น", "KEY", "KEY", "KEY", "KEY", "ทั่วไป", "สวัสดิการ/ผู้สูงอายุ", "ทั่วไป", "ทั่วไป", "POCT",
  "เด็ก", "รถเข็น", "KEY1", "KEY2", "เจาะ1", "เจาะ2", "เจาะ3/4/5", "KEY1", "เจาะ1", "เก็บ1", "เจาะ1",
];
const ROW88 = [
  "", "Key1", "Key2", "Key3", "Key4", "Key5", "6", "7", "8", "9", "OPD", "OPD", "12", "13", "14", "15", "16", "Key1", "Key2",
  "Key3", "Key4", "5", "6", "7", "8", "กว.", "10", "11", "", "", "", "", "", "", "", "", "",
];
const ROW89 = [
  "เวลา", "จนท.", "MTF.", "จนท.", "จนท.", "จนท.", "MTF.", "MTF.", "MT/RN", "MT/RN", "MTF.", "MTF.", "MTF.", "MTF.", "MTF.",
  "MTF.", "MTF.", "MTF.", "จนท.", "จนท.", "จนท.", "MT/RN", "MT/RN", "MTF.", "MT(E)", "MT(E)", "MTF.", "MTF.", "จนท.", "MTF.",
  "MTF.", "MT/RN", "", "", "", "", "",
];

export const HEADER_ROWS: Record<SectionNo, string[][]> = {
  1: [ROW4, ROW5, ROW6, ROW7],
  2: [ROW45, ROW5, ROW6, ROW7],
  3: [ROW86, ROW87, ROW88, ROW89],
};

/** กลุ่มคอลัมน์แถวหัวตารางแรก (merge) [เริ่ม, จบแบบไม่รวม, สีพื้น] */
export const GROUPS: [number, number, string][] = [
  [1, 17, "#E5CEDB"], // OPD
  [17, 28, "#CEDDED"], // กว.
  [28, 33, "#D6E8D1"], // SMC
  [33, 35, "#EFEFEF"], // เวชกรรมสังคม
  [35, 37, "#EFEFEF"], // SHE
];

export function groupColor(col: number): string {
  for (const [a, b, c] of GROUPS) if (col >= a && col < b) return c;
  return "#FFFFFF";
}

export const COL_WIDTH = { A: 60, other: 145 };
export const ROW_HEIGHT = { title: 36, subtitle: 28, time: 28, header: [34, 46, 34, 34], data: 112, sigGap: 72, sig: 30 };

export const COLORS = {
  title: "#FFFFFF",
  subtitle: "#FCF2D1",
  time: "#DDEAF4",
  headRow7: "#333333",
  manualBg: "#D8D8D8",
  manualFg: "#7F7F7F",
  chemMolec: "#E8E0F4", // ส่วนที่ 2 K:L
  poct: "#D8EDD3", // ส่วนที่ 3 K, L, Z
  grayRow: { 1: "#BFBFBF", 2: "#BFBFBF", 3: "#BEBEBE" } as Record<SectionNo, string>,
  warn: "#FF7B7E",
  replace: "#FFD766",
  moved: "#7E7E7E",
};

/** สีพื้นปกติของช่องข้อมูล (userEnteredFormat ในชีต) */
export function baseCellStyle(section: SectionNo, col: number): { bg?: string; fg?: string } {
  const gray = { bg: COLORS.manualBg, fg: COLORS.manualFg };
  const isManual = [3, 4, 5, 18, 19, 20, 28].includes(col) || (section === 1 && col === 1);
  if (isManual) return gray;
  if (section === 2 && (col === 10 || col === 11)) return { bg: COLORS.chemMolec };
  if (section === 3 && (col === 10 || col === 11 || col === 25)) return { bg: COLORS.poct };
  return {};
}
