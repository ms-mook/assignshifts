// อ่าน/เขียน "ตารางเวรนอกเวลา" กับสำเนา Google Sheet ของเว็บ
// - ค่าตั้งต้นทุกช่อง = ค่าที่สูตรในแท็บเดือนคำนวณแล้ว (อ่านอย่างเดียว ไม่แตะสูตร)
// - ช่องที่แก้บนเว็บ → แท็บ WEB-ช่องเลือกเอง (key ปี-เดือน|คอลัมน์:วัน) · ล้างค่า = คืนค่าจากสูตร
import "server-only";
import { batchGet, sheetTitles } from "../google";
import { MONTH_SHORT, SHEETS, ymString } from "../config";
import { readOffLeaves } from "../leave-system";
import { readWebState, writeManual, writePersonColors, writeStyles } from "../webtabs";
import { buildOffMonth, offBusyCol, parseOffLists, type OffLeave, type OffLists, type OffMonth } from "./engine";
export { parseOffLists };

const ID = () => SHEETS.off;
export const OFF_SETTINGS_RANGE = "'ตั้งค่า'!T5:X59";

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

/** value null = ลบออกจากแท็บเว็บ (กลับไปใช้ค่าจากสูตรในชีต) */
export async function saveOffManual(yearBE: number, month: number, entries: { key: string; value: string | null }[]) {
  await writeManual(ID(), ymString(yearBE, month), entries.map(({ key, value }) => ({ key: key.slice(2), value })));
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
