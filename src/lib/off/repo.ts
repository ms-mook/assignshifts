// อ่าน/เขียน "ตารางเวรนอกเวลา" กับสำเนา Google Sheet ของเว็บ
// - ค่าตั้งต้นทุกช่อง = ค่าที่สูตรในแท็บเดือนคำนวณแล้ว (อ่านอย่างเดียว ไม่แตะสูตร)
// - ช่องที่ไม่มีสูตร (Key 4, Key 5, ช่อง 9, เก็บ 1, เก็บ 2, บัตรคิว, เก็บ SMC) ของวันเสาร์-อาทิตย์
//   → เขียนลงแท็บ "ตารางเวร ส-อา" ตรง ๆ (แท็บเดือนดึงไปแสดงเอง) เหมือนช่อง จนท. ของตาราง 3 ช่วงเวลา
// - ช่องที่เป็นสูตรหมุนเวร → แท็บ WEB-ช่องเลือกเอง (key ปี-เดือน|คอลัมน์:วัน) · คืนค่าสูตร = ลบออก (ไม่แตะสูตรในชีต)
import "server-only";
import { batchGet, batchUpdate, sheetTitles } from "../google";
import { toSerial } from "../sheets-date";
import { MONTH_SHORT, SHEETS, ymString } from "../config";
import { readOffLeaves } from "../leave-system";
import { readWebState, writeManual, writePersonColors, writeStyles } from "../webtabs";
import { serialOf } from "../ot/engine";
import { OFF_SET_RANGE, offSettingsWrites, parseOffSettings, validateOffSettings, type OffSettingsForm } from "./settings";
import { buildOffMonth, offBusyCol, parseOffLists, type OffLeave, type OffLists, type OffMonth } from "./engine";
export { parseOffLists };

const ID = () => SHEETS.off;
export const OFF_SETTINGS_RANGE = "'ตั้งค่า'!T5:Y69";

/** ชื่อแท็บเดือนในชีตนี้ เช่น "ธ.ค. 69" (มีเว้นวรรค) — หาแบบไม่สนช่องว่าง */
export function offTabName(titles: string[], yearBE: number, month: number): string | null {
  const want = `${MONTH_SHORT[month - 1]}${String(yearBE % 100).padStart(2, "0")}`;
  return titles.find((t) => t.replace(/\s/g, "") === want) ?? null;
}

export interface OffState {
  hasTab: boolean;
  tab: string | null;
  month: OffMonth;
  lists: OffLists;
  manual: Record<string, string>;
  styles: Record<string, { bg?: string; fg?: string }>;
  personColors: Record<string, string>;
}

export async function loadOffMonth(yearBE: number, month: number): Promise<OffState> {
  const titles = await sheetTitles(ID());
  const tab = offTabName(titles, yearBE, month);
  const [st, [sg]] = await Promise.all([
    readWebState(ID(), ymString(yearBE, month), tab, "A1:AD40"),
    batchGet(ID(), [OFF_SETTINGS_RANGE], "FORMATTED_VALUE"),
  ]);
  const grid = st.hasTab ? st.tab : [];
  return {
    hasTab: st.hasTab,
    tab,
    month: buildOffMonth(grid, st.web, yearBE, month),
    lists: parseOffLists(sg),
    manual: st.web,
    styles: Object.fromEntries(Object.entries(st.styles).map(([k, v]) => [`w:${k}`, v])),
    personColors: st.personColors,
  };
}

/** การลาประเภท งดเวรนอกเวลา (Approve) จากระบบลา — อ่านไม่ได้ก็แสดงตารางต่อ */
export async function loadOffLeaves(): Promise<{ leaves: OffLeave[]; error: string }> {
  try {
    return { leaves: (await readOffLeaves()).map((l) => ({ firstName: l.firstName, start: l.start, end: l.end })), error: "" };
  } catch (e) {
    return { leaves: [], error: (e as Error).message };
  }
}

const KEY = /^w:([C-W]|Y|Z):(\d{1,2})$/;
export const isOffKey = (k: string) => {
  const m = KEY.exec(k);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 31;
};

/** แท็บหลักวันเสาร์-อาทิตย์ (แถว 4–107 · C = วันที่) */
export const OFF_MASTER = "ตารางเวร ส-อา";
/** คอลัมน์ในแท็บเดือน → คอลัมน์ในแท็บหลัก ที่ไม่มีสูตร (ผู้จัดเวรพิมพ์เอง) */
export const OFF_MASTER_VALUE_COLS: Record<string, string> = { F: "H", G: "I", K: "M", Q: "S", R: "T", S: "U", W: "Y" };

/**
 * บันทึกช่องที่แก้บนเว็บ
 *  - ช่องไม่มีสูตร ของวันที่อยู่ในแท็บหลัก → เขียนลง 'ตารางเวร ส-อา' (null/ว่าง = ล้างช่อง) และลบค่าที่เคยเก็บในแท็บเว็บ
 *  - ช่องอื่น → แท็บ WEB-ช่องเลือกเอง (null = ลบ กลับไปใช้ค่าจากสูตร)
 */
export async function saveOffManual(yearBE: number, month: number, entries: { key: string; value: string | null }[]) {
  const ym = ymString(yearBE, month);
  const toMaster = entries.filter(({ key }) => key.split(":")[1] in OFF_MASTER_VALUE_COLS);
  const rowOf = new Map<number, number>();
  let fx: unknown[][] = [];
  if (toMaster.length > 0) {
    // วันที่ (C) + สูตรของแท็บหลัก (ช่องไหนเป็นสูตร เช่น ช่อง 9 วันอาทิตย์ → ไม่เขียนทับ เก็บในแท็บเว็บแทน)
    const [[g], [f]] = await Promise.all([batchGet(ID(), [`'${OFF_MASTER}'!C4:C107`]), batchGet(ID(), [`'${OFF_MASTER}'!A4:Y107`], "FORMULA")]);
    fx = f;
    g.forEach((r, i) => {
      const d = toSerial(r?.[0]);
      if (d !== null && !rowOf.has(d)) rowOf.set(d, 4 + i);
    });
  }
  const isFormula = (mcol: string, row: number) => String((fx[row - 4] ?? [])[mcol.charCodeAt(0) - 65] ?? "").startsWith("=");
  const sheetWrites: { range: string; values: unknown[][] }[] = [];
  const web: { key: string; value: string | null }[] = [];
  for (const { key, value } of entries) {
    const [, col, d] = key.split(":");
    const mcol = OFF_MASTER_VALUE_COLS[col];
    const row = mcol ? rowOf.get(serialOf(yearBE - 543, month, Number(d))) : undefined;
    if (mcol && row !== undefined && !isFormula(mcol, row)) {
      sheetWrites.push({ range: `'${OFF_MASTER}'!${mcol}${row}`, values: [[value ?? ""]] });
      web.push({ key: `${col}:${d}`, value: null }); // ค่าเก่าในแท็บเว็บ (ถ้ามี) จะไม่บังค่าในชีต
    } else web.push({ key: `${col}:${d}`, value });
  }
  if (sheetWrites.length > 0) await batchUpdate(ID(), sheetWrites);
  if (web.length > 0) await writeManual(ID(), ym, web);
}
export const saveOffStyles = (y: number, m: number, keys: string[], patch: { bg?: string | null; fg?: string | null; clear?: boolean }) =>
  writeStyles(ID(), ymString(y, m), keys.map((k) => k.slice(2)), patch);
export const saveOffPersonColors = (c: Record<string, string>) => writePersonColors(ID(), c);

/** ใส่ชื่อ 1 ช่อง: ห้ามคนเดียวอยู่ 2 จุดในวันเดียวกัน (ส.-อา. C–W ทุกจุด · จ.-ศ. Y, Z) → ข้อความเหตุผล หรือ null */
export async function validateOffManual(yearBE: number, month: number, key: string, value: string | null): Promise<string | null> {
  if (value === null || value.trim() === "") return null;
  const st = await loadOffMonth(yearBE, month);
  const [, col, d] = key.split(":");
  const row = st.month.rows[Number(d) - 1];
  if (!row || row.date === null) return "วันที่นี้ไม่มีในเดือน";
  const at = offBusyCol(row.cells, col, value);
  if (!at) return null;
  const label = st.month.head[`${at}6`] ?? at;
  return `"${value.trim()}" อยู่ที่ ${label} ของวันที่ ${row.day} แล้ว (พนักงาน 1 คนอยู่ได้ 1 จุดต่อวัน)`;
}

// ---------- ตั้งค่า (แท็บ ตั้งค่า) ----------
async function readOffSettingsNow(): Promise<OffSettingsForm> {
  const [[v], [f]] = await Promise.all([batchGet(ID(), [OFF_SET_RANGE]), batchGet(ID(), [OFF_SET_RANGE], "FORMULA")]);
  return parseOffSettings(v, f);
}
export const loadOffSettings = readOffSettingsNow;

/** บันทึกตั้งค่า: ตรวจฟอร์ม → อ่านชีตล่าสุด (รู้ว่าช่องไหนเป็นสูตร) → เขียนเฉพาะช่องค่าที่เปลี่ยน */
export async function saveOffSettings(next: OffSettingsForm): Promise<{ addedToT: string[]; skipped: string[]; changed: number }> {
  const err = validateOffSettings(next);
  if (err.length) throw new Error(err.join(" · "));
  const cur = await readOffSettingsNow();
  const { writes, addedToT, skipped } = offSettingsWrites(cur, next);
  if (writes.length > 0) await batchUpdate(ID(), writes);
  return { addedToT, skipped, changed: writes.length };
}
