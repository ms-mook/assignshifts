// อ่าน/เขียนข้อมูลตาราง 3 ช่วงเวลา กับ Google Sheet
import "server-only";
import { addSheet, batchGet, batchUpdate, sheetTitles } from "../google";
import { SHEETS, monthTabName, ymString } from "../config";
import { isoFromSerial, serialFromYMD, toSerial } from "../sheets-date";
import { PlanCalculator, colIndex, colLetter, computeMonth, editableCols, manualKey, SECTION_MAP } from "./engine";
import {
  LEAVES_RANGE,
  MTRN_RANGE,
  SETTINGS_RANGE,
  dropdownNames,
  parseLeaves,
  parseMtrn,
  type Mtrn,
  parseSettings,
  str,
} from "./parse";
import { conflictMessage } from "./conflicts";
import { readApprovedLeaves } from "../leave-system";
import type { CellStyle } from "./render";
import type { LeaveRow, ManualCells, SectionNo, Shift3Settings } from "./types";

const ID = () => SHEETS.shift3;
export const WEB_MANUAL_TAB = "WEB-ช่องเลือกเอง";
const SECTION_FIRST_ROW: Record<SectionNo, number> = { 1: 8, 2: 49, 3: 90 };

export interface Shift3Data {
  settings: Shift3Settings;
  leaves: LeaveRow[];
  mtrn: Mtrn[];
}

export async function loadShift3(): Promise<Shift3Data> {
  const [sg, lg, mg] = await batchGet(ID(), [SETTINGS_RANGE, LEAVES_RANGE, MTRN_RANGE]);
  return { settings: parseSettings(sg), leaves: parseLeaves(lg), mtrn: parseMtrn(mg) };
}

// ---------- ช่องที่ผู้จัดเลือกเอง / รูปแบบช่อง / สีพนักงาน ----------

export const WEB_STYLE_TAB = "WEB-รูปแบบเซลล์";
export const WEB_COLOR_TAB = "WEB-สีพนักงาน";

export interface MonthState {
  manual: ManualCells;
  source: "month-tab" | "web-tab";
  styles: Record<string, CellStyle>;
  personColors: Record<string, string>;
}

/**
 * อ่านสถานะของเดือนที่ผู้จัดตั้งเอง:
 * - ช่อง จนท./เวชกรรมสังคม/SHE: ถ้ามีแท็บเดือนในชีต (เช่น ม.ค.70) อ่านจากแท็บนั้น (ค่าที่ต่างจากสูตรตั้งต้น = เลือกเอง)
 * - ช่องอื่นที่พิมพ์ทับ: แท็บ WEB-ช่องเลือกเอง (ไม่แตะสูตรในแท็บเดือน)
 * - สีพื้น/สีตัวอักษรรายช่อง: แท็บ WEB-รูปแบบเซลล์ · สีตามชื่อพนักงาน: แท็บ WEB-สีพนักงาน
 */
export async function loadMonthState(data: Shift3Data, yearBE: number, month: number): Promise<MonthState> {
  const titles = await sheetTitles(ID());
  const tab = monthTabName(yearBE, month);
  const ranges: string[] = [];
  const at: Record<string, number> = {};
  const add = (name: string, r: string) => {
    at[name] = ranges.length;
    ranges.push(r);
  };
  if (titles.includes(WEB_MANUAL_TAB)) add("web", `'${WEB_MANUAL_TAB}'!A2:B5000`);
  if (titles.includes(WEB_STYLE_TAB)) add("style", `'${WEB_STYLE_TAB}'!A2:C5000`);
  if (titles.includes(WEB_COLOR_TAB)) add("color", `'${WEB_COLOR_TAB}'!A2:B500`);
  const hasMonthTab = titles.includes(tab);
  if (hasMonthTab) for (const sec of [1, 2, 3] as SectionNo[]) add(`m${sec}`, `'${tab}'!A${SECTION_FIRST_ROW[sec]}:AK${SECTION_FIRST_ROW[sec] + 30}`);
  const g = ranges.length > 0 ? await batchGet(ID(), ranges, "FORMATTED_VALUE") : [];
  const grid = (name: string) => (name in at ? g[at[name]] : []);

  const prefix = `${ymString(yearBE, month)}|`;
  const web: ManualCells = {};
  for (const r of grid("web")) {
    const k = str(r[0]);
    if (k.startsWith(prefix)) web[k.slice(prefix.length)] = str(r[1]);
  }
  const styles: Record<string, CellStyle> = {};
  for (const r of grid("style")) {
    const k = str(r[0]);
    if (!k.startsWith(prefix)) continue;
    const st: CellStyle = {};
    if (str(r[1]) !== "") st.bg = str(r[1]);
    if (str(r[2]) !== "") st.fg = str(r[2]);
    styles[k.slice(prefix.length)] = st;
  }
  const personColors: Record<string, string> = {};
  for (const r of grid("color")) if (str(r[0]) !== "" && str(r[1]) !== "") personColors[str(r[0])] = str(r[1]);

  if (!hasMonthTab) return { manual: web, source: "web-tab", styles, personColors };
  const base = computeMonth(data.settings, data.leaves, {}, yearBE, month);
  const manual: ManualCells = {};
  base.sections.forEach((sec, si) => {
    const sheet = grid(`m${sec.section}`);
    sec.rows.forEach((row, ri) => {
      const sheetRow = sheet[ri] ?? [];
      for (const ci of editableCols(sec.section)) {
        const v = str(sheetRow[ci]);
        if (v !== row.cells[ci]) manual[manualKey(sec.section, ci, row.day)] = v;
      }
    });
  });
  return { manual: { ...manual, ...web }, source: "month-tab", styles, personColors };
}

async function ensureTab(titles: string[], title: string, header: string[]): Promise<void> {
  if (titles.includes(title)) return;
  await addSheet(ID(), title);
  await batchUpdate(ID(), [{ range: `'${title}'!A1:${String.fromCharCode(64 + header.length)}1`, values: [header] }]);
}

/** บันทึกช่องเลือกเอง; value = null หมายถึงคืนค่าสูตรตั้งต้น */
export async function saveManual(yearBE: number, month: number, key: string, value: string | null): Promise<void> {
  await saveManualMany(yearBE, month, [{ key, value }]);
}

/** บันทึกหลายช่องพร้อมกัน (เรียก Google Sheets ให้น้อยที่สุด) */
export async function saveManualMany(
  yearBE: number,
  month: number,
  entries: { key: string; value: string | null }[],
): Promise<void> {
  const titles = await sheetTitles(ID());
  const tab = monthTabName(yearBE, month);
  const tabWrites: { range: string; values: unknown[][] }[] = [];
  const webEntries: { key: string; value: string | null }[] = [];
  for (const { key, value } of entries) {
    const [secStr, col, dayStr] = key.split(":");
    const sec = Number(secStr) as SectionNo;
    const day = Number(dayStr);
    const ci = colIndex(col);
    const src = SECTION_MAP[sec]?.[ci];
    if (!src || ci === 0 || !(day >= 1 && day <= 31)) throw new Error("ช่องนี้แก้ไม่ได้");
    // ช่องจนท./เวชกรรมสังคม/SHE เขียนลงแท็บเดือนตามเดิม; ช่องอื่นเก็บในแท็บ WEB-ช่องเลือกเอง
    if ((src.kind === "manual" || src.kind === "free") && titles.includes(tab)) {
      const r = SECTION_FIRST_ROW[sec] + day - 1;
      const flag = sec === 3 ? `$AP${r}` : `$AM${r}`;
      const restore = src.kind === "manual" ? `=IF(${flag}=1,"จนท.","")` : "";
      tabWrites.push({ range: `'${tab}'!${col}${r}`, values: [[value === null ? restore : value]] });
    } else webEntries.push({ key, value });
  }
  if (tabWrites.length > 0) await batchUpdate(ID(), tabWrites);
  if (webEntries.length === 0) return;
  await ensureTab(titles, WEB_MANUAL_TAB, ["key (ปี-เดือน|ส่วน:คอลัมน์:วัน)", "ค่า"]);
  const [g] = await batchGet(ID(), [`'${WEB_MANUAL_TAB}'!A2:B5000`], "FORMATTED_VALUE");
  const map = new Map<string, string>();
  for (const r of g) if (str(r[0]) !== "") map.set(str(r[0]), str(r[1]));
  for (const { key, value } of webEntries) {
    const full = `${ymString(yearBE, month)}|${key}`;
    if (value === null) map.delete(full);
    else map.set(full, value);
  }
  const rows = [...map.entries()].map(([k, v]) => [k, v]);
  if (rows.length > 4999) throw new Error("เก็บช่องที่แก้เองได้สูงสุด 4,999 ช่อง");
  while (rows.length < g.length) rows.push(["", ""]);
  if (rows.length === 0) return;
  await batchUpdate(ID(), [{ range: `'${WEB_MANUAL_TAB}'!A2:B${rows.length + 1}`, values: rows }]);
}

/**
 * ตรวจหลายช่องพร้อมกัน (เช่น ใส่ชื่อเดียวกันลงตาราง 3 ช่วงเวลา): คำนวณเดือนครั้งเดียวโดยใส่ทุกช่องแล้ว
 * คืนรายการช่องที่ชื่อซ้ำกับจุดอื่นในแถว (ช่วงเวลา) เดียวกัน
 */
export async function validateManualEntries(
  yearBE: number,
  month: number,
  entries: { key: string; value: string | null }[],
): Promise<{ key: string; error: string }[]> {
  const named = entries.filter((e) => e.value !== null && e.value.trim() !== "");
  if (named.length === 0) return [];
  const data = await loadShift3();
  const st = await loadMonthState(data, yearBE, month);
  const over: ManualCells = { ...st.manual };
  for (const e of entries) if (e.value === null) delete over[e.key];
  else over[e.key] = e.value;
  const res = computeMonth(data.settings, data.leaves, over, yearBE, month);
  const out: { key: string; error: string }[] = [];
  for (const e of named) {
    const [secStr, col, dayStr] = e.key.split(":");
    const row = res.sections[Number(secStr) - 1]?.rows[Number(dayStr) - 1];
    if (!row || row.date === null) {
      out.push({ key: e.key, error: "วันที่นี้ไม่มีในเดือน" });
      continue;
    }
    const m = conflictMessage(row.cells, colIndex(col), e.value as string, Number(dayStr));
    if (m) out.push({ key: e.key, error: m });
  }
  return out;
}

/** ตรวจก่อนบันทึก: ชื่อที่ใส่ซ้ำกับช่องอื่นในแถวเดียวกันหรือไม่ (คืนข้อความ error หรือ null) */
export async function validateManual(yearBE: number, month: number, key: string, value: string | null): Promise<string | null> {
  if (value === null || value.trim() === "") return null;
  const [secStr, col, dayStr] = key.split(":");
  const sec = Number(secStr) as SectionNo;
  const day = Number(dayStr);
  if (![1, 2, 3].includes(sec) || !(day >= 1 && day <= 31)) return "ช่องนี้แก้ไม่ได้";
  const data = await loadShift3();
  const st = await loadMonthState(data, yearBE, month);
  const res = computeMonth(data.settings, data.leaves, { ...st.manual, [key]: value }, yearBE, month);
  const row = res.sections[sec - 1].rows[day - 1];
  if (!row || row.date === null) return "วันที่นี้ไม่มีในเดือน";
  return conflictMessage(row.cells, colIndex(col), value, day);
}

/** รูปแบบรายช่อง: patch.bg/fg = ตั้งสี, null = ลบสีนั้น, undefined = ไม่แตะ; clear = ล้างรูปแบบทั้งหมดของช่อง */
export async function saveStyles(
  yearBE: number,
  month: number,
  keys: string[],
  patch: { bg?: string | null; fg?: string | null; clear?: boolean },
): Promise<void> {
  const titles = await sheetTitles(ID());
  await ensureTab(titles, WEB_STYLE_TAB, ["key (ปี-เดือน|ส่วน:คอลัมน์:วัน)", "สีพื้น", "สีตัวอักษร"]);
  const [g] = await batchGet(ID(), [`'${WEB_STYLE_TAB}'!A2:C5000`], "FORMATTED_VALUE");
  const map = new Map<string, { bg: string; fg: string }>();
  for (const r of g) if (str(r[0]) !== "") map.set(str(r[0]), { bg: str(r[1]), fg: str(r[2]) });
  const prefix = ymString(yearBE, month);
  for (const k of keys) {
    const full = `${prefix}|${k}`;
    if (patch.clear) {
      map.delete(full);
      continue;
    }
    const cur = map.get(full) ?? { bg: "", fg: "" };
    if (patch.bg !== undefined) cur.bg = patch.bg ?? "";
    if (patch.fg !== undefined) cur.fg = patch.fg ?? "";
    if (cur.bg === "" && cur.fg === "") map.delete(full);
    else map.set(full, cur);
  }
  const rows = [...map.entries()].map(([k, v]) => [k, v.bg, v.fg]);
  while (rows.length < g.length) rows.push(["", "", ""]);
  if (rows.length === 0) return;
  await batchUpdate(ID(), [{ range: `'${WEB_STYLE_TAB}'!A2:C${rows.length + 1}`, values: rows }]);
}

/** สีตัวอักษรตามชื่อพนักงาน (ทุกเดือน) */
export async function loadPersonColors(): Promise<Record<string, string>> {
  const titles = await sheetTitles(ID());
  if (!titles.includes(WEB_COLOR_TAB)) return {};
  const [g] = await batchGet(ID(), [`'${WEB_COLOR_TAB}'!A2:B500`], "FORMATTED_VALUE");
  const out: Record<string, string> = {};
  for (const r of g) if (str(r[0]) !== "" && str(r[1]) !== "") out[str(r[0])] = str(r[1]);
  return out;
}

export async function savePersonColors(colors: Record<string, string>): Promise<void> {
  const titles = await sheetTitles(ID());
  await ensureTab(titles, WEB_COLOR_TAB, ["ชื่อพนักงาน", "สีตัวอักษร"]);
  const [g] = await batchGet(ID(), [`'${WEB_COLOR_TAB}'!A2:B500`], "FORMATTED_VALUE");
  const rows = Object.entries(colors).map(([n, c]) => [n, c]);
  if (rows.length > 499) throw new Error("เก็บสีได้สูงสุด 499 ชื่อ");
  while (rows.length < g.length) rows.push(["", ""]);
  if (rows.length === 0) return;
  await batchUpdate(ID(), [{ range: `'${WEB_COLOR_TAB}'!A2:B${rows.length + 1}`, values: rows }]);
}

// ---------- หน้าตั้งค่ารวม ----------

export interface Shift3SettingsForm {
  startMonday: string;
  rotationPattern: number;
  newHireStart: string;
  newHireMonths: number;
  trainingWeeks: number;
  persons: { no: string; name: string; start: string; lastDay: string; replacement: string; replacementStart: string }[];
  pairOddKw8: string;
  pairOddOpd11: string;
  poctKw: string;
  poctOpd: string;
  poctAlt1: string;
  poctAlt2: string;
  b30AtKey1: string;
  fillFrom: [string, string, string];
  holidays: { date: string; name: string }[];
  signerName: string;
  signerTitle: string;
  mtrn: Mtrn[];
}

const iso = (n: number | null) => (n === null ? "" : isoFromSerial(n));

export function toForm(d: Shift3Data): Shift3SettingsForm {
  const s = d.settings;
  return {
    startMonday: iso(s.startMonday),
    rotationPattern: s.rotationPattern,
    newHireStart: iso(s.newHireStart),
    newHireMonths: s.newHireMonths,
    trainingWeeks: s.trainingWeeks,
    persons: s.persons.map((p) => ({
      no: p.no,
      name: p.name,
      start: iso(p.start),
      lastDay: iso(p.lastDay),
      replacement: p.replacement,
      replacementStart: iso(p.replacementStart),
    })),
    pairOddKw8: s.pairOddKw8,
    pairOddOpd11: s.pairOddOpd11,
    poctKw: s.poctKw,
    poctOpd: s.poctOpd,
    poctAlt1: s.poctAlt1,
    poctAlt2: s.poctAlt2,
    b30AtKey1: s.b30AtKey1,
    fillFrom: s.fillFrom,
    holidays: s.holidays.map((h) => ({ date: iso(h.date), name: h.name })),
    signerName: s.signerName,
    signerTitle: s.signerTitle,
    mtrn: d.mtrn,
  };
}

/** ข้อมูลประกอบหน้าตั้งค่า (ค่าที่ชีตคำนวณเอง / ห้ามแก้) */
export function settingsInfo(d: Shift3Data) {
  const plan = new PlanCalculator(d.settings);
  return {
    B7: plan.B7,
    B9: plan.B9,
    spotFullNames: plan.spotFullNames,
    spots: d.settings.spots,
    training: d.settings.training,
    names: dropdownNames(d.settings, d.mtrn),
  };
}

function checkDate(v: string, label: string): string {
  if (v === "") return "";
  if (toSerial(v) === null) throw new Error(`${label}: วันที่ไม่ถูกต้อง (${v})`);
  return v;
}

/** เขียนเฉพาะช่องที่เป็นค่ากรอก (ช่องสีเหลือง) — ไม่แตะช่องสูตร เช่น B7, B9, C26, G:H, W:X */
export async function saveSettings(f: Shift3SettingsForm): Promise<void> {
  if (f.persons.length !== 14) throw new Error("ต้องมีรายชื่อ 14 แถว");
  if (f.holidays.length > 40) throw new Error("วันหยุดได้สูงสุด 40 รายการ (H46:H85)");
  if (f.mtrn.length > 198) throw new Error("รายชื่อ MT-RN ได้สูงสุด 198 คน");
  if (toSerial(f.startMonday) === null) throw new Error("วันเริ่มตารางต้องเป็นวันที่");
  const T = "'ตั้งค่า'";
  const data: { range: string; values: unknown[][] }[] = [
    { range: `${T}!B3:B6`, values: [[checkDate(f.startMonday, "B3")], [f.rotationPattern], [checkDate(f.newHireStart, "B5")], [f.newHireMonths]] },
    { range: `${T}!B8`, values: [[f.trainingWeeks]] },
    { range: `${T}!B13:B26`, values: f.persons.map((p) => [p.name]) },
    // C26 เป็นสูตร =$B$5 จึงเขียนแค่ C13:C25
    { range: `${T}!C13:C25`, values: f.persons.slice(0, 13).map((p, i) => [checkDate(p.start, `C${13 + i}`)]) },
    {
      range: `${T}!D13:F26`,
      values: f.persons.map((p, i) => [
        checkDate(p.lastDay, `D${13 + i}`),
        p.replacement,
        checkDate(p.replacementStart, `F${13 + i}`),
      ]),
    },
    { range: `${T}!B29:B30`, values: [[f.pairOddKw8], [f.pairOddOpd11]] },
    { range: `${T}!B33:B37`, values: [[f.poctKw], [f.poctOpd], [f.poctAlt1], [f.poctAlt2], [f.b30AtKey1]] },
    { range: `${T}!B40:B42`, values: f.fillFrom.map((v) => [v]) },
    {
      range: `${T}!H46:I85`,
      values: Array.from({ length: 40 }, (_, i) => {
        const h = f.holidays[i];
        return h ? [checkDate(h.date, `H${46 + i}`), h.name] : ["", ""];
      }),
    },
    { range: `${T}!B89:B90`, values: [[f.signerName], [f.signerTitle]] },
    {
      range: `'รายชื่อ MT-RN'!A3:A200`,
      values: Array.from({ length: 198 }, (_, i) => [f.mtrn[i]?.name ?? ""]),
    },
    {
      range: `'รายชื่อ MT-RN'!C3:C200`,
      values: Array.from({ length: 198 }, (_, i) => [f.mtrn[i]?.note ?? ""]),
    },
    { range: `'รายชื่อ MT-RN'!D2`, values: [["ประเภท (MT/RN)"]] },
    {
      range: `'รายชื่อ MT-RN'!D3:D200`,
      values: Array.from({ length: 198 }, (_, i) => [f.mtrn[i] ? (f.mtrn[i].type === "RN" ? "RN" : "MT") : ""]),
    },
  ];
  await batchUpdate(ID(), data);
}

// ---------- ลา-แลกเวร ----------

export interface LeaveForm {
  date: string;
  name: string;
  replacement: string;
  type: string;
  note: string;
  /** รหัสจากระบบลา (ว่าง = กรอกเอง) */
  ref?: string;
}

export async function saveLeaves(rows: LeaveForm[]): Promise<void> {
  if (rows.length > 396) throw new Error("บันทึกได้สูงสุด 396 แถว (A5:A400)");
  const n = 396;
  const pad = <T,>(arr: T[], empty: T) => Array.from({ length: n }, (_, i) => arr[i] ?? empty);
  const ad = pad(
    rows.map((r, i) => [checkDate(r.date, `A${5 + i}`), r.name, r.replacement, r.type]),
    ["", "", "", ""],
  );
  const g = pad(rows.map((r) => [r.note, r.ref ?? ""]), ["", ""]);
  // E, F เป็นสูตร ไม่เขียนทับ · H = รหัสจากระบบลา
  await batchUpdate(ID(), [
    { range: `'ลา-แลกเวร'!A5:D400`, values: ad },
    { range: `'ลา-แลกเวร'!G5:H400`, values: g },
  ]);
}

export { colLetter };

// ---------- แท็บ สรุป (ความเท่าเทียมของการเวียนจุด) ----------
/** สรุป!B2 (ตั้งแต่สัปดาห์ที่เริ่ม) / B3 (ถึงสัปดาห์ที่เริ่ม) — คืน serial (null ถ้ายังไม่มีแท็บ/ค่า) */
export async function loadShift3SummaryRange(): Promise<{ from: number | null; to: number | null }> {
  const titles = await sheetTitles(ID());
  if (!titles.includes("สรุป")) return { from: null, to: null };
  const [g] = await batchGet(ID(), ["'สรุป'!B2:B3"]);
  return { from: toSerial((g[0] ?? [])[0]), to: toSerial((g[1] ?? [])[0]) };
}
export async function saveShift3SummaryRange(from: string, to: string): Promise<void> {
  const titles = await sheetTitles(ID());
  if (!titles.includes("สรุป")) throw new Error("ชีตไม่มีแท็บ สรุป");
  await batchUpdate(ID(), [{ range: "'สรุป'!B2:B3", values: [[from], [to]] }]);
}

// ---------- ดึงการลาจากระบบลา (Approve แล้ว) มาใส่หน้า ลา-แลกเวร ----------

export interface LeaveSyncResult {
  added: number;
  removed: number;
  at: string;
  error?: string;
  /** ชื่อในระบบลาที่จับคู่กับพนักงานในตารางนี้ไม่ได้ (ไม่ได้ดึงมา) */
  skippedNames: string[];
}
let syncing: Promise<LeaveSyncResult> | null = null;
let lastSync = 0;
let lastResult: LeaveSyncResult | null = null;

/**
 * เทียบรายการลาที่ Approve (ลาป่วย/ลากิจ/ลาพักร้อน/ลาอื่นๆ) กับแถวในแท็บ ลา-แลกเวร
 *  - 1 แถวต่อ 1 คน 1 วันทำการ (ข้ามเสาร์-อาทิตย์และวันหยุดในตั้งค่า) ตั้งแต่วันที่ 1 ของเดือนก่อนเป็นต้นไป
 *  - ใส่ วันที่ / ชื่อ / ประเภท / รหัส (H) · คนแทน และหมายเหตุ เว้นว่างให้ผู้จัดกรอกเอง
 *  - ถ้าการลาถูกยกเลิก/ไม่อนุมัติภายหลัง แถวที่ดึงมาจะถูกนำออก (ข้อมูลที่ผู้จัดกรอกในแถวนั้นหายไปด้วย)
 */
export async function syncLeaveSystem(opt: { force?: boolean } = {}): Promise<LeaveSyncResult> {
  if (!opt.force && lastResult && Date.now() - lastSync < 60_000) return lastResult;
  if (syncing) return syncing;
  syncing = (async () => {
    const at = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16);
    try {
      const data = await loadShift3();
      const s = data.settings;
      const staff = Array.from(new Set([...s.persons.flatMap((p) => [p.name, p.replacement]), s.pairOddKw8, s.pairOddOpd11].map((x) => x.trim()).filter((x) => x !== "")));
      const now = new Date(Date.now() + 7 * 3600 * 1000);
      const windowStart = serialFromYMD(now.getUTCFullYear(), now.getUTCMonth(), 1); // วันที่ 1 ของเดือนก่อน
      const holidays = new Set(s.holidays.map((h) => h.date).filter((d): d is number => d !== null));
      const sys = await readApprovedLeaves();
      const skipped = new Set<string>();
      const want = new Map<string, LeaveForm>();
      for (const l of sys) {
        const name = staff.find((n) => n.toLowerCase() === l.firstName.toLowerCase());
        if (!name) {
          skipped.add(l.fullName);
          continue;
        }
        for (let d = Math.max(l.start, windowStart); d <= l.end && d - l.start < 400; d++) {
          const wd = new Date((d - 25569) * 86400000).getUTCDay();
          if (wd === 0 || wd === 6 || holidays.has(d)) continue;
          const ref = `${l.leaveId}|${isoFromSerial(d)}`;
          want.set(ref, { date: isoFromSerial(d), name, replacement: "", type: l.type, note: "", ref });
        }
      }
      const cur: LeaveForm[] = data.leaves.map((l) => ({
        date: l.date === null ? "" : isoFromSerial(l.date),
        name: l.name,
        replacement: l.replacement,
        type: l.type,
        note: l.note,
        ref: l.ref ?? "",
      }));
      const seen = new Set<string>();
      let removed = 0;
      const keep = cur.filter((r) => {
        if (!r.ref) return true;
        if (seen.has(r.ref)) return (removed++, false); // แถวซ้ำ
        seen.add(r.ref);
        const d = toSerial(r.date);
        if (want.has(r.ref) || (d !== null && d < windowStart)) return true;
        removed++;
        return false;
      });
      const add = Array.from(want.values()).filter((r) => !seen.has(r.ref!)).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
      if (add.length > 0 || removed > 0) await saveLeaves([...keep, ...add]);
      return (lastResult = { added: add.length, removed, at, skippedNames: Array.from(skipped) });
    } catch (e) {
      const msg = (e as Error).message;
      const error = /\b(403|404)\b|PERMISSION|not found/i.test(msg)
        ? "อ่านชีตระบบลาไม่ได้ — ต้องแชร์ชีตระบบลาให้บัญชีของเว็บ (assignshifts@assignshifts.iam.gserviceaccount.com) สิทธิ์ผู้อ่าน"
        : `ดึงข้อมูลระบบลาไม่สำเร็จ: ${msg.slice(0, 200)}`;
      return (lastResult = { added: 0, removed: 0, at, error, skippedNames: [] });
    } finally {
      lastSync = Date.now();
      syncing = null;
    }
  })();
  return syncing;
}
