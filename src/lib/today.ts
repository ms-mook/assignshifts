// วันนี้ตามเวลาประเทศไทย เป็น serial แบบ Google Sheets (1899-12-30 = 0)
export function todaySerialTH(): number {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000) + 25569;
}

/** จำนวนสัปดาห์ที่จะแสดงในแผน: อย่างน้อยเท่าชีตเดิม และต่อไปอีก 1 ปีจากสัปดาห์ปัจจุบันเสมอ (เลื่อนเองตามเวลา) */
export function planWeeks(startMonday: number, sheetDefault: number, requested: string | undefined, cap = 520) {
  const now = todaySerialTH();
  const current = now >= startMonday ? Math.floor((now - startMonday) / 7) + 1 : 0;
  const auto = Math.max(sheetDefault, current + 52);
  const n = Math.min(cap, Math.max(4, Number(requested) || auto));
  return { n, current };
}
