// แท็บซ่อนของเว็บในสำเนาชีต (ใช้ร่วมทุกตาราง): ช่องเลือกเอง / รูปแบบช่อง / สีพนักงาน
import "server-only";
import { addSheet, batchGet, batchUpdate, sheetTitles } from "./google";

export const WEB_MANUAL = "WEB-ช่องเลือกเอง";
export const WEB_STYLE = "WEB-รูปแบบเซลล์";
export const WEB_COLOR = "WEB-สีพนักงาน";
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export async function ensureTab(id: string, titles: string[], title: string, header: string[]) {
  if (titles.includes(title)) return;
  await addSheet(id, title);
  await batchUpdate(id, [{ range: `'${title}'!A1:${String.fromCharCode(64 + header.length)}1`, values: [header] }]);
}

/** อ่านแท็บเว็บ + แท็บเดือน (ถ้ามี) ในครั้งเดียว */
export async function readWebState(id: string, ym: string, monthTab: string | null, monthRange: string) {
  const titles = await sheetTitles(id);
  const ranges: string[] = [];
  const at: Record<string, number> = {};
  const add = (n: string, r: string) => ((at[n] = ranges.length), ranges.push(r));
  if (titles.includes(WEB_MANUAL)) add("web", `'${WEB_MANUAL}'!A2:B5000`);
  if (titles.includes(WEB_STYLE)) add("style", `'${WEB_STYLE}'!A2:C5000`);
  if (titles.includes(WEB_COLOR)) add("color", `'${WEB_COLOR}'!A2:B500`);
  const hasTab = monthTab !== null && titles.includes(monthTab);
  if (hasTab) add("tab", `'${monthTab}'!${monthRange}`);
  const g = ranges.length ? await batchGet(id, ranges, "FORMATTED_VALUE") : [];
  const grid = (n: string) => (n in at ? g[at[n]] : []);
  const prefix = `${ym}|`;
  const web: Record<string, string> = {};
  for (const r of grid("web")) if (str(r[0]).startsWith(prefix)) web[str(r[0]).slice(prefix.length)] = str(r[1]);
  const styles: Record<string, { bg?: string; fg?: string }> = {};
  for (const r of grid("style")) {
    const k = str(r[0]);
    if (!k.startsWith(prefix)) continue;
    styles[k.slice(prefix.length)] = { ...(str(r[1]) ? { bg: str(r[1]) } : {}), ...(str(r[2]) ? { fg: str(r[2]) } : {}) };
  }
  const personColors: Record<string, string> = {};
  for (const r of grid("color")) if (str(r[0]) && str(r[1])) personColors[str(r[0])] = str(r[1]);
  return { web, styles, personColors, hasTab, tab: grid("tab") };
}

/** เขียนช่องเลือกเอง: value null = ลบ (คืนค่าสูตร) */
export async function writeManual(id: string, ym: string, entries: { key: string; value: string | null }[]) {
  const titles = await sheetTitles(id);
  await ensureTab(id, titles, WEB_MANUAL, ["key (ปี-เดือน|คอลัมน์:วัน)", "ค่า"]);
  const [g] = await batchGet(id, [`'${WEB_MANUAL}'!A2:B5000`], "FORMATTED_VALUE");
  const map = new Map<string, string>();
  for (const r of g) if (str(r[0])) map.set(str(r[0]), str(r[1]));
  for (const { key, value } of entries) {
    const full = `${ym}|${key}`;
    if (value === null) map.delete(full);
    else map.set(full, value);
  }
  const rows = [...map.entries()].map(([k, v]) => [k, v]);
  if (rows.length > 4999) throw new Error("เก็บช่องที่แก้เองได้สูงสุด 4,999 ช่อง");
  while (rows.length < g.length) rows.push(["", ""]);
  if (rows.length) await batchUpdate(id, [{ range: `'${WEB_MANUAL}'!A2:B${rows.length + 1}`, values: rows }]);
}

export async function writeStyles(id: string, ym: string, keys: string[], patch: { bg?: string | null; fg?: string | null; clear?: boolean }) {
  const titles = await sheetTitles(id);
  await ensureTab(id, titles, WEB_STYLE, ["key (ปี-เดือน|คอลัมน์:วัน)", "สีพื้น", "สีตัวอักษร"]);
  const [g] = await batchGet(id, [`'${WEB_STYLE}'!A2:C5000`], "FORMATTED_VALUE");
  const map = new Map<string, { bg: string; fg: string }>();
  for (const r of g) if (str(r[0])) map.set(str(r[0]), { bg: str(r[1]), fg: str(r[2]) });
  for (const key of keys) {
    const full = `${ym}|${key}`;
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
  if (rows.length) await batchUpdate(id, [{ range: `'${WEB_STYLE}'!A2:C${rows.length + 1}`, values: rows }]);
}

export async function writePersonColors(id: string, colors: Record<string, string>) {
  const titles = await sheetTitles(id);
  await ensureTab(id, titles, WEB_COLOR, ["ชื่อพนักงาน", "สีตัวอักษร"]);
  const [g] = await batchGet(id, [`'${WEB_COLOR}'!A2:B500`], "FORMATTED_VALUE");
  const rows = Object.entries(colors).map(([n, c]) => [n, c]);
  if (rows.length > 499) throw new Error("เก็บสีได้สูงสุด 499 ชื่อ");
  while (rows.length < g.length) rows.push(["", ""]);
  if (rows.length) await batchUpdate(id, [{ range: `'${WEB_COLOR}'!A2:B${rows.length + 1}`, values: rows }]);
}
