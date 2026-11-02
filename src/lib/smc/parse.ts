// อ่านค่าจากชีต SMC (ค่าดิบ UNFORMATTED_VALUE)
import { toSerial } from "../sheets-date";
import type { SmcSettings } from "./engine";

export type Grid = unknown[][];
export const SMC_SETTINGS_RANGE = "'ตั้งค่า'!A1:V66";
export const SMC_LEAVES_RANGE = "'ตารางลา'!A5:F200";
export const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const cell = (g: Grid, r: number, c: number) => (g[r - 1] ?? [])[c - 1];
const num = (v: unknown, d: number) => {
  const n = Number(str(v));
  return str(v).trim() === "" || !Number.isFinite(n) ? d : n;
};

export function parseSmc(sg: Grid, lg: Grid): SmcSettings {
  const col = (c: number, r1: number, r2: number) => Array.from({ length: r2 - r1 + 1 }, (_, i) => str(cell(sg, r1 + i, c)));
  const holidays: { date: number; name: string }[] = [];
  for (let r = 17; r <= 66; r++) {
    const d = toSerial(cell(sg, r, 5));
    if (d !== null) holidays.push({ date: d, name: str(cell(sg, r, 6)) });
  }
  return {
    title: str(cell(sg, 3, 2)),
    docNo: str(cell(sg, 4, 2)),
    signerName: str(cell(sg, 5, 2)),
    signerTitle: str(cell(sg, 6, 2)),
    hours: [num(cell(sg, 4, 6), 1.5), num(cell(sg, 5, 6), 4), num(cell(sg, 6, 6), 3.5)],
    q0700: str(cell(sg, 7, 2)),
    q0830: str(cell(sg, 8, 2)),
    q1230: str(cell(sg, 9, 2)),
    key0700: str(cell(sg, 10, 2)),
    key0830: str(cell(sg, 11, 2)),
    mt: str(cell(sg, 12, 2)),
    pt: str(cell(sg, 13, 2)),
    holidays,
    monthNames: col(8, 17, 28),
    listJ: col(10, 17, 46),
    listL: col(12, 17, 46),
    listN: col(14, 17, 46),
    listP: col(16, 17, 46),
    listT: col(20, 17, 20),
    leaves: lg
      .map((r) => ({ name: str(r[0]), start: toSerial(r[1]), end: toSerial(r[2]), type: str(r[3]), sub: str(r[4]), note: str(r[5]) }))
      .filter((l) => l.name || l.start !== null || l.end !== null || l.type || l.sub || l.note),
  };
}
