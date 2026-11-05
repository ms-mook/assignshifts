// อ่าน/เขียนข้อมูลตาราง Key (จุดลงทะเบียน) กับสำเนา Google Sheet ของเว็บ
import "server-only";
import { batchGet, batchUpdate } from "../google";
import { SHEETS, monthTabName, ymString } from "../config";
import { isoFromSerial } from "../sheets-date";
import { readWebState, writeManual, writePersonColors, writeStyles } from "../webtabs";
import { computeKeyMonth, KEY_EDIT_COLS, type KeySettings } from "./engine";
import { keyDupCols } from "./render";
import { KEY_LEAVES_RANGE, KEY_SETTINGS_RANGE, parseKeySettings, str } from "./parse";

const ID = () => SHEETS.key;

export async function loadKey(): Promise<KeySettings> {
  const [g, lg] = await batchGet(ID(), [KEY_SETTINGS_RANGE, KEY_LEAVES_RANGE]);
  return parseKeySettings(g, lg);
}

/** ช่องพิมพ์เอง = ค่าในแท็บเดือน (แถว 10-40) ที่ต่างจากสูตร + แท็บ WEB (ทับอีกชั้น) */
export async function loadKeyMonthState(s: KeySettings, yearBE: number, month: number) {
  const st = await readWebState(ID(), ymString(yearBE, month), monthTabName(yearBE, month), "A10:P40");
  const tabManual: Record<string, string> = {};
  if (st.hasTab) {
    const base = computeKeyMonth(s, {}, yearBE, month);
    base.rows.forEach((row, i) => {
      if (row.date === null) return;
      for (const col of KEY_EDIT_COLS) {
        const v = str((st.tab[i] ?? [])[col.charCodeAt(0) - 65]);
        if (v !== (row.cells[col] ?? "")) tabManual[`${col}:${row.day}`] = v;
      }
    });
  }
  const styles = Object.fromEntries(Object.entries(st.styles).map(([k, v]) => [`k:${k}`, v]));
  return { manual: { ...tabManual, ...st.web }, tabManual, styles, personColors: st.personColors, hasTab: st.hasTab };
}

const KEY = /^k:([B-P]):(\d{1,2})$/;
export const isKeyKey = (k: string) => KEY.test(k) && Number(KEY.exec(k)![2]) >= 1 && Number(KEY.exec(k)![2]) <= 31;

export async function saveKeyManual(yearBE: number, month: number, entries: { key: string; value: string | null }[]) {
  const s = await loadKey();
  const st = await loadKeyMonthState(s, yearBE, month);
  const base = computeKeyMonth(s, {}, yearBE, month);
  await writeManual(
    ID(),
    ymString(yearBE, month),
    entries.map(({ key, value }) => {
      const k = key.slice(2);
      if (value === null && k in st.tabManual) {
        // ค่าที่พิมพ์ทับไว้ในแท็บเดือนเดิม: คืนค่าสูตร = เก็บค่าสูตรทับไว้
        const [col, d] = k.split(":");
        return { key: k, value: base.rows[Number(d) - 1]?.cells[col] ?? "" };
      }
      return { key: k, value };
    }),
  );
}

/** กันชื่อซ้ำในแถว (กฎสีส้มของชีต): คืนข้อความ หรือ null */
export async function validateKeyManual(yearBE: number, month: number, key: string, value: string | null): Promise<string | null> {
  if (value === null || value.trim() === "") return null;
  const s = await loadKey();
  const st = await loadKeyMonthState(s, yearBE, month);
  const k = key.slice(2);
  const [col, d] = k.split(":");
  const res = computeKeyMonth(s, { ...st.manual, [k]: value }, yearBE, month);
  const row = res.rows[Number(d) - 1];
  if (!row || row.date === null) return "วันที่นี้ไม่มีในเดือน";
  if (!keyDupCols(row.cells).has(col)) return null;
  const other = Object.entries(row.cells).find(([c, v]) => c !== col && c !== "P" && c !== "A" && v.toLowerCase() === value.toLowerCase());
  return `"${value}" อยู่ในช่อง ${other?.[0] ?? "อื่น"} ของวันที่ ${row.day} แล้ว (พนักงาน 1 คนอยู่ได้ทีละจุด) กรุณาเอาออกจากช่องนั้นก่อน`;
}

export const saveKeyStyles = (y: number, m: number, keys: string[], patch: { bg?: string | null; fg?: string | null; clear?: boolean }) =>
  writeStyles(ID(), ymString(y, m), keys.map((k) => k.slice(2)), patch);
export const saveKeyPersonColors = (c: Record<string, string>) => writePersonColors(ID(), c);

// ---------- ตั้งค่า (การลาอยู่แท็บ ลา-แลกเวร) ----------
const iso = (n: number | null) => (n === null ? "" : isoFromSerial(n));
export interface KeyForm {
  rotStart: string;
  key4Name: string;
  signerName: string;
  signerTitle: string;
  threshold: number;
  title: string;
  docNo: string;
  head: string;
  rot: { name: string; note: string }[];
  holidays: { date: string; name: string }[];
  dropdown: string[];
  heads: string[];
  leaves: { date: string; who: string; sub: string; note: string }[];
}
export function keyToForm(s: KeySettings): KeyForm {
  return {
    rotStart: iso(s.rotStart),
    key4Name: s.key4Name,
    signerName: s.signerName,
    signerTitle: s.signerTitle,
    threshold: s.threshold,
    title: s.title,
    docNo: s.docNo,
    head: s.head,
    rot: s.rot.map((name, i) => ({ name, note: s.rotNote[i] ?? "" })),
    holidays: s.holidays.map((h) => ({ date: iso(h.date), name: h.name })),
    dropdown: s.dropdown.filter((x) => x !== ""),
    heads: s.heads.filter((x) => x !== ""),
    leaves: s.leaves.filter((l) => l.date !== null || l.who || l.sub || l.note).map((l) => ({ date: iso(l.date), who: l.who, sub: l.sub, note: l.note })),
  };
}
const pad = <T,>(a: T[], n: number, f: T) => [...a, ...Array(Math.max(0, n - a.length)).fill(f)].slice(0, n);

export async function saveKeyForm(f: KeyForm, part: "settings" | "leaves") {
  // การลาย้ายไปแท็บ ลา-แลกเวร แล้ว (บันทึกผ่าน /api/leaves/key)
  if (part === "leaves") throw new Error("การลาบันทึกที่หน้า ลา-แลกเวร (แท็บ ลา-แลกเวร) แล้ว");
  if (f.holidays.length > 46) throw new Error("วันหยุดได้สูงสุด 46 รายการ (ตั้งค่า E13:F58)");
  if (f.dropdown.length > 46) throw new Error("รายชื่อ dropdown ได้สูงสุด 46 ชื่อ (ตั้งค่า J13:J58)");
  if (f.heads.length > 8) throw new Error("หัวหน้าเวรได้สูงสุด 8 ชื่อ (ตั้งค่า R13:R20)");
  await batchUpdate(ID(), [
    { range: "'ตั้งค่า'!B3:B10", values: [[f.rotStart], [f.key4Name], [f.signerName], [f.signerTitle], [f.threshold], [f.title], [f.docNo], [f.head]] },
    { range: "'ตั้งค่า'!B13:C16", values: pad(f.rot, 4, { name: "", note: "" }).map((r) => [r.name, r.note]) },
    { range: "'ตั้งค่า'!E13:F58", values: pad(f.holidays, 46, { date: "", name: "" }).map((h) => [h.date, h.name]) },
    { range: "'ตั้งค่า'!J13:J58", values: pad(f.dropdown, 46, "").map((x) => [x]) },
    { range: "'ตั้งค่า'!R13:R20", values: pad(f.heads, 8, "").map((x) => [x]) },
  ]);
}

/** หลายเดือน (หน้าสรุปรายปี) */
export async function loadKeyManyMonths(s: KeySettings, months: { y: number; m: number }[]) {
  const out: Record<string, Record<string, string>> = {};
  for (const { y, m } of months) out[ymString(y, m)] = (await loadKeyMonthState(s, y, m)).manual;
  return out;
}
