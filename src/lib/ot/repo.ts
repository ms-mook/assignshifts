// อ่าน/เขียนข้อมูลตาราง OT (จุดรับ-นำส่งสิ่งส่งตรวจ) กับสำเนา Google Sheet ของเว็บ
import "server-only";
import { addSheet, batchGet, batchUpdate, sheetTitles } from "../google";
import { SHEETS, monthTabName, ymString } from "../config";
import { isoFromSerial, toSerial } from "../sheets-date";
import { computeOtMonth, OT_EDIT_COLS, type OtLeave, type OtSettings } from "./engine";
import { OT_LEAVES_RANGE, OT_SETTINGS_RANGE, OT_SUMMARY_RANGE, parseOtLeaves, parseOtSettings, str } from "./parse";
import { otConflictMessage } from "./conflicts";
import type { OtCellStyle } from "./render";

const ID = () => SHEETS.ot;
export const OT_WEB_MANUAL = "WEB-ช่องเลือกเอง";
export const OT_WEB_STYLE = "WEB-รูปแบบเซลล์";
export const OT_WEB_COLOR = "WEB-สีพนักงาน";

export interface OtData {
  settings: OtSettings;
  leaves: (OtLeave & { row: number })[];
  summaryFrom: number | null;
  summaryTo: number | null;
}

export async function loadOt(): Promise<OtData> {
  const [sg, lg, sm] = await batchGet(ID(), [OT_SETTINGS_RANGE, OT_LEAVES_RANGE, OT_SUMMARY_RANGE]);
  return {
    settings: parseOtSettings(sg),
    leaves: parseOtLeaves(lg),
    summaryFrom: toSerial((sm[0] ?? [])[0]),
    summaryTo: toSerial((sm[1] ?? [])[0]),
  };
}

export interface OtMonthState {
  manual: Record<string, string>; // "COL:day"
  /** เฉพาะค่าที่พิมพ์ทับไว้ในแท็บเดือนของชีต */
  tabManual: Record<string, string>;
  styles: Record<string, OtCellStyle>; // "o:COL:day"
  personColors: Record<string, string>;
  hasTab: boolean;
}

/** ช่องที่พิมพ์เอง = ค่าในแท็บเดือนที่ต่างจากสูตร (ถ้ามีแท็บ) + แท็บ WEB-ช่องเลือกเอง (ทับอีกชั้น) */
export async function loadOtMonthState(data: OtData, yearBE: number, month: number): Promise<OtMonthState> {
  const titles = await sheetTitles(ID());
  const tab = monthTabName(yearBE, month);
  const ranges: string[] = [];
  const at: Record<string, number> = {};
  const add = (n: string, r: string) => ((at[n] = ranges.length), ranges.push(r));
  if (titles.includes(OT_WEB_MANUAL)) add("web", `'${OT_WEB_MANUAL}'!A2:B5000`);
  if (titles.includes(OT_WEB_STYLE)) add("style", `'${OT_WEB_STYLE}'!A2:C5000`);
  if (titles.includes(OT_WEB_COLOR)) add("color", `'${OT_WEB_COLOR}'!A2:B500`);
  const hasTab = titles.includes(tab);
  if (hasTab) add("tab", `'${tab}'!A8:O38`);
  const g = ranges.length ? await batchGet(ID(), ranges, "FORMATTED_VALUE") : [];
  const grid = (n: string) => (n in at ? g[at[n]] : []);
  const prefix = `${ymString(yearBE, month)}|`;

  const manual: Record<string, string> = {};
  if (hasTab) {
    const base = computeOtMonth(data.settings, data.leaves, {}, yearBE, month);
    const sheet = grid("tab");
    base.rows.forEach((row, i) => {
      if (row.date === null) return;
      const sr = sheet[i] ?? [];
      OT_EDIT_COLS.forEach((col) => {
        const ci = col.charCodeAt(0) - 65;
        const v = str(sr[ci]);
        if (v !== (row.cells[col] ?? "")) manual[`${col}:${row.day}`] = v;
      });
    });
  }
  const tabManual = { ...manual };
  for (const r of grid("web")) {
    const k = str(r[0]);
    if (k.startsWith(prefix)) manual[k.slice(prefix.length)] = str(r[1]);
  }
  const styles: Record<string, OtCellStyle> = {};
  for (const r of grid("style")) {
    const k = str(r[0]);
    if (!k.startsWith(prefix)) continue;
    const st: OtCellStyle = {};
    if (str(r[1])) st.bg = str(r[1]);
    if (str(r[2])) st.fg = str(r[2]);
    styles[`o:${k.slice(prefix.length)}`] = st;
  }
  const personColors: Record<string, string> = {};
  for (const r of grid("color")) if (str(r[0]) && str(r[1])) personColors[str(r[0])] = str(r[1]);
  return { manual, tabManual, styles, personColors, hasTab };
}

async function ensureTab(titles: string[], title: string, header: string[]) {
  if (titles.includes(title)) return;
  await addSheet(ID(), title);
  await batchUpdate(ID(), [{ range: `'${title}'!A1:${String.fromCharCode(64 + header.length)}1`, values: [header] }]);
}

const KEY = /^o:([B-O]):(\d{1,2})$/;
export const isOtKey = (k: string) => KEY.test(k) && Number(KEY.exec(k)![2]) >= 1 && Number(KEY.exec(k)![2]) <= 31;
const short = (k: string) => k.slice(2); // "o:C:5" -> "C:5"

/**
 * value = null: คืนค่าตามสูตร — ถ้าแท็บเดือนมีค่าที่พิมพ์ทับไว้ เก็บ "ค่าสูตร" ลง WEB เพื่อให้กลับเป็นค่าสูตรจริง
 * ค่าอื่น: เก็บในแท็บ WEB-ช่องเลือกเอง (ไม่แตะแท็บเดือนเดิม)
 */
export async function saveOtManual(yearBE: number, month: number, entries: { key: string; value: string | null }[]) {
  const titles = await sheetTitles(ID());
  await ensureTab(titles, OT_WEB_MANUAL, ["key (ปี-เดือน|คอลัมน์:วัน)", "ค่า"]);
  const data = await loadOt();
  const st = await loadOtMonthState(data, yearBE, month);
  const base = computeOtMonth(data.settings, data.leaves, {}, yearBE, month);
  const [g] = await batchGet(ID(), [`'${OT_WEB_MANUAL}'!A2:B5000`], "FORMATTED_VALUE");
  const map = new Map<string, string>();
  for (const r of g) if (str(r[0])) map.set(str(r[0]), str(r[1]));
  const ym = ymString(yearBE, month);
  for (const { key, value } of entries) {
    const k = short(key);
    const full = `${ym}|${k}`;
    if (value !== null) {
      map.set(full, value);
      continue;
    }
    map.delete(full);
    // ค่าที่พิมพ์ทับในแท็บเดือนเดิม: บังคับกลับเป็นค่าสูตร
    if (k in st.tabManual) {
      const [col, d] = k.split(":");
      map.set(full, base.rows[Number(d) - 1]?.cells[col] ?? "");
    }
  }
  const rows = [...map.entries()].map(([k, v]) => [k, v]);
  if (rows.length > 4999) throw new Error("เก็บช่องที่แก้เองได้สูงสุด 4,999 ช่อง");
  while (rows.length < g.length) rows.push(["", ""]);
  if (rows.length) await batchUpdate(ID(), [{ range: `'${OT_WEB_MANUAL}'!A2:B${rows.length + 1}`, values: rows }]);
}

export async function validateOtManual(yearBE: number, month: number, key: string, value: string | null): Promise<string | null> {
  if (value === null || value.trim() === "") return null;
  const data = await loadOt();
  const st = await loadOtMonthState(data, yearBE, month);
  const [col, d] = short(key).split(":");
  const res = computeOtMonth(data.settings, data.leaves, { ...st.manual, [short(key)]: value }, yearBE, month);
  const row = res.rows[Number(d) - 1];
  if (!row || row.date === null) return "วันที่นี้ไม่มีในเดือน";
  return otConflictMessage(row.cells, col, value, row.day);
}

export async function saveOtStyles(
  yearBE: number,
  month: number,
  keys: string[],
  patch: { bg?: string | null; fg?: string | null; clear?: boolean },
) {
  const titles = await sheetTitles(ID());
  await ensureTab(titles, OT_WEB_STYLE, ["key (ปี-เดือน|คอลัมน์:วัน)", "สีพื้น", "สีตัวอักษร"]);
  const [g] = await batchGet(ID(), [`'${OT_WEB_STYLE}'!A2:C5000`], "FORMATTED_VALUE");
  const map = new Map<string, { bg: string; fg: string }>();
  for (const r of g) if (str(r[0])) map.set(str(r[0]), { bg: str(r[1]), fg: str(r[2]) });
  const ym = ymString(yearBE, month);
  for (const key of keys) {
    const full = `${ym}|${short(key)}`;
    if (patch.clear) {
      map.delete(full);
      continue;
    }
    const cur = map.get(full) ?? { bg: "", fg: "" };
    if (patch.bg !== undefined) cur.bg = patch.bg ?? "";
    if (patch.fg !== undefined) cur.fg = patch.fg ?? "";
    if (!cur.bg && !cur.fg) map.delete(full);
    else map.set(full, cur);
  }
  const rows = [...map.entries()].map(([k, v]) => [k, v.bg, v.fg]);
  while (rows.length < g.length) rows.push(["", "", ""]);
  if (rows.length) await batchUpdate(ID(), [{ range: `'${OT_WEB_STYLE}'!A2:C${rows.length + 1}`, values: rows }]);
}

export async function saveOtPersonColors(colors: Record<string, string>) {
  const titles = await sheetTitles(ID());
  await ensureTab(titles, OT_WEB_COLOR, ["ชื่อพนักงาน", "สีตัวอักษร"]);
  const [g] = await batchGet(ID(), [`'${OT_WEB_COLOR}'!A2:B500`], "FORMATTED_VALUE");
  const rows = Object.entries(colors).map(([n, c]) => [n, c]);
  if (rows.length > 499) throw new Error("เก็บสีได้สูงสุด 499 ชื่อ");
  while (rows.length < g.length) rows.push(["", ""]);
  if (rows.length) await batchUpdate(ID(), [{ range: `'${OT_WEB_COLOR}'!A2:B${rows.length + 1}`, values: rows }]);
}

// ---------- ตั้งค่า ----------
const iso = (n: number | null) => (n === null ? "" : isoFromSerial(n));

export interface OtSettingsForm {
  pattern: number;
  startMonday: string;
  eightStart: string;
  smcOpen: string;
  signerName: string;
  signerTitle: string;
  staff: { name: string; start: string; last: string; rep: string; repStart: string }[];
  spotNames: string[];
  holidays: { date: string; name: string }[];
  dropdown: string[];
}

export function otToForm(d: OtData): OtSettingsForm {
  const s = d.settings;
  return {
    pattern: s.pattern,
    startMonday: iso(s.startMonday),
    eightStart: iso(s.eightStart),
    smcOpen: iso(s.smcOpen),
    signerName: s.signerName,
    signerTitle: s.signerTitle,
    staff: s.staff.map((p) => ({ name: p.name, start: iso(p.start), last: iso(p.last), rep: p.rep, repStart: iso(p.repStart) })),
    spotNames: s.spots.map((p) => p.name),
    holidays: s.holidays.map((h) => ({ date: iso(h.date), name: h.name })),
    dropdown: s.dropdown,
  };
}

const pad = <T,>(a: T[], n: number, f: T) => [...a, ...Array(Math.max(0, n - a.length)).fill(f)].slice(0, n);

export async function saveOtSettings(f: OtSettingsForm) {
  if (f.holidays.length > 46) throw new Error("วันหยุดได้สูงสุด 46 รายการ (ตั้งค่า J10:K55)");
  if (f.dropdown.length > 46) throw new Error("รายชื่อ dropdown ได้สูงสุด 46 ชื่อ (ตั้งค่า O10:O55)");
  const p = Math.round(Number(f.pattern));
  if (!(p >= 1 && p <= 7)) throw new Error("รูปแบบการเวียนต้องเป็น 1-7");
  await batchUpdate(ID(), [
    { range: "'ตั้งค่า'!B3:B6", values: [[p], [f.startMonday], [f.eightStart], [f.smcOpen]] },
    { range: "'ตั้งค่า'!G4:G5", values: [[f.signerName], [f.signerTitle]] },
    { range: "'ตั้งค่า'!B10:F17", values: pad(f.staff, 8, { name: "", start: "", last: "", rep: "", repStart: "" }).map((x) => [x.name, x.start, x.last, x.rep, x.repStart]) },
    { range: "'ตั้งค่า'!A21:A28", values: pad(f.spotNames, 8, "").map((x) => [x]) },
    { range: "'ตั้งค่า'!J10:K55", values: pad(f.holidays, 46, { date: "", name: "" }).map((h) => [h.date, h.name]) },
    { range: "'ตั้งค่า'!O10:O55", values: pad(f.dropdown, 46, "").map((x) => [x]) },
  ]);
}

/** เมนู Apps Script: สลับเวียน → รูปแบบถัดไป / ← รูปแบบก่อนหน้า */
export async function stepOtPattern(dir: 1 | -1): Promise<number> {
  const [g] = await batchGet(ID(), ["'ตั้งค่า'!B3"]);
  const cur = Number((g[0] ?? [])[0]) || 1;
  const next = dir === 1 ? (cur % 7) + 1 : cur - 1 < 1 ? 7 : cur - 1;
  await batchUpdate(ID(), [{ range: "'ตั้งค่า'!B3", values: [[next]] }]);
  return next;
}

// ---------- ลา-แลกเวร ----------
export interface OtLeaveForm { date: string; who: string; sub: string; type: string }

export async function saveOtLeaves(rows: OtLeaveForm[]) {
  if (rows.length > 296) throw new Error("บันทึกได้สูงสุด 296 แถว (ลา-แลกเวร A5:D300)");
  await batchUpdate(ID(), [{ range: "'ลา-แลกเวร'!A5:D300", values: pad(rows, 296, { date: "", who: "", sub: "", type: "" }).map((r) => [r.date, r.who, r.sub, r.type]) }]);
}

export async function saveOtSummaryRange(from: string, to: string) {
  await batchUpdate(ID(), [{ range: "'สรุป'!B2:B3", values: [[from], [to]] }]);
}

/** ช่องพิมพ์เองของหลายเดือนพร้อมกัน (ใช้กับหน้าสรุป: นับ "เลือกเอง" คอลัมน์ B, D, J) */
export async function loadOtManyMonths(data: OtData, months: { y: number; m: number }[]): Promise<Record<string, Record<string, string>>> {
  const titles = await sheetTitles(ID());
  const ranges: string[] = [];
  const idx: Record<string, number> = {};
  if (titles.includes(OT_WEB_MANUAL)) ((idx.web = ranges.length), ranges.push(`'${OT_WEB_MANUAL}'!A2:B5000`));
  for (const { y, m } of months) {
    const tab = monthTabName(y, m);
    if (titles.includes(tab)) ((idx[ymString(y, m)] = ranges.length), ranges.push(`'${tab}'!A8:O38`));
  }
  const g = ranges.length ? await batchGet(ID(), ranges, "FORMATTED_VALUE") : [];
  const out: Record<string, Record<string, string>> = {};
  for (const { y, m } of months) {
    const ym = ymString(y, m);
    const manual: Record<string, string> = {};
    if (ym in idx) {
      const base = computeOtMonth(data.settings, data.leaves, {}, y, m);
      const sheet = g[idx[ym]];
      base.rows.forEach((row, i) => {
        if (row.date === null) return;
        OT_EDIT_COLS.forEach((col) => {
          const v = str((sheet[i] ?? [])[col.charCodeAt(0) - 65]);
          if (v !== (row.cells[col] ?? "")) manual[`${col}:${row.day}`] = v;
        });
      });
    }
    if ("web" in idx) for (const r of g[idx.web]) if (str(r[0]).startsWith(`${ym}|`)) manual[str(r[0]).slice(ym.length + 1)] = str(r[1]);
    out[ym] = manual;
  }
  return out;
}
