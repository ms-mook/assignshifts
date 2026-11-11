// ตารางเวรนอกเวลา (เสาร์-อาทิตย์ + จ.-ศ. OPD) — ฟังก์ชันล้วน
// ค่าตั้งต้นของแต่ละช่อง = ค่าที่สูตรในแท็บเดือนของชีตคำนวณไว้แล้ว (อ่านมาตรง ๆ = ตรงกับชีต 100%)
// ช่องที่แก้บนเว็บเก็บแยกในแท็บ WEB-ช่องเลือกเอง (ไม่แตะสูตร) แล้วซ้อนทับตอนแสดงผล
import { serialOf } from "../ot/engine";

export const OFF_COLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
/** ช่องชื่อของเสาร์-อาทิตย์ (ห้องเจาะเลือด OPD + SMC) */
export const OFF_WKEND_COLS = OFF_COLS.slice(2, 23); // C..W
/** ช่องนอกเวลา จ.-ศ. OPD */
export const OFF_WKDAY_COLS = ["Y", "Z"];
export const OFF_EDIT_COLS = [...OFF_WKEND_COLS, ...OFF_WKDAY_COLS];

export interface OffLists {
  /** ตั้งค่า!T5:T32 — dropdown C–G, I, K–P, T, U, V และรายชื่อในสรุป */
  staff: string[];
  /** ตั้งค่า!X9:X12 — dropdown H (ช่อง 6(E)) และ J (ช่อง 8) */
  hj: string[];
  /** ตั้งค่า!X16:X41 — dropdown Q, R, S, W (เก็บ/บัตรคิว) */
  coll: string[];
  /** ตั้งค่า!W52:W59 — dropdown Y (Key ช่อง 2) และรายชื่อในสรุป จ.-ศ. */
  keyY: string[];
  /** ตั้งค่า!X44:X49 — dropdown Z (เวร ช่อง 6) */
  z: string[];
}

/** ตั้งค่า!T5:X59 → รายชื่อ dropdown แต่ละชุด (แถว 5 = index 0 · คอลัมน์ T=0 U=1 V=2 W=3 X=4) */
export function parseOffLists(g: unknown[][]): OffLists {
  const col = (c: number, r1: number, r2: number) => Array.from({ length: r2 - r1 + 1 }, (_, i) => str((g[r1 - 5 + i] ?? [])[c]).trim());
  return { staff: col(0, 5, 32), hj: col(4, 9, 12), coll: col(4, 16, 41), keyY: col(3, 52, 59), z: col(4, 44, 49) };
}

export interface OffRow {
  day: number;
  /** serial วันที่ (null = เกินจำนวนวันของเดือน: A ว่าง) */
  date: number | null;
  A: string;
  B: string;
  X: string;
  /** AD = งดบริการ (1=ใช่) */
  AD: number;
  cells: Record<string, string>;
  manualCols: string[];
}
export interface OffMonth {
  y: number;
  m: number;
  /** ข้อความหัวตาราง (แถว 1–6) อ่านจากแท็บเดือน key = "C6" ฯลฯ */
  head: Record<string, string>;
  rows: OffRow[];
  signerName: string;
  signerTitle: string;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const eqi = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** grid = ค่าแท็บเดือน A1:AD40 (FORMATTED_VALUE) · manual = ช่องที่แก้บนเว็บ ("COL:day" → ค่า) */
export function buildOffMonth(grid: unknown[][], manual: Record<string, string>, y: number, m: number): OffMonth {
  const cell = (r: number, col: string) => str((grid[r - 1] ?? [])[colIndex(col)]);
  const head: Record<string, string> = {};
  for (let r = 1; r <= 6; r++) for (const c of OFF_COLS) {
    const v = cell(r, c);
    if (v !== "") head[`${c}${r}`] = v;
  }
  const rows: OffRow[] = [];
  for (let day = 1; day <= 31; day++) {
    const r = day + 6;
    const A = cell(r, "A").trim();
    const date = A === "" ? null : serialOf(y - 543, m, Number(A));
    const cells: Record<string, string> = {};
    for (const c of OFF_EDIT_COLS) cells[c] = cell(r, c);
    const manualCols: string[] = [];
    if (date !== null)
      for (const c of OFF_EDIT_COLS) {
        const k = `${c}:${day}`;
        if (k in manual) {
          cells[c] = manual[k];
          manualCols.push(c);
        }
      }
    rows.push({ day, date, A, B: cell(r, "B").trim(), X: cell(r, "X").trim(), AD: cell(r, "AD").trim() === "1" ? 1 : 0, cells, manualCols });
  }
  return { y, m, head, rows, signerName: cell(39, "Q"), signerTitle: cell(40, "Q") };
}

export function colIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// ---------- กฎจัดรูปแบบตามเงื่อนไข (ลำดับเดียวกับชีต · ชีตใช้กฎแรกที่ตรง) ----------
const GREY = "#D5D5D5";
const in_ = (c: string, list: string) => list.split(",").some((part) => {
  const [a, b] = part.split("-");
  return b ? colIndex(c) >= colIndex(a) && colIndex(c) <= colIndex(b) : c === a;
});
/** WEEKDAY(serial) แบบ Google Sheets (1 = อาทิตย์ … 7 = เสาร์) */
export const weekday1 = (serial: number) => ((((serial - 1) % 7) + 7) % 7) + 1;
const isWeekendB = (b: string) => b === "เสาร์" || b === "อาทิตย์";

/** นับ COUNTIF(col 7:37, v) ในเดือน */
export function colCounts(rows: OffRow[], col: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = (r.cells[col] ?? "").trim().toLowerCase();
    if (v !== "") m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

export interface CellFmt { bg?: string; fg?: string; bold?: boolean; dup?: boolean }
/**
 * กฎ (ช่วงแถว 7–37) เรียงตามชีต:
 *  0 R: อาทิตย์ → เทา · 1 Y:Z: มีวันที่และ Y ว่าง → เทา D8 · 2 I,K,M:P,U:V: ชื่อซ้ำในคอลัมน์ทั้งเดือน → ชมพู
 *  3 C:W: งดบริการ → เทา · 4 C:E: ส-อา และว่าง → เทา · 5 G: อาทิตย์ → เทา · 6 I,L:P,T:V: ส-อา และว่าง → เทา
 *  7 J:K: อาทิตย์ → เทา · 8 Y:Z: งดบริการ → เทา · 9 A,B,X: งดบริการ → ตัวแดงหนา · 10 C:W: ไม่ใช่ ส-อา → เทา
 *  11 Y:Z: ส-อา หรือ A ว่าง → เทา · 12 A,B,X: A ว่าง → เทา · 13 B: อาทิตย์ → ตัวแดงเข้มหนา
 */
export function cfOf(r: OffRow, col: string, dupCount: (col: string, v: string) => number): CellFmt | null {
  const v = col === "A" ? r.A : col === "B" ? r.B : col === "X" ? r.X : (r.cells[col] ?? "");
  const hasDate = r.date !== null;
  const wd = hasDate ? weekday1(r.date as number) : null;
  const sun = wd === 1;
  const wkend = wd === 1 || wd === 7;
  if (col === "R" && sun) return { bg: GREY };
  if (in_(col, "Y-Z") && hasDate && (r.cells.Y ?? "") === "") return { bg: "#D8D8D8" };
  if (in_(col, "I,K,M-P,U-V") && v !== "" && dupCount(col, v) > 1) return { bg: "#F4CCCC", dup: true };
  if (in_(col, "C-W") && r.AD === 1) return { bg: GREY };
  if (in_(col, "C-E") && hasDate && wkend && v === "") return { bg: GREY };
  if (col === "G" && sun) return { bg: GREY };
  if (in_(col, "I,L-P,T-V") && hasDate && wkend && v === "") return { bg: GREY };
  if (in_(col, "J-K") && sun) return { bg: GREY };
  if (in_(col, "Y-Z") && r.AD === 1) return { bg: GREY };
  if (in_(col, "A-B,X") && r.AD === 1) return { fg: "#CC0000", bold: true };
  if (in_(col, "C-W") && !isWeekendB(r.B)) return { bg: GREY };
  if (in_(col, "Y-Z") && (isWeekendB(r.B) || r.A === "")) return { bg: GREY };
  if (in_(col, "A-B,X") && r.A === "") return { bg: GREY };
  if (col === "B" && r.B === "อาทิตย์") return { fg: "#BF0000", bold: true };
  return null;
}

/** วันที่ที่มีชื่อซ้ำในคอลัมน์ (กฎชมพูของชีต) */
export function offDupDays(mo: OffMonth): number[] {
  const counts = Object.fromEntries(OFF_EDIT_COLS.map((c) => [c, colCounts(mo.rows, c)]));
  const dc = (c: string, v: string) => counts[c]?.get(v.trim().toLowerCase()) ?? 0;
  return mo.rows.filter((r) => r.date !== null && OFF_EDIT_COLS.some((c) => cfOf(r, c, dc)?.dup)).map((r) => r.day);
}

// ---------- สรุป (สูตร AF–AM และ AO–AR ของแท็บเดือน) ----------
const countIn = (mo: OffMonth, cols: string[], name: string) =>
  mo.rows.reduce((n, r) => n + cols.filter((c) => eqi(r.cells[c] ?? "", name) && (r.cells[c] ?? "").trim() !== "").length, 0);
const range = (a: string, b: string) => OFF_COLS.slice(colIndex(a), colIndex(b) + 1);

export interface OffSummaryRow { name: string; count: number; counts: number[] }
export interface OffSummary { title: string; cols: string[]; rows: OffSummaryRow[] }

/**
 * AF = ตั้งค่า!T5:T32 · AG = COUNTIF(C:P) OPD · AH = COUNTIF(T:V) SMC · AI = AG+AH · AJ/AK/AL/AM = COUNTIF C / D / H / J
 * AO = ตั้งค่า!W52:W59 · AP = COUNTIF(Y) · AQ = COUNTIF(Z) · AR = AP+AQ
 */
export function offSummary(mo: OffMonth, lists: OffLists): OffSummary[] {
  const uniq = (a: string[]) => Array.from(new Set(a.map((x) => x.trim()).filter((x) => x !== "")));
  const wk = uniq(lists.staff).map((name) => {
    const opd = countIn(mo, range("C", "P"), name);
    const smc = countIn(mo, range("T", "V"), name);
    return { name, count: opd + smc, counts: [opd, smc, opd + smc, countIn(mo, ["C"], name), countIn(mo, ["D"], name), countIn(mo, ["H"], name), countIn(mo, ["J"], name)] };
  });
  const wd = uniq(lists.keyY).map((name) => {
    const y = countIn(mo, ["Y"], name);
    const z = countIn(mo, ["Z"], name);
    return { name, count: y + z, counts: [y, z, y + z] };
  });
  return [
    { title: "สรุปจำนวนเวรประจำเดือน (ส.-อา.)", cols: ["OPD (งานหนัก)", "SMC (งานเบา)", "รวมเวร", "Key 1", "Key 2", "ช่อง 6(E)", "ช่อง 8"], rows: wk },
    { title: "สรุปเวรนอกเวลา (จ.-ศ.) OPD", cols: ["Key ช่อง 2", "เวร ช่อง 6", "รวมเวร"], rows: wd },
  ];
}

/** รายชื่อ dropdown ของแต่ละคอลัมน์ (ตามการตรวจข้อมูลของแท็บเดือน) */
export function offNamesByCol(l: OffLists): Record<string, string[]> {
  const nz = (a: string[]) => Array.from(new Set(a.map((x) => x.trim()).filter((x) => x !== "")));
  const out: Record<string, string[]> = {};
  for (const c of [...range("C", "G"), "I", ...range("K", "P"), "T", "U", "V"]) out[c] = nz(l.staff);
  for (const c of ["H", "J"]) out[c] = nz(l.hj);
  for (const c of ["Q", "R", "S", "W"]) out[c] = nz(l.coll);
  out.Y = nz(l.keyY);
  out.Z = nz(l.z);
  return out;
}

// ---------- การลา (ระบบลา ประเภท งดเวรนอกเวลา) ----------
export interface OffLeave { firstName: string; start: number; end: number }
export const offOnLeave = (leaves: OffLeave[], name: string, date: number) =>
  name.trim() !== "" && leaves.some((l) => eqi(l.firstName, name) && l.start <= date && l.end >= date);

/** ช่องที่ชื่อตรงกับคนที่ งดเวรนอกเวลา ในวันนั้น */
export function offLeaveHits(mo: OffMonth, leaves: OffLeave[]): { day: number; col: string; name: string }[] {
  const out: { day: number; col: string; name: string }[] = [];
  for (const r of mo.rows) {
    if (r.date === null) continue;
    for (const c of OFF_EDIT_COLS) {
      const v = (r.cells[c] ?? "").trim();
      if (v !== "" && offOnLeave(leaves, v, r.date)) out.push({ day: r.day, col: c, name: v });
    }
  }
  return out;
}
