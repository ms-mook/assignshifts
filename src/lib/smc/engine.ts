// เอนจินตาราง SMC — แปลงสูตรจากชีต "ตารางเวร SMC ธ.ค.69–พ.ย.70" แบบ 1:1 (วันที่เป็น serial แบบ Google Sheets)
import { daysInMonth, serialOf, weekdayMon1 } from "../ot/engine";

export interface SmcLeave { name: string; start: number | null; end: number | null; type: string; sub: string; note: string }
export interface SmcSettings {
  title: string; // B3
  docNo: string; // B4
  signerName: string; // B5
  signerTitle: string; // B6
  hours: [number, number, number]; // F4:F6
  q0700: string; // B7 Manager/Q 07.00–08.30
  q0830: string; // B8 Manager/Q 08.30–12.30
  q1230: string; // B9 Manager/Q ช่อง1/บัตรคิว 12.30–16.00
  key0700: string; // B10 ลงทะเบียน Key1 07.00–08.30
  key0830: string; // B11 ลงทะเบียน Key1 08.30–12.30
  mt: string; // B12
  pt: string; // B13
  holidays: { date: number; name: string }[]; // E17:F66
  monthNames: string[]; // H17:H28
  listJ: string[]; // J17:J46 รายชื่อ จนท.จ้างเหมาฯ
  listL: string[]; // L17:L46 Key1 / ช่อง 3,4,5 (07.00) และคนแทน
  listN: string[]; // N17:N46 dropdown 08.30–12.30
  listP: string[]; // P17:P46 dropdown 12.30–16.00
  listT: string[]; // T17:T20 ผู้แทนอัมพร
  leaves: SmcLeave[]; // ตารางลา!A5:F200
}

export const SMC_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"];
export const SMC_EDIT_COLS = SMC_COLS.slice(1);
/** ช่องที่ว่างในชีตเดิม (เลือกจาก dropdown เอง) */
export const SMC_MANUAL_COLS = ["G", "H", "I", "O", "P", "T"];
/** ช่วงเวลา (สำหรับกฎชื่อซ้ำ) */
export const SMC_BLOCKS = [["B", "C", "D", "E", "F", "G", "H", "I"], ["J", "K", "L", "M", "N", "O", "P"], ["Q", "R", "S", "T"]];

export interface SmcRow { day: number; date: number | null; V: number; cells: Record<string, string>; manualCols: string[] }
export interface SmcPerson { name: string; days: number; h0700: number; h0830: number; h1230: number; hTotal: number }
export interface SmcMonth {
  y: number;
  m: number;
  title: string;
  subtitle: string;
  rows: SmcRow[];
  workdays: number;
  people: SmcPerson[]; // X8:AC
  signerName: string;
  signerTitle: string;
}

/** ตารางลา!G = IF(OR(A="",B=""),"",IF(C="",B,C)) */
export const leaveEnd = (l: SmcLeave) => (l.name === "" || l.start === null ? null : l.end === null ? l.start : l.end);
const eqi = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** LET(b, ..., s, คนแทนรายการแรกที่ ชื่อ=b, เริ่ม<=วันที่, สิ้นสุด>=วันที่, คนแทน<>"" ; IF(s<>"", s, b)) */
function sub(s: SmcSettings, b: string, date: number): string {
  const l = s.leaves.find((x) => {
    const g = leaveEnd(x);
    return eqi(x.name, b) && x.start !== null && x.start <= date && g !== null && g >= date && x.sub !== "";
  });
  return l ? l.sub : b;
}

/** มีชื่อนี้อยู่ในตารางลาวันนั้นหรือไม่ (กฎสีส้มขีดฆ่า) */
export function onLeave(s: SmcSettings, name: string, date: number): boolean {
  if (name === "") return false;
  return s.leaves.some((x) => {
    const g = leaveEnd(x);
    return eqi(x.name, name) && x.start !== null && x.start <= date && g !== null && g >= date;
  });
}

export function computeSmcMonth(s: SmcSettings, manual: Record<string, string>, y: number, m: number): SmcMonth {
  const nd = daysInMonth(y - 543, m);
  const hol = new Set(s.holidays.map((h) => h.date));
  const rows: SmcRow[] = [];
  for (let day = 1; day <= 31; day++) {
    const empty = Object.fromEntries(SMC_EDIT_COLS.map((c) => [c, ""]));
    if (day > nd) {
      rows.push({ day, date: null, V: 0, cells: empty, manualCols: [] });
      continue;
    }
    const A = serialOf(y - 543, m, day);
    const V = weekdayMon1(A) > 5 || hol.has(A) ? 0 : 1;
    const c: Record<string, string> = { ...empty };
    if (V === 1) {
      c.B = s.q0700;
      c.C = sub(s, s.key0700, A);
      c.D = s.mt;
      c.E = s.mt;
      c.F = s.pt;
      c.J = s.q0830;
      c.K = sub(s, s.key0830, A);
      c.L = s.mt;
      c.M = s.mt;
      c.N = s.pt;
      c.Q = sub(s, s.q1230, A);
      c.R = s.mt;
      c.S = s.mt;
    }
    const manualCols: string[] = [];
    for (const col of SMC_EDIT_COLS) {
      const k = `${col}:${day}`;
      if (k in manual) {
        c[col] = manual[k];
        manualCols.push(col);
      }
    }
    rows.push({ day, date: A, V, cells: c, manualCols });
  }

  // X8 =UNIQUE(FILTER(VSTACK(J18:J46, L17:L46, N17:N46, P17:P46, TOCOL(B7:T37)), a<>"", a<>B12, a<>B13, a<>"จนท.จ้างเหมาฯ"))
  const pool = [
    ...s.listJ.slice(1),
    ...s.listL,
    ...s.listN,
    ...s.listP,
    ...rows.flatMap((r) => SMC_EDIT_COLS.map((col) => r.cells[col] ?? "")),
  ];
  const names: string[] = [];
  for (const a of pool) {
    if (a === "" || eqi(a, s.mt) || eqi(a, s.pt) || eqi(a, "จนท.จ้างเหมาฯ")) continue;
    if (!names.includes(a)) names.push(a);
  }
  const daysIn = (name: string, cols: string[]) => rows.filter((r) => cols.some((col) => eqi(r.cells[col] ?? "", name))).length;
  const people = names.map((name) => {
    const days = daysIn(name, SMC_EDIT_COLS);
    const h0700 = s.hours[0] * daysIn(name, SMC_BLOCKS[0]);
    const h0830 = s.hours[1] * daysIn(name, SMC_BLOCKS[1]);
    const h1230 = s.hours[2] * daysIn(name, SMC_BLOCKS[2]);
    return { name, days, h0700, h0830, h1230, hTotal: h0700 + h0830 + h1230 };
  });
  return {
    y,
    m,
    title: `${s.title} ${s.docNo}`,
    subtitle: `ประจำเดือน ${s.monthNames[m - 1] ?? ""} พ.ศ.${y}`,
    rows,
    workdays: rows.reduce((n, r) => n + r.V, 0),
    people,
    signerName: s.signerName,
    signerTitle: s.signerTitle,
  };
}

/** ชื่อซ้ำในช่วงเวลาเดียวกัน (ไม่นับข้อความช่องประจำ MT/Part-time) — กฎสีแดงของชีต */
export function smcDupCols(s: SmcSettings, cells: Record<string, string>): Set<string> {
  const out = new Set<string>();
  for (const block of SMC_BLOCKS) {
    for (const col of block) {
      const v = cells[col] ?? "";
      if (v === "" || v === s.mt || v === s.pt) continue;
      if (block.filter((x) => eqi(cells[x] ?? "", v)).length > 1) out.add(col);
    }
  }
  return out;
}
