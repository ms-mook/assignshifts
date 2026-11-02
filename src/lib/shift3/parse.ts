// แปลงค่าดิบจาก Google Sheet (ตาราง 2 มิติ) เป็นโครงสร้างข้อมูล
// ตำแหน่งแถว/คอลัมน์ทั้งหมดตรงกับชีตต้นฉบับ (แถว 1 = index 0)

import { toSerial } from "../sheets-date";
import type { LeaveRow, Person, Shift3Settings, Spot, TrainingStep, Holiday } from "./types";

export type Grid = unknown[][];

function cell(g: Grid, a1: string): unknown {
  const m = /^([A-Z]+)(\d+)$/.exec(a1);
  if (!m) throw new Error(a1);
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return g[+m[2] - 1]?.[c - 1];
}

export function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/** ช่วงที่เว็บต้องอ่านจากชีต ตั้งค่า */
export const SETTINGS_RANGE = "'ตั้งค่า'!A1:X90";

export function parseSettings(g: Grid): Shift3Settings {
  const s = (a1: string) => str(cell(g, a1));
  const persons: Person[] = [];
  const spots: Spot[] = [];
  for (let r = 13; r <= 26; r++) {
    persons.push({
      no: s(`A${r}`),
      name: s(`B${r}`),
      start: toSerial(cell(g, `C${r}`)),
      lastDay: toSerial(cell(g, `D${r}`)),
      replacement: s(`E${r}`),
      replacementStart: toSerial(cell(g, `F${r}`)),
    });
    spots.push({
      code: num(cell(g, `J${r}`)) ?? r - 13,
      name: s(`K${r}`),
      room: s(`L${r}`),
      pos13: num(cell(g, `M${r}`)),
      pos14: num(cell(g, `N${r}`)),
      fillOrder: num(cell(g, `O${r}`)),
    });
  }
  const training: TrainingStep[] = [];
  for (let r = 13; r <= 22; r++) {
    training.push({ week: num(cell(g, `Q${r}`)) ?? r - 12, code: num(cell(g, `R${r}`)) ?? -1, label: s(`S${r}`) });
  }
  const monthNames: string[] = [];
  for (let r = 46; r <= 57; r++) monthNames.push(s(`A${r}`));
  const holidays: Holiday[] = [];
  for (let r = 46; r <= 85; r++) {
    const date = toSerial(cell(g, `H${r}`));
    const name = s(`I${r}`);
    if (date !== null || name !== "") holidays.push({ date, name });
  }
  const startMonday = toSerial(cell(g, "B3"));
  if (startMonday === null) throw new Error("ตั้งค่า!B3 (วันเริ่มตาราง) ว่างหรืออ่านไม่ได้");
  return {
    startMonday,
    rotationPattern: num(cell(g, "B4")) ?? 1,
    newHireStart: toSerial(cell(g, "B5")),
    newHireMonths: num(cell(g, "B6")) ?? 0,
    trainingWeeks: num(cell(g, "B8")) ?? 0,
    persons,
    spots,
    training,
    pairOddKw8: s("B29"),
    pairOddOpd11: s("B30"),
    poctKw: s("B33"),
    poctOpd: s("B34"),
    poctAlt1: s("B35"),
    poctAlt2: s("B36"),
    b30AtKey1: s("B37"),
    fillFrom: [s("B40"), s("B41"), s("B42")],
    monthNames,
    holidays,
    signerName: s("B89"),
    signerTitle: s("B90"),
  };
}

export const LEAVES_RANGE = "'ลา-แลกเวร'!A5:G400";

/** g = ค่าตั้งแต่แถว 5 (A5:G400) */
export function parseLeaves(g: Grid): LeaveRow[] {
  return g
    .map((row) => ({
      date: toSerial(row?.[0]),
      name: str(row?.[1]),
      replacement: str(row?.[2]),
      type: str(row?.[3]),
      note: str(row?.[6]),
    }))
    .filter((l) => l.date !== null || l.name !== "" || l.replacement !== "");
}

export const MTRN_RANGE = "'รายชื่อ MT-RN'!A3:D200";

export type MtrnType = "MT" | "RN";
export interface Mtrn { name: string; note: string; type: MtrnType }

/** คอลัมน์ D "ประเภท" (MT/RN) เพิ่มสำหรับเว็บ — ว่าง = MT */
export function parseMtrn(g: Grid): Mtrn[] {
  return g
    .map((row) => ({ name: str(row?.[0]), note: str(row?.[2]), type: (str(row?.[3]).trim().toUpperCase() === "RN" ? "RN" : "MT") as MtrnType }))
    .filter((r) => r.name !== "");
}

/**
 * X13 =FILTER({B13:B26;B29:B30;'รายชื่อ MT-RN'!A3:A200},...<>"")
 * รายชื่อสำหรับ dropdown ของช่องชื่อในฟอร์มเดือน
 */
export function dropdownNames(s: Shift3Settings, mtrn: { name: string }[]): string[] {
  return [...s.persons.map((p) => p.name), s.pairOddKw8, s.pairOddOpd11, ...mtrn.map((m) => m.name)].filter(
    (n) => n !== "",
  );
}
