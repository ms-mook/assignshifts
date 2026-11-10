// ชื่อจุดและช่วงเวลาของแต่ละคอลัมน์ในตาราง Key / SMC / OT (ตามหัวตารางในชีต)
// ใช้แสดงข้อความ "อยู่ที่ … แล้ว" และตรวจคนเดียวกันอยู่หลายตารางในเวลาที่ทับกัน
export type Win = [number, number]; // นาทีนับจากเที่ยงคืน [เริ่ม, สิ้นสุด)
const t = (h: number, m = 0) => h * 60 + m;

export const KEY_COL_LABEL: Record<string, string> = {
  B: "OPD Key1", C: "OPD Key2", D: "OPD Key3(E)", E: "OPD Key4", F: "OPD Key5", G: "หัวหน้าเวร (R/A)",
  H: "จนท.แทน OPD key(เสริม2)", I: "จนท.แทน OPD เก็บ 1", J: "กว. Key1", K: "กว. Key2", L: "กว. Key3(E)", M: "กว. Key4 (SMC)",
  N: "จนท.แทน กว. คิว/เก็บ", O: "จนท.แทน OPD คิว", P: "หมายเหตุ",
};
/** ตาราง Key ทั้งตาราง 06.00–08.30 */
export const KEY_WIN: Win = [t(6), t(8, 30)];

export const SMC_COL_LABEL: Record<string, string> = {
  B: "บัตรคิว (07.00)", C: "ลงทะเบียน Key1 (07.00)", D: "ลงทะเบียน Key2 (07.00)", E: "ช่อง1 (07.00)", F: "ช่อง2 (07.00)", G: "ช่อง3 (07.00)", H: "ช่อง4 (07.00)", I: "ช่อง5 (07.00)",
  J: "บัตรคิว (08.30)", K: "ลงทะเบียน Key1 (08.30)", L: "Key2/เจาะ (08.30)", M: "ช่อง1 (08.30)", N: "ช่อง2 (08.30)", O: "ช่อง3,4 (08.30)", P: "ช่อง5 (08.30)",
  Q: "ช่อง1/บัตรคิว (12.30)", R: "ช่อง2 (12.30)", S: "เจาะ1 (12.30)", T: "ช่อง2,3,4,5 (12.30)",
};
export function smcWin(col: string): Win {
  if ("BCDEFGHI".includes(col)) return [t(7), t(8, 30)];
  if ("JKLMNOP".includes(col)) return [t(8, 30), t(12, 30)];
  return [t(12, 30), t(16)];
}

export const OT_COL_LABEL: Record<string, string> = {
  B: "จุดบัตรคิว OPD (06.00-08.30)", C: "จุดบัตรคิว OPD (08.00-16.30)", D: "ตรวจสอบเอกสาร/เก็บ 3 OPD (06.00-08.30)", E: "ตรวจสอบเอกสาร/เก็บ 3 OPD (07.00-15.00)",
  F: "เก็บ รับ-นำส่ง OPD คนที่1", G: "เก็บ รับ-นำส่ง OPD คนที่2", H: "จุดลงทะเบียน OPD", I: "จุดบัตรคิว กว.", J: "เก็บ รับ-นำส่ง กว. (06.00-08.30)",
  K: "เก็บ รับ-นำส่ง กว. (07.00-15.00)", L: "จุดลงทะเบียน กว.", M: "จุดบัตรคิว SMC", N: "จุดเก็บ รับ-นำส่ง SMC", O: "หมายเหตุ",
};
const OT_WIN: Record<string, Win> = {
  B: [t(6), t(8, 30)], C: [t(8), t(16, 30)], D: [t(6), t(8, 30)], E: [t(7), t(15)], F: [t(6), t(14)], G: [t(6), t(14)], H: [t(6), t(15)],
  I: [t(6), t(14)], J: [t(6), t(8, 30)], K: [t(7), t(15)], L: [t(8), t(16, 30)], M: [t(7), t(15)], N: [t(7), t(15)],
};
export const otWin = (col: string): Win | null => OT_WIN[col] ?? null;

/** ตาราง 3 ช่วงเวลา: ส่วนที่ 1/2/3 */
export const SHIFT3_WIN: Record<number, Win> = { 1: [t(6), t(8, 30)], 2: [t(8, 30), t(12, 30)], 3: [t(12, 30), t(16, 30)] };

export const overlap = (a: Win, b: Win) => a[0] < b[1] && b[0] < a[1];
export const winText = (w: Win) => `${String(Math.floor(w[0] / 60)).padStart(2, "0")}.${String(w[0] % 60).padStart(2, "0")}-${String(Math.floor(w[1] / 60)).padStart(2, "0")}.${String(w[1] % 60).padStart(2, "0")}`;
