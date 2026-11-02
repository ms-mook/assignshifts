// รายการ Google Sheet ทั้ง 4 ไฟล์ (เปลี่ยนได้ผ่าน environment variables)
export const SHEETS = {
  /** ตารางเวรนักเทคนิคการแพทย์และพยาบาล FM-CL-05-002-00 (6.00-8.30 / 8.30-12.30 / 12.30-16.30) */
  shift3: process.env.SHEET_ID_SHIFT3 ?? "1-8n5Btno6HXHIfQBqmmZq8NMAGWd8IyYvifenDuw85w",
  /** ตารางเวรจุดลงทะเบียนรายการตรวจ (Key) — สำเนาสำหรับเว็บ */
  key: process.env.SHEET_ID_KEY ?? "1THlhf3PFPtvVUBb0Ij-9HAN1cWXP6c15yh9NGkpRTgw",
  /** ตารางเวร SMC — สำเนาสำหรับเว็บ */
  smc: process.env.SHEET_ID_SMC ?? "1dKewo2QDyQUrHL1xaCN6QxNH9q5Jejl7ZE37LUpn_gQ",
  /** ตารางเวรจุดรับ-นำส่งสิ่งส่งตรวจ (OT) — สำเนาสำหรับเว็บ */
  ot: process.env.SHEET_ID_OT ?? "1HtxDgpEwdZbQXFp3j6ZLjwOZyF4wMnyLiVQBNTysReI",
  /** ระบบลา (อ่านอย่างเดียว · แท็บ Leave) — ดึงเฉพาะการลาที่ Approve แล้ว */
  leaveSystem: process.env.SHEET_ID_LEAVE_SYSTEM ?? "1NEmJOPvNXZCLEzWXZefdsy6vj6T9_GMQ0Y46EZ80lUE",
};

export const MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** ชื่อแท็บเดือนในชีต เช่น ม.ค.70 */
export function monthTabName(yearBE: number, month: number): string {
  return `${MONTH_SHORT[month - 1]}${String(yearBE % 100).padStart(2, "0")}`;
}

/** "2570-01" <-> {yearBE, month} */
export function parseYm(ym: string): { yearBE: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { yearBE: Number(m[1]), month };
}

export function ymString(yearBE: number, month: number): string {
  return `${yearBE}-${String(month).padStart(2, "0")}`;
}

export function shiftYm(yearBE: number, month: number, delta: number): string {
  const idx = yearBE * 12 + (month - 1) + delta;
  return ymString(Math.floor(idx / 12), (idx % 12) + 1);
}
