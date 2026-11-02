// อ่าน/เขียนข้อมูลตาราง 3 ช่วงเวลา กับ Google Sheet
import "server-only";
import { addSheet, batchGet, batchUpdate, sheetTitles } from "../google";
import { SHEETS, monthTabName, ymString } from "../config";
import { isoFromSerial, toSerial } from "../sheets-date";
import { PlanCalculator, colIndex, colLetter, computeMonth, editableCols, manualKey, SECTION_MAP } from "./engine";
import {
  LEAVES_RANGE,
  MTRN_RANGE,
  SETTINGS_RANGE,
  dropdownNames,
  parseLeaves,
  parseMtrn,
  parseSettings,
  str,
} from "./parse";
import type { LeaveRow, ManualCells, SectionNo, Shift3Settings } from "./types";

const ID = () => SHEETS.shift3;
export const WEB_MANUAL_TAB = "WEB-ช่องเลือกเอง";
const SECTION_FIRST_ROW: Record<SectionNo, number> = { 1: 8, 2: 49, 3: 90 };

export interface Shift3Data {
  settings: Shift3Settings;
  leaves: LeaveRow[];
  mtrn: { name: string; note: string }[];
}

export async function loadShift3(): Promise<Shift3Data> {
  const [sg, lg, mg] = await batchGet(ID(), [SETTINGS_RANGE, LEAVES_RANGE, MTRN_RANGE]);
  return { settings: parseSettings(sg), leaves: parseLeaves(lg), mtrn: parseMtrn(mg) };
}

/**
 * ช่องที่ผู้จัดเลือกเอง:
 * - ถ้ามีแท็บเดือนในชีต (เช่น ม.ค.70) อ่านจากแท็บนั้น (ค่าที่ต่างจากสูตรตั้งต้น = เลือกเอง)
 * - ถ้ายังไม่มีแท็บเดือน อ่านจากแท็บ WEB-ช่องเลือกเอง
 */
export async function loadManual(
  data: Shift3Data,
  yearBE: number,
  month: number,
): Promise<{ manual: ManualCells; source: "month-tab" | "web-tab" }> {
  const titles = await sheetTitles(ID());
  const tab = monthTabName(yearBE, month);
  // ช่องที่พิมพ์ทับ (ทุกช่องตำแหน่ง) เก็บในแท็บ WEB-ช่องเลือกเอง เสมอ — ไม่แตะสูตรในแท็บเดือน
  const web: ManualCells = {};
  if (titles.includes(WEB_MANUAL_TAB)) {
    const [g] = await batchGet(ID(), [`'${WEB_MANUAL_TAB}'!A2:B5000`]);
    const prefix = `${ymString(yearBE, month)}|`;
    for (const r of g) {
      const k = str(r[0]);
      if (k.startsWith(prefix)) web[k.slice(prefix.length)] = str(r[1]);
    }
  }
  if (titles.includes(tab)) {
    const ranges = ([1, 2, 3] as SectionNo[]).map(
      (s) => `'${tab}'!A${SECTION_FIRST_ROW[s]}:AK${SECTION_FIRST_ROW[s] + 30}`,
    );
    const grids = await batchGet(ID(), ranges, "FORMATTED_VALUE");
    const base = computeMonth(data.settings, data.leaves, {}, yearBE, month);
    const manual: ManualCells = {};
    base.sections.forEach((sec, si) => {
      sec.rows.forEach((row, ri) => {
        const sheetRow = grids[si][ri] ?? [];
        for (const ci of editableCols(sec.section)) {
          const v = str(sheetRow[ci]);
          if (v !== row.cells[ci]) manual[manualKey(sec.section, ci, row.day)] = v;
        }
      });
    });
    return { manual: { ...manual, ...web }, source: "month-tab" };
  }
  return { manual: web, source: "web-tab" };
}

/** บันทึกช่องเลือกเอง; value = null หมายถึงคืนค่าสูตรตั้งต้น */
export async function saveManual(yearBE: number, month: number, key: string, value: string | null): Promise<void> {
  const [secStr, col, dayStr] = key.split(":");
  const sec = Number(secStr) as SectionNo;
  const day = Number(dayStr);
  const ci = colIndex(col);
  const src = SECTION_MAP[sec]?.[ci];
  if (!src || ci === 0 || !(day >= 1 && day <= 31)) throw new Error("ช่องนี้แก้ไม่ได้");
  const titles = await sheetTitles(ID());
  const tab = monthTabName(yearBE, month);
  // ช่องจนท./เวชกรรมสังคม/SHE เขียนลงแท็บเดือนตามเดิม; ช่องอื่นเก็บในแท็บ WEB-ช่องเลือกเอง
  if ((src.kind === "manual" || src.kind === "free") && titles.includes(tab)) {
    const r = SECTION_FIRST_ROW[sec] + day - 1;
    const flag = sec === 3 ? `$AP${r}` : `$AM${r}`;
    const restore = src.kind === "manual" ? `=IF(${flag}=1,"จนท.","")` : "";
    await batchUpdate(ID(), [{ range: `'${tab}'!${col}${r}`, values: [[value === null ? restore : value]] }]);
    return;
  }
  if (!titles.includes(WEB_MANUAL_TAB)) {
    await addSheet(ID(), WEB_MANUAL_TAB);
    await batchUpdate(ID(), [{ range: `'${WEB_MANUAL_TAB}'!A1:B1`, values: [["key (ปี-เดือน|ส่วน:คอลัมน์:วัน)", "ค่า"]] }]);
  }
  const [g] = await batchGet(ID(), [`'${WEB_MANUAL_TAB}'!A2:B5000`]);
  const fullKey = `${ymString(yearBE, month)}|${key}`;
  const rows = g.map((r) => [str(r[0]), str(r[1])]).filter((r) => r[0] !== "" && r[0] !== fullKey);
  if (value !== null) rows.push([fullKey, value]);
  const padded = [...rows];
  while (padded.length < g.length) padded.push(["", ""]);
  await batchUpdate(ID(), [{ range: `'${WEB_MANUAL_TAB}'!A2:B${padded.length + 1}`, values: padded }]);
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
  mtrn: { name: string; note: string }[];
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
}

export async function saveLeaves(rows: LeaveForm[]): Promise<void> {
  if (rows.length > 396) throw new Error("บันทึกได้สูงสุด 396 แถว (A5:A400)");
  const n = 396;
  const pad = <T,>(arr: T[], empty: T) => Array.from({ length: n }, (_, i) => arr[i] ?? empty);
  const ad = pad(
    rows.map((r, i) => [checkDate(r.date, `A${5 + i}`), r.name, r.replacement, r.type]),
    ["", "", "", ""],
  );
  const g = pad(rows.map((r) => [r.note]), [""]);
  // E, F เป็นสูตร ไม่เขียนทับ
  await batchUpdate(ID(), [
    { range: `'ลา-แลกเวร'!A5:D400`, values: ad },
    { range: `'ลา-แลกเวร'!G5:G400`, values: g },
  ]);
}

export { colLetter };
