// เอนจินตาราง "จุดรับ-นำส่งสิ่งส่งตรวจ" (OT) — แปลงสูตรจากชีต 1:1
// ชีตต้นฉบับ: ตารางเวรจุดรับ-นำส่งสิ่งส่งตรวจ พ.ย.69–พ.ย.70 (ตั้งค่า / แผนรายสัปดาห์ / ลา-แลกเวร / ฟอร์มรายเดือน / สรุป)
// วันที่ทั้งหมดเป็นเลข serial แบบ Google Sheets (1899-12-30 = 0)

export const OT_PATTERNS = 7;

export interface OtStaff {
  name: string; // B
  start: number | null; // C
  last: number | null; // D
  rep: string; // E
  repStart: number | null; // F
}
export interface OtSpot {
  name: string; // A
  room: string;
  time: string;
  heavy: string;
  pos7: number; // E
  pos8: number; // F
  fill: number; // G
}
export interface OtSettings {
  pattern: number; // B3
  startMonday: number; // B4
  eightStart: number; // B5
  smcOpen: number; // B6
  signerName: string; // G4
  signerTitle: string; // G5
  staff: OtStaff[]; // แถว 10-17 (8 คน)  — สรุปใช้ 16 แถว (10-25)
  spots: OtSpot[]; // แถว 21-28 (8 จุด)
  table7: number[][]; // B32:H39 [ลำดับ 0..7][รูปแบบ 0..6]
  table8: number[][]; // B43:H50
  holidays: { date: number; name: string }[]; // J10:K55
  monthNames: string[]; // L10:L21
  dropdown: string[]; // O10:O55
  /** ตั้งค่า!B10:B25 (16 แถว ตามสูตร สรุป!A6:A21 ='ตั้งค่า'!$B10&"") */
  summaryCol: string[];
}

export interface OtLeave {
  date: number | null; // A
  who: string; // B ชื่อคนลา
  sub: string; // C ชื่อคนมาแทน
  type: string; // D
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
export const weekdayMon1 = (serial: number) => mod(serial - 2, 7) + 1; // WEEKDAY(x,2)
export const serialOf = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569;
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** ตั้งค่า!G10:G17 =INDEX($B$32:$H$32,1,$B$3) ... และ H = INDEX($B$43:$H$43,1,$B$3) */
export const startPos7 = (s: OtSettings, i: number) => s.table7[i]?.[s.pattern - 1] ?? 99;
export const startPos8 = (s: OtSettings, i: number) => s.table8[i]?.[s.pattern - 1] ?? 99;

export interface OtWeek {
  A: number;
  B: number; // จันทร์
  C: number; // ศุกร์
  D: string; E: string; F: string; G: string; H: string; I: string; J: string; K: string; // 8 จุด (index 0..7)
  L: string;
  M: 7 | 8;
  N: number;
  pos: number[]; // O..V
  names: string[]; // W..AD
  spotName: string[]; // AE..AL
  fillOrder: number[]; // AM..AT
  AU: number;
  AV: string;
  AW: number;
  AX: number;
  AY: number;
  streak: number[]; // AZ..BO (16)
}

export const spotCol = (w: OtWeek): string[] => [w.D, w.E, w.F, w.G, w.H, w.I, w.J, w.K];

export class OtPlan {
  private cache = new Map<number, OtWeek>();
  constructor(readonly s: OtSettings) {}

  /** รายชื่อสำหรับสรุป: สรุป!A6:A21 ='ตั้งค่า'!$B10&"" ... (16 แถว) */
  summaryNames(): string[] {
    const out: string[] = [];
    for (let i = 0; i < 16; i++) out.push(this.s.summaryCol[i] ?? "");
    return out;
  }

  week(n: number): OtWeek {
    let w = this.cache.get(n);
    if (!w) {
      w = this.compute(n);
      this.cache.set(n, w);
    }
    return w;
  }

  private compute(A: number): OtWeek {
    const s = this.s;
    const B = s.startMonday + 7 * (A - 1);
    const C = B + 4;
    const M: 7 | 8 = B >= s.eightStart ? 8 : 7;
    const N = M === 8 ? (B - s.eightStart) / 7 : (B - s.startMonday) / 7;

    // O..V: ตำแหน่งในรอบของพนักงานแต่ละคน
    const pos: number[] = [];
    for (let i = 0; i < 8; i++) {
      pos.push(M === 7 ? (startPos7(s, i) === 99 ? 99 : mod(startPos7(s, i) + N, 7)) : mod(startPos8(s, i) + N, 8));
    }
    // W..AD: ชื่อพนักงานที่ทำงานอยู่ ณ วันศุกร์ของสัปดาห์
    const names: string[] = [];
    for (let i = 0; i < 8; i++) {
      const st = s.staff[i];
      if (!st || st.name === "") {
        names.push("");
        continue;
      }
      const okStart = st.start === null || st.start <= C;
      const okEnd = st.last === null || st.last >= C;
      if (okStart && okEnd) names.push(st.name);
      else if (st.rep !== "" && st.repStart !== null && st.repStart <= C) names.push(st.rep);
      else names.push("");
    }
    // AE..AL: ใครอยู่จุดนั้น  =IFERROR(INDEX($W:$AD,1,MATCH(IF(M=7,E,F),$O:$V,0)),"")
    const spotName: string[] = [];
    for (let k = 0; k < 8; k++) {
      const want = M === 7 ? s.spots[k].pos7 : s.spots[k].pos8;
      const idx = pos.indexOf(want);
      spotName.push(idx >= 0 ? names[idx] : "");
    }
    // AM..AT ลำดับเติมคนเมื่อขาด (AS = 99 คงที่)
    const fillOrder: number[] = [];
    for (let k = 0; k < 8; k++) {
      if (k === 6) fillOrder.push(99);
      else fillOrder.push(spotName[k] === "" ? s.spots[k].fill : 99);
    }
    const mn = Math.min(...fillOrder);
    const AU = mn === 99 ? 0 : fillOrder.indexOf(mn) + 1;
    const AW = C >= s.smcOpen ? 1 : 0;
    const AV = AW === 1 && spotName[6] !== "" ? spotName[6] : "";
    const AX = AV !== "" && AU > 0 ? AU : 0;
    const AY = fillOrder.filter((v) => v < 99).length;

    const pick = (k: number) => (spotName[k] !== "" ? spotName[k] : AV !== "" && AU === k + 1 ? AV : "⚠ ว่าง");
    const J = AW === 0 ? "-" : spotName[6] === "" ? "ปิดจุด" : AU > 0 ? "ปิดจุด" : spotName[6];
    const L = AY === 0 ? "" : (AX > 0 ? `ขาดคน: ย้าย ${AV} จากบัตรคิว SMC ไปแทน` : "") + (AY - (AX > 0 ? 1 : 0) > 0 ? " ⚠ ยังมีจุดว่าง" : "");

    // AZ..BO: จำนวนสัปดาห์ติดกันที่อยู่จุดหนัก (E:G) ของแต่ละคนใน สรุป!A6:A21
    const prev = A > 1 ? this.week(A - 1).streak : new Array(16).fill(0);
    const sn = this.summaryNames();
    const heavy = [pick(1), pick(2), pick(3)];
    const streak = sn.map((nm, j) => (nm === "" ? 0 : heavy.includes(nm) ? prev[j] + 1 : 0));

    return {
      A, B, C,
      D: pick(0), E: pick(1), F: pick(2), G: pick(3), H: pick(4), I: pick(5), J, K: pick(7), L,
      M, N, pos, names, spotName, fillOrder, AU, AV, AW, AX, AY, streak,
    };
  }
}

/** MATCH(date, แผนรายสัปดาห์!$B$5:$B$65, 1) — คืนเลขสัปดาห์ (1-based) หรือ null ; ชีตมี 61 แถว เว็บต่อได้ไม่จำกัด */
export function weekOfDate(s: OtSettings, serial: number): number | null {
  if (serial < s.startMonday) return null;
  return Math.floor((serial - s.startMonday) / 7) + 1;
}

export interface OtRow {
  day: number;
  date: number | null;
  P: number; // วันทำงาน
  Q: number | null; // สัปดาห์
  holidayName: string;
  cells: Record<string, string>; // B..N (คอลัมน์ในชีต) ที่เป็นข้อความที่แสดง
  manualCols: string[];
}
export interface OtMonth {
  y: number; // พ.ศ.
  m: number;
  title: string;
  subtitle: string;
  rows: OtRow[];
  signerName: string;
  signerTitle: string;
}

/** คอลัมน์พิมพ์เองได้ในฟอร์มเดือน (ว่างในชีตเดิม): B, D, J, L */
export const OT_MANUAL_COLS = ["B", "D", "J", "L"];
export const OT_EDIT_COLS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
/** คอลัมน์ฟอร์ม → (คอลัมน์ในแผน, ลำดับจุด AX ที่ติดป้าย "(แทน)") */
const FORM_COLS: { col: string; planIdx: number; axMark: number | null; smc?: boolean }[] = [
  { col: "C", planIdx: 0, axMark: 1 },
  { col: "E", planIdx: 1, axMark: 2 },
  { col: "F", planIdx: 2, axMark: 3 },
  { col: "G", planIdx: 3, axMark: 4 },
  { col: "I", planIdx: 4, axMark: 5 },
  { col: "K", planIdx: 5, axMark: 6 },
  { col: "M", planIdx: 6, axMark: null, smc: true },
  { col: "N", planIdx: 7, axMark: 8 },
];

export function computeOtMonth(
  s: OtSettings,
  leaves: OtLeave[],
  manual: Record<string, string>, // key `${col}:${day}`
  y: number,
  m: number,
): OtMonth {
  const plan = new OtPlan(s);
  const nd = daysInMonth(y - 543, m);
  const rows: OtRow[] = [];
  const hol = new Map<number, string>();
  for (const h of s.holidays) if (!hol.has(h.date)) hol.set(h.date, h.name);

  for (let day = 1; day <= 31; day++) {
    if (day > nd) {
      rows.push({ day, date: null, P: 0, Q: null, holidayName: "", cells: {}, manualCols: [] });
      continue;
    }
    const date = serialOf(y - 543, m, day);
    const P = weekdayMon1(date) > 5 || hol.has(date) ? 0 : 1;
    const Q = P === 1 ? weekOfDate(s, date) : null;
    const cells: Record<string, string> = {};
    cells.H = P === 1 ? "จนท." : "";

    for (const fc of FORM_COLS) {
      if (Q === null) {
        cells[fc.col] = "";
        continue;
      }
      if (fc.smc && date < s.smcOpen) {
        cells[fc.col] = "";
        continue;
      }
      const w = plan.week(Q);
      let n = spotCol(w)[fc.planIdx];
      if (fc.smc) n = n.split("-").join("");
      const lv = leaves.filter((l) => l.date === date && l.who === n).length;
      const rp = leaves.filter((l) => l.date === date && l.sub === n).length;
      const first = leaves.find((l) => l.date === date && l.who === n);
      const sub = first ? first.sub : "";
      let out: string;
      if (n === "") out = "";
      else if (lv > 0) out = sub === "" ? `⚠ ${n} ลา` : `${sub} (แทน ${n})`;
      else if (rp > 0) out = "→ ไปช่วยจุดอื่น";
      else out = n + (fc.axMark !== null && w.AX === fc.axMark ? " (แทน)" : "");
      cells[fc.col] = out;
    }
    for (const col of OT_MANUAL_COLS) cells[col] = "";
    cells.O = hol.get(date) ?? "";
    // ช่องที่ผู้จัดพิมพ์เอง/พิมพ์ทับ (ทุกคอลัมน์ B..O ตามที่ชีตเดิมพิมพ์ทับสูตรได้)
    const manualCols: string[] = [];
    for (const col of OT_EDIT_COLS) {
      const k = `${col}:${day}`;
      if (k in manual) {
        cells[col] = manual[k];
        manualCols.push(col);
      }
    }
    rows.push({ day, date, P, Q, holidayName: hol.get(date) ?? "", cells, manualCols });
  }
  return {
    y,
    m,
    title: "ตารางปฏิบัติงานพนักงานวิทยาศาสตร์ (จ้างเหมาบริการ) และตำแหน่งอื่น ๆ หน่วยเจาะเลือดเก็บสิ่งส่งตรวจและ POCT งานห้องปฏิบัติการเวชศาสตร์ชันสูตร FM-CL-05-003-03",
    subtitle: `ประจำเดือน ${s.monthNames[m - 1]} พ.ศ.${y}`,
    rows,
    signerName: s.signerName,
    signerTitle: s.signerTitle,
  };
}

/** ลา-แลกเวร!E (จุดของคนลา) และ F (คนที่อยู่บัตรคิว SMC วันนั้น) */
export function leaveInfo(s: OtSettings, l: OtLeave): { spot: string; smcPerson: string } {
  const plan = new OtPlan(s);
  const headers = s.spots.map((x) => x.name);
  let spot = "";
  if (l.date !== null && l.who !== "") {
    const wk = weekOfDate(s, l.date);
    if (wk === null) spot = "ไม่พบในตารางสัปดาห์นี้";
    else {
      const idx = spotCol(plan.week(wk)).indexOf(l.who);
      spot = idx >= 0 ? headers[idx] : "ไม่พบในตารางสัปดาห์นี้";
    }
  }
  let smcPerson = "";
  if (l.date !== null) {
    if (l.date < s.smcOpen || weekdayMon1(l.date) > 5) smcPerson = "-";
    else {
      const wk = weekOfDate(s, l.date);
      if (wk !== null) smcPerson = plan.week(wk).J.split("ปิดจุด").join("(บัตรคิว SMC ปิดอยู่)");
    }
  }
  return { spot, smcPerson };
}
