// เอนจินตาราง "จุดลงทะเบียน" (Key) — แปลงสูตรจากชีต ตารางเวรจุดลงทะเบียนรายการตรวจ ธ.ค.69–พ.ย.70 แบบ 1:1
// วันที่เป็น serial แบบ Google Sheets
import { daysInMonth, serialOf, weekdayMon1 } from "../ot/engine";

export interface KeyLeave { date: number | null; who: string; sub: string; note: string }
export interface KeySettings {
  rotStart: number; // B3
  key4Name: string; // B4 ชื่อประจำ Key4 (SMC)
  signerName: string; // B5
  signerTitle: string; // B6
  threshold: number; // B7
  title: string; // B8
  docNo: string; // B9
  head: string; // B10 หัวหน้าเวรประจำ (R/A)
  rot: string[]; // B13:B16 (4 คน)
  rotNote: string[]; // C13:C16
  holidays: { date: number; name: string }[]; // E13:F58
  monthNames: string[]; // H13:H24
  dropdown: string[]; // J13:J58 (ตามแถว รวมช่องว่าง 46 ช่อง)
  heads: string[]; // R13:R20 (ตามแถว)
  leaves: KeyLeave[]; // ลา-แลกเวร!A5:H5004 (ตามแถว)
}

export const KEY_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
/** ช่องพิมพ์เอง (ว่างในชีตเดิม): Key1, OPD key(เสริม2), OPD เก็บ 1, กว. Key2, กว. คิว/เก็บ, OPD คิว */
export const KEY_MANUAL_COLS = ["B", "H", "I", "K", "N", "O"];
export const KEY_EDIT_COLS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
const MT = "MT full-time";
const mod = (a: number, n: number) => ((a % n) + n) % n;
/** TRIM ของ Sheets: ตัดช่องว่างหัวท้าย และยุบช่องว่างซ้อนเหลือ 1 */
const sheetTrim = (s: string) => s.replace(/ +/g, " ").trim();

export interface KeyRow {
  day: number;
  date: number | null;
  Q: number;
  R: number | null;
  cells: Record<string, string>; // B..P
  manualCols: string[];
}
export interface KeyChecks { dup: number; vacancy: number; onHoliday: number; unknown: number; status: string }
export interface KeyMonth {
  y: number;
  m: number;
  title: string;
  subtitle: string;
  rows: KeyRow[];
  dayCounts: { name: string; count: number }[]; // V12:W31
  checks: KeyChecks;
  signerName: string;
  signerTitle: string;
}

/** LET(b, ..., IF(COUNTIFS(ลา: วันที่=A, ผู้ลา=b)>0, ผู้แทนคนแรกที่ไม่ว่าง หรือ "ลา", b)) */
function withLeave(s: KeySettings, date: number, b: string): string {
  const rows = s.leaves.filter((l) => l.date === date && l.who === b);
  if (rows.length === 0) return b;
  const sub = rows.find((l) => l.sub !== "");
  return sub ? sub.sub : "ลา";
}

export function computeKeyMonth(s: KeySettings, manual: Record<string, string>, y: number, m: number): KeyMonth {
  const nd = daysInMonth(y - 543, m);
  const hol = new Map<number, string>();
  for (const h of s.holidays) if (!hol.has(h.date)) hol.set(h.date, h.name);
  const rows: KeyRow[] = [];
  for (let day = 1; day <= 31; day++) {
    if (day > nd) {
      rows.push({ day, date: null, Q: 0, R: null, cells: Object.fromEntries(KEY_EDIT_COLS.map((c) => [c, ""])), manualCols: [] });
      continue;
    }
    const A = serialOf(y - 543, m, day);
    const Q = weekdayMon1(A) > 5 || hol.has(A) ? 0 : 1;
    const R = Q === 1 ? Math.floor((A - s.rotStart) / 7) : null;
    const c: Record<string, string> = {};
    for (const col of KEY_MANUAL_COLS) c[col] = "";
    const rot = (k: number) => (R === null ? "" : withLeave(s, A, s.rot[mod(k - R, 4)] ?? ""));
    c.C = Q === 1 ? MT : "";
    c.D = rot(0);
    c.E = rot(1);
    c.F = rot(2);
    c.G = Q === 1 ? withLeave(s, A, s.head) : "";
    c.J = Q === 1 ? MT : "";
    c.L = rot(3);
    c.M = Q === 1 ? withLeave(s, A, s.key4Name) : "";
    const lv = s.leaves.filter((l) => l.date === A).map((l) => `${l.who} ลา${l.sub === "" ? "" : "→" + l.sub}`);
    c.P = sheetTrim(`${hol.get(A) ?? ""} ${lv.join(" · ")}`);
    const manualCols: string[] = [];
    for (const col of KEY_EDIT_COLS) {
      const k = `${col}:${day}`;
      if (k in manual) {
        c[col] = manual[k];
        manualCols.push(col);
      }
    }
    rows.push({ day, date: A, Q, R, cells: c, manualCols });
  }

  // ---------- สรุปวันทำงานเดือนนี้ (V12:W31 = ตั้งค่า J13:J32) ----------
  const eqi = (a: string, b: string) => a.toLowerCase() === b.toLowerCase(); // COUNTIF ไม่สนตัวพิมพ์เล็ก/ใหญ่
  const cnt = (cols: string[], name: string) =>
    rows.reduce((n, r) => n + cols.filter((col) => r.cells[col] !== "" && eqi(r.cells[col], name)).length, 0);
  const BF = ["B", "C", "D", "E", "F"], HO = ["H", "I", "J", "K", "L", "M", "N", "O"];
  const dayCounts = Array.from({ length: 20 }, (_, i) => s.dropdown[i] ?? "")
    .filter((n) => n !== "")
    .map((name) => ({ name, count: cnt(BF, name) + cnt(HO, name) }));

  // ---------- ตรวจสอบตารางเวร (V33:W38) ----------
  const DUPCOLS = ["B", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O"];
  let dup = 0;
  for (const r of rows) {
    const vals = DUPCOLS.map((col) => r.cells[col]).filter((v) => v !== "" && v !== "ลา" && v !== MT);
    dup += vals.length - new Set(vals).size;
  }
  let vac = 0, la = 0, filled = 0;
  for (const r of rows) {
    if (r.Q === 1 && ["D", "E", "F", "G", "L", "M"].some((col) => r.cells[col] === "")) vac++;
    la += ["D", "E", "F", "G", "L", "M"].filter((col) => r.cells[col] === "ลา").length;
    filled += ["H", "I", "N", "O"].filter((col) => r.cells[col] !== "").length;
  }
  const vacancy = vac + Math.max(0, la - filled);
  const onHoliday = rows.filter((r) => r.Q === 0).reduce((n, r) => n + ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"].filter((col) => r.cells[col] !== "").length, 0);
  const inList = (v: string, list: string[]) => list.some((x) => x !== "" && eqi(x, v));
  let unknown = 0;
  for (const r of rows) {
    for (const col of [...BF, ...HO]) {
      const v = r.cells[col];
      if (v !== "" && v !== "ลา" && v !== MT && !inList(v, s.dropdown)) unknown++;
    }
    const g = r.cells.G;
    if (g !== "" && g !== "ลา" && !inList(g, s.heads) && !inList(g, s.dropdown)) unknown++;
  }
  const status = dup + vacancy + onHoliday + unknown === 0 ? "✓ ปกติ" : "⚠ ตรวจสอบ";

  return {
    y,
    m,
    title: `${s.title}     ${s.docNo}`,
    subtitle: `ประจำเดือน ${s.monthNames[m - 1] ?? ""} พ.ศ.${y}`,
    rows,
    dayCounts,
    checks: { dup, vacancy, onHoliday, unknown, status },
    signerName: s.signerName,
    signerTitle: s.signerTitle,
  };
}

/** ตั้งค่า!Q (จุดที่ลา อัตโนมัติ) */
export function keyLeaveSpot(s: KeySettings, l: KeyLeave): string {
  if (l.date === null || l.who === "") return "";
  const i = s.rot.indexOf(l.who);
  if (i >= 0) return mod(i + Math.floor((l.date - s.rotStart) / 7), 4) <= 2 ? "OPD" : "กว.";
  if (l.who === s.key4Name) return "กว.";
  return s.heads.includes(l.who) ? "หัวหน้าเวร" : "—";
}
