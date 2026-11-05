// อ่านค่าจากชีต OT (ค่าดิบ UNFORMATTED_VALUE: วันที่เป็น serial)
import { toSerial } from "../sheets-date";
import type { OtLeave, OtSettings } from "./engine";

export type Grid = unknown[][];
export const OT_SETTINGS_RANGE = "'ตั้งค่า'!A1:P55";
export const OT_LEAVES_RANGE = "'ลา-แลกเวร'!A5:H5004";
export const OT_SUMMARY_RANGE = "'สรุป'!B2:B3";

export const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown, d: number) => {
  const n = typeof v === "number" ? v : Number(str(v).trim());
  return str(v).trim() === "" || !Number.isFinite(n) ? d : n;
};
const cell = (g: Grid, r: number, c: number) => (g[r - 1] ?? [])[c - 1];

/** แถว/คอลัมน์ตามชีต (1-based) */
export function parseOtSettings(g: Grid): OtSettings {
  const staff = [];
  for (let r = 10; r <= 17; r++)
    staff.push({
      name: str(cell(g, r, 2)),
      start: toSerial(cell(g, r, 3)),
      last: toSerial(cell(g, r, 4)),
      rep: str(cell(g, r, 5)),
      repStart: toSerial(cell(g, r, 6)),
    });
  const spots = [];
  for (let r = 21; r <= 28; r++)
    spots.push({
      name: str(cell(g, r, 1)),
      room: str(cell(g, r, 2)),
      time: str(cell(g, r, 3)),
      heavy: str(cell(g, r, 4)),
      pos7: num(cell(g, r, 5), 99),
      pos8: num(cell(g, r, 6), 99),
      fill: num(cell(g, r, 7), 99),
    });
  const table = (r0: number) => {
    const t: number[][] = [];
    for (let r = r0; r < r0 + 8; r++) {
      const row: number[] = [];
      for (let c = 2; c <= 8; c++) row.push(num(cell(g, r, c), 99));
      t.push(row);
    }
    return t;
  };
  const holidays: { date: number; name: string }[] = [];
  const dropdown: string[] = [];
  const monthNames: string[] = [];
  for (let r = 10; r <= 55; r++) {
    const d = toSerial(cell(g, r, 10));
    if (d !== null) holidays.push({ date: d, name: str(cell(g, r, 11)) });
    const o = str(cell(g, r, 15)).trim();
    if (o !== "") dropdown.push(o);
    if (r <= 21) monthNames.push(str(cell(g, r, 12)));
  }
  const summaryCol: string[] = [];
  for (let r = 10; r <= 25; r++) summaryCol.push(str(cell(g, r, 2)));
  const pattern = Math.min(7, Math.max(1, Math.round(num(cell(g, 3, 2), 1))));
  return {
    pattern,
    startMonday: toSerial(cell(g, 4, 2)) ?? 0,
    eightStart: toSerial(cell(g, 5, 2)) ?? 0,
    smcOpen: toSerial(cell(g, 6, 2)) ?? 0,
    signerName: str(cell(g, 4, 7)),
    signerTitle: str(cell(g, 5, 7)),
    staff,
    spots,
    table7: table(32),
    table8: table(43),
    holidays,
    monthNames,
    dropdown,
    summaryCol,
  };
}

export function parseOtLeaves(g: Grid): (OtLeave & { row: number })[] {
  return g
    .map((r, i) => ({ row: i + 5, date: toSerial(r[0]), who: str(r[1]), sub: str(r[2]), type: str(r[3]).trim() }))
    .filter((l) => l.date !== null || l.who !== "" || l.sub !== "" || l.type !== "");
}
