// โครงสร้างข้อมูลของตารางเวร "6.00-8.30 / 8.30-12.30 / 12.30-16.30"
// (Google Sheet: ตารางเวรนักเทคนิคการแพทย์และพยาบาล FM-CL-05-002-00)
// ทุก field อ้างอิงตำแหน่งเซลล์ในชีต "ตั้งค่า" ตามคอมเมนต์

export interface Person {
  no: string; // A13:A26
  name: string; // B13:B26
  start: number | null; // C  วันเริ่มงาน (serial)
  lastDay: number | null; // D  วันทำงานวันสุดท้าย (ถ้าลาออก)
  replacement: string; // E  ชื่อผู้มาแทน
  replacementStart: number | null; // F  วันเริ่มงานผู้มาแทน
}

export interface Spot {
  code: number; // J13:J26
  name: string; // K
  room: string; // L
  pos13: number | null; // M  ตำแหน่งรอบ 13
  pos14: number | null; // N  ตำแหน่งรอบ 14
  fillOrder: number | null; // O  ลำดับเติม POCT (99 = ไม่ใช้)
}

export interface TrainingStep {
  week: number; // Q13:Q22
  code: number; // R
  label: string; // S (แสดงผลเท่านั้น)
}

export interface Holiday {
  date: number | null; // H46:H85 (serial)
  name: string; // I46:I85
}

export interface Shift3Settings {
  startMonday: number; // B3
  rotationPattern: number; // B4
  newHireStart: number | null; // B5
  newHireMonths: number; // B6
  trainingWeeks: number; // B8
  persons: Person[]; // 14 แถว (13-26)
  spots: Spot[]; // 14 แถว
  training: TrainingStep[]; // 10 แถว
  pairOddKw8: string; // B29 สัปดาห์คี่ — คนที่เริ่มที่ กว.ทั่วไป8
  pairOddOpd11: string; // B30 สัปดาห์คี่ — คนที่เริ่มที่ OPD ทั่วไป11
  poctKw: string; // B33 ประจำทุกบ่าย — กว. POCT
  poctOpd: string; // B34 ประจำทุกบ่าย — OPD POCT
  poctAlt1: string; // B35 สลับสัปดาห์ — คนที่ 1
  poctAlt2: string; // B36 สลับสัปดาห์ — คนที่ 2
  b30AtKey1: string; // B37 "ใช่" / "ไม่"
  fillFrom: [string, string, string]; // B40:B42
  monthNames: string[]; // A46:A57
  holidays: Holiday[]; // H46:I85
  signerName: string; // B89
  signerTitle: string; // B90
}

export interface LeaveRow {
  date: number | null; // ลา-แลกเวร!A
  name: string; // B
  replacement: string; // C
  type: string; // D
  note: string; // G
}

/** ช่องที่ผู้จัดเลือกเอง (เขียนทับสูตรในชีตเดือน) key = `${section}:${col}:${day}` */
export type ManualCells = Record<string, string>;

export interface PlanWeek {
  week: number; // A
  monday: number; // B
  friday: number; // C
  AL: number;
  AM: number;
  pos: number[]; // CP..DC
  active: string[]; // CB..CO
  BA: number;
  BB: number;
  s1: string[]; // D..Q
  R: string;
  S: string;
  BC: string;
  prio: number[]; // BD..BQ
  BZ: number;
  BR: number;
  BS: number;
  BT: string;
  BU: string;
  BV: string;
  BW: string;
  BX: string;
  s3: string[]; // T..AG
  AH: string;
  AI: string;
  AJ: string;
  chkSame: number; // DD
  chkDup: number; // DE
  chkBlank: number; // DF
}

export type SectionNo = 1 | 2 | 3;

export interface MonthRow {
  day: number; // ลำดับแถว 1..31
  date: number | null; // serial หรือ null ถ้าเกินจำนวนวันของเดือน
  workday: 0 | 1; // AM / AP
  week: number | null; // AN / AQ
  /** 37 ช่อง A..AK ตามที่แสดงในชีต (A = เลขวันที่) */
  cells: string[];
  /** ช่องที่ผู้จัดเลือกเอง (index คอลัมน์) */
  manualCols: number[];
}

export interface MonthSection {
  section: SectionNo;
  title: string;
  subtitle: string;
  timeLabel: string;
  rows: MonthRow[];
}

export interface MonthResult {
  yearBE: number;
  month: number;
  sections: MonthSection[];
  signerName: string;
  signerTitle: string;
}
