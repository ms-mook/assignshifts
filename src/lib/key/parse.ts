// อ่านค่าจากชีต Key (ค่าดิบ UNFORMATTED_VALUE: วันที่เป็น serial)
import { toSerial } from "../sheets-date";
import type { KeySettings } from "./engine";

export type Grid = unknown[][];
export const KEY_SETTINGS_RANGE = "'ตั้งค่า'!A1:T112";
export const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const cell = (g: Grid, r: number, c: number) => (g[r - 1] ?? [])[c - 1];

export function parseKeySettings(g: Grid): KeySettings {
  const col = (c: number, r1: number, r2: number) => Array.from({ length: r2 - r1 + 1 }, (_, i) => str(cell(g, r1 + i, c)));
  const holidays: { date: number; name: string }[] = [];
  for (let r = 13; r <= 58; r++) {
    const d = toSerial(cell(g, r, 5));
    if (d !== null) holidays.push({ date: d, name: str(cell(g, r, 6)) });
  }
  const leaves = [];
  for (let r = 13; r <= 112; r++)
    leaves.push({ date: toSerial(cell(g, r, 13)), who: str(cell(g, r, 14)), sub: str(cell(g, r, 15)), note: str(cell(g, r, 16)) });
  const th = Number(str(cell(g, 7, 2)));
  return {
    rotStart: toSerial(cell(g, 3, 2)) ?? 0,
    key4Name: str(cell(g, 4, 2)),
    signerName: str(cell(g, 5, 2)),
    signerTitle: str(cell(g, 6, 2)),
    threshold: Number.isFinite(th) ? th : 5,
    title: str(cell(g, 8, 2)),
    docNo: str(cell(g, 9, 2)),
    head: str(cell(g, 10, 2)),
    rot: col(2, 13, 16),
    rotNote: col(3, 13, 16),
    holidays,
    monthNames: col(8, 13, 24),
    dropdown: col(10, 13, 58),
    heads: col(18, 13, 20),
    leaves,
  };
}
