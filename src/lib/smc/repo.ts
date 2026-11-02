// อ่าน/เขียนข้อมูลตาราง SMC กับสำเนา Google Sheet ของเว็บ
import "server-only";
import { batchGet, batchUpdate } from "../google";
import { SHEETS, monthTabName, ymString } from "../config";
import { isoFromSerial } from "../sheets-date";
import { readWebState, writeManual, writePersonColors, writeStyles } from "../webtabs";
import { computeSmcMonth, smcDupCols, SMC_EDIT_COLS, type SmcSettings } from "./engine";
import { SMC_LEAVES_RANGE, SMC_SETTINGS_RANGE, parseSmc, str } from "./parse";

const ID = () => SHEETS.smc;

export async function loadSmc(): Promise<SmcSettings> {
  const [sg, lg] = await batchGet(ID(), [SMC_SETTINGS_RANGE, SMC_LEAVES_RANGE]);
  return parseSmc(sg, lg);
}

export async function loadSmcMonthState(s: SmcSettings, yearBE: number, month: number) {
  const st = await readWebState(ID(), ymString(yearBE, month), monthTabName(yearBE, month), "A7:T37");
  const tabManual: Record<string, string> = {};
  if (st.hasTab) {
    const base = computeSmcMonth(s, {}, yearBE, month);
    base.rows.forEach((row, i) => {
      if (row.date === null) return;
      for (const col of SMC_EDIT_COLS) {
        const v = str((st.tab[i] ?? [])[col.charCodeAt(0) - 65]);
        if (v !== (row.cells[col] ?? "")) tabManual[`${col}:${row.day}`] = v;
      }
    });
  }
  const styles = Object.fromEntries(Object.entries(st.styles).map(([k, v]) => [`m:${k}`, v]));
  return { manual: { ...tabManual, ...st.web }, tabManual, styles, personColors: st.personColors, hasTab: st.hasTab };
}

const KEY = /^m:([B-T]):(\d{1,2})$/;
export const isSmcKey = (k: string) => KEY.test(k) && Number(KEY.exec(k)![2]) >= 1 && Number(KEY.exec(k)![2]) <= 31;

export async function saveSmcManual(yearBE: number, month: number, entries: { key: string; value: string | null }[]) {
  const s = await loadSmc();
  const st = await loadSmcMonthState(s, yearBE, month);
  const base = computeSmcMonth(s, {}, yearBE, month);
  await writeManual(
    ID(),
    ymString(yearBE, month),
    entries.map(({ key, value }) => {
      const k = key.slice(2);
      if (value === null && k in st.tabManual) {
        const [col, d] = k.split(":");
        return { key: k, value: base.rows[Number(d) - 1]?.cells[col] ?? "" };
      }
      return { key: k, value };
    }),
  );
}

export async function validateSmcManual(yearBE: number, month: number, key: string, value: string | null): Promise<string | null> {
  if (value === null || value.trim() === "") return null;
  const s = await loadSmc();
  const st = await loadSmcMonthState(s, yearBE, month);
  const k = key.slice(2);
  const [col, d] = k.split(":");
  const res = computeSmcMonth(s, { ...st.manual, [k]: value }, yearBE, month);
  const row = res.rows[Number(d) - 1];
  if (!row || row.date === null) return "วันที่นี้ไม่มีในเดือน";
  if (!smcDupCols(s, row.cells).has(col)) return null;
  return `"${value}" อยู่ในช่วงเวลาเดียวกันของวันที่ ${row.day} แล้ว (พนักงาน 1 คนอยู่ได้ทีละจุดในช่วงเวลาเดียวกัน)`;
}

export const saveSmcStyles = (y: number, m: number, keys: string[], patch: { bg?: string | null; fg?: string | null; clear?: boolean }) =>
  writeStyles(ID(), ymString(y, m), keys.map((k) => k.slice(2)), patch);
export const saveSmcPersonColors = (c: Record<string, string>) => writePersonColors(ID(), c);

// ---------- ตั้งค่า / ตารางลา ----------
const iso = (n: number | null) => (n === null ? "" : isoFromSerial(n));
export interface SmcForm {
  title: string;
  docNo: string;
  signerName: string;
  signerTitle: string;
  hours: [number, number, number];
  q0700: string;
  q0830: string;
  q1230: string;
  key0700: string;
  key0830: string;
  mt: string;
  pt: string;
  holidays: { date: string; name: string }[];
  listJ: string[];
  listL: string[];
  listN: string[];
  listP: string[];
  listT: string[];
  leaves: { name: string; start: string; end: string; type: string; sub: string; note: string }[];
}
const nz = (a: string[]) => a.filter((x) => x !== "");
export function smcToForm(s: SmcSettings): SmcForm {
  return {
    title: s.title, docNo: s.docNo, signerName: s.signerName, signerTitle: s.signerTitle, hours: s.hours,
    q0700: s.q0700, q0830: s.q0830, q1230: s.q1230, key0700: s.key0700, key0830: s.key0830, mt: s.mt, pt: s.pt,
    holidays: s.holidays.map((h) => ({ date: iso(h.date), name: h.name })),
    listJ: nz(s.listJ), listL: nz(s.listL), listN: nz(s.listN), listP: nz(s.listP), listT: nz(s.listT),
    leaves: s.leaves.map((l) => ({ name: l.name, start: iso(l.start), end: iso(l.end), type: l.type, sub: l.sub, note: l.note })),
  };
}
const pad = <T,>(a: T[], n: number, f: T) => [...a, ...Array(Math.max(0, n - a.length)).fill(f)].slice(0, n);

export async function saveSmcForm(f: SmcForm, part: "settings" | "leaves") {
  if (part === "leaves") {
    if (f.leaves.length > 196) throw new Error("ตารางลาได้สูงสุด 196 แถว (ตารางลา A5:F200)");
    await batchUpdate(ID(), [{ range: "'ตารางลา'!A5:F200", values: pad(f.leaves, 196, { name: "", start: "", end: "", type: "", sub: "", note: "" }).map((l) => [l.name, l.start, l.end, l.type, l.sub, l.note]) }]);
    return;
  }
  for (const [k, n] of [["listJ", 30], ["listL", 30], ["listN", 30], ["listP", 30], ["listT", 4]] as const)
    if (f[k].length > n) throw new Error(`รายชื่อเกิน ${n} ชื่อ`);
  if (f.holidays.length > 50) throw new Error("วันหยุดได้สูงสุด 50 รายการ (ตั้งค่า E17:F66)");
  await batchUpdate(ID(), [
    { range: "'ตั้งค่า'!B3:B13", values: [f.title, f.docNo, f.signerName, f.signerTitle, f.q0700, f.q0830, f.q1230, f.key0700, f.key0830, f.mt, f.pt].map((x) => [x]) },
    { range: "'ตั้งค่า'!F4:F6", values: f.hours.map((x) => [x]) },
    { range: "'ตั้งค่า'!E17:F66", values: pad(f.holidays, 50, { date: "", name: "" }).map((h) => [h.date, h.name]) },
    { range: "'ตั้งค่า'!J17:J46", values: pad(f.listJ, 30, "").map((x) => [x]) },
    { range: "'ตั้งค่า'!L17:L46", values: pad(f.listL, 30, "").map((x) => [x]) },
    { range: "'ตั้งค่า'!N17:N46", values: pad(f.listN, 30, "").map((x) => [x]) },
    { range: "'ตั้งค่า'!P17:P46", values: pad(f.listP, 30, "").map((x) => [x]) },
    { range: "'ตั้งค่า'!T17:T20", values: pad(f.listT, 4, "").map((x) => [x]) },
  ]);
}

export async function loadSmcManyMonths(s: SmcSettings, months: { y: number; m: number }[]) {
  const out: Record<string, Record<string, string>> = {};
  for (const { y, m } of months) out[ymString(y, m)] = (await loadSmcMonthState(s, y, m)).manual;
  return out;
}
