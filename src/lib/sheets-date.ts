// วันที่แบบ Google Sheets: serial number = จำนวนวันนับจาก 1899-12-30
// ใช้ serial ภายในทั้งหมดเพื่อให้การเทียบ/บวกวันตรงกับสูตรในชีต 100%

const MS_PER_DAY = 86400000;
const EPOCH_UTC = Date.UTC(1899, 11, 30);

export function serialFromYMD(y: number, m: number, d: number): number {
  // m = 1..12 ; รองรับ d เกินเดือนแบบเดียวกับ DATE() ของชีต
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH_UTC) / MS_PER_DAY);
}

export function ymdFromSerial(serial: number): { y: number; m: number; d: number } {
  const dt = new Date(EPOCH_UTC + serial * MS_PER_DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function isoFromSerial(serial: number): string {
  const { y, m, d } = ymdFromSerial(serial);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** WEEKDAY(date, 2): จันทร์ = 1 ... อาทิตย์ = 7 */
export function weekday2(serial: number): number {
  return ((((serial - 2) % 7) + 7) % 7) + 1;
}

/** EOMONTH(date, months) */
export function eomonth(serial: number, months: number): number {
  const { y, m } = ymdFromSerial(serial);
  // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนเป้าหมาย
  return serialFromYMD(y, m + months + 1, 0);
}

export function daysInMonth(y: number, m: number): number {
  return ymdFromSerial(serialFromYMD(y, m + 1, 0)).d;
}

/**
 * แปลงค่าจากชีตเป็น serial
 * - number (UNFORMATTED_VALUE / SERIAL_NUMBER) ใช้ได้เลย
 * - "YYYY-MM-DD" หรือ "DD/MM/YYYY" (ค่าที่แสดงผล) แปลงให้
 * - ค่าว่าง/อ่านไม่ได้ => null
 */
export function toSerial(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return serialFromYMD(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return serialFromYMD(+m[3], +m[2], +m[1]);
  if (/^\d+(\.\d+)?$/.test(s)) return Math.floor(Number(s));
  return null;
}
