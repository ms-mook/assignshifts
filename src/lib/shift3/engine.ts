// เครื่องคำนวณตารางเวร 3 ช่วงเวลา — แปลงสูตรจาก Google Sheet ทีละสูตร
// อ้างอิง: ชีต "ตั้งค่า", "แผนรายสัปดาห์" (ซ่อน), ฟอร์มเดือน (เช่น ม.ค.70), "ลา-แลกเวร"
// ทุกฟังก์ชันมีคอมเมนต์สูตรต้นฉบับกำกับไว้

import { daysInMonth, eomonth, serialFromYMD, weekday2 } from "../sheets-date";
import type {
  LeaveRow,
  ManualCells,
  MonthResult,
  MonthRow,
  MonthSection,
  PlanWeek,
  SectionNo,
  Shift3Settings,
} from "./types";

// ---------- helper ที่เลียนแบบพฤติกรรมฟังก์ชันของชีต ----------

/** การเทียบข้อความใน = / COUNTIF / MATCH ของชีต ไม่สนตัวพิมพ์เล็กใหญ่ */
export function eq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** MOD ของชีต (ผลลัพธ์มีเครื่องหมายตามตัวหาร) */
function mod(n: number, d: number): number {
  return ((n % d) + d) % d;
}

export function colIndex(letter: string): number {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------- ค่าที่คำนวณในชีต ตั้งค่า ----------

/** G13:G25 =MOD(ROW()-13+$B$4-1,13) ; แถว 26 ว่าง */
function startPos13(s: Shift3Settings, i: number): number | null {
  return i < 13 ? mod(i + s.rotationPattern - 1, 13) : null;
}
/** H13:H26 =MOD(ROW()-13+$B$4-1,14) */
function startPos14(s: Shift3Settings, i: number): number {
  return mod(i + s.rotationPattern - 1, 14);
}

/** แผนรายสัปดาห์!B ของสัปดาห์ที่ n */
export function mondayOfWeek(s: Shift3Settings, week: number): number {
  return s.startMonday + 7 * (week - 1);
}

/**
 * MATCH(date, 'แผนรายสัปดาห์'!$B$5:..., 1) — คืนเลขสัปดาห์ (1-based) หรือ null ถ้าก่อนวันเริ่ม
 * ชีตมีสูตรถึงสัปดาห์ 58 และวิธีใช้ข้อ 8 ให้ "ลากสูตรแถวสุดท้ายลงไป" เมื่อต้องการต่อ
 * เว็บจึงคำนวณต่อเนื่องไม่จำกัดจำนวนสัปดาห์ (เท่ากับการลากสูตรลงไปเรื่อยๆ)
 */
export function weekOfDate(s: Shift3Settings, serial: number): number | null {
  if (serial < s.startMonday) return null;
  return Math.floor((serial - s.startMonday) / 7) + 1;
}

/** B7 =IFERROR(MATCH(EOMONTH($B$5,$B$6-1),'แผนรายสัปดาห์'!$B$5:$B$62,1)+1,1) */
export function trainingStartWeek(s: Shift3Settings): number {
  const eom = eomonth(s.newHireStart ?? 0, s.newHireMonths - 1);
  const w = weekOfDate(s, eom);
  return w === null ? 1 : w + 1;
}

/** B9 =$B$7+$B$8 */
export function fourteenStartWeek(s: Shift3Settings): number {
  return trainingStartWeek(s) + s.trainingWeeks;
}

// ---------- แผนรายสัปดาห์ ----------

export class PlanCalculator {
  private cache = new Map<number, PlanWeek>();
  readonly B7: number;
  readonly B9: number;
  /** W13:W26 =$L13&" "&$K13 */
  readonly spotFullNames: string[];

  constructor(readonly s: Shift3Settings) {
    this.B7 = trainingStartWeek(s);
    this.B9 = this.B7 + s.trainingWeeks;
    this.spotFullNames = s.spots.map((sp) => `${sp.room} ${sp.name}`);
  }

  week(n: number): PlanWeek {
    let w = this.cache.get(n);
    if (!w) {
      w = this.compute(n);
      this.cache.set(n, w);
    }
    return w;
  }

  private compute(A: number): PlanWeek {
    const s = this.s;
    const { B7, B9 } = this;
    const monday = mondayOfWeek(s, A); // B
    const friday = monday + 4; // C

    // AL =IF($A5>='ตั้งค่า'!$B$9,14,13)
    const AL = A >= B9 ? 14 : 13;
    // AM =IF(AL5=14,$A5-'ตั้งค่า'!$B$9,$A5-1)
    const AM = AL === 14 ? A - B9 : A - 1;

    // CP..DB =IF($AL5=14,MOD(H+$AM5,14),MOD(G+$AM5,13)) ; DC =IF($AL5=14,MOD($H$26+$AM5,14),-1)
    const pos: number[] = [];
    for (let i = 0; i < 14; i++) {
      if (i < 13) pos.push(AL === 14 ? mod(startPos14(s, i) + AM, 14) : mod((startPos13(s, i) as number) + AM, 13));
      else pos.push(AL === 14 ? mod(startPos14(s, 13) + AM, 14) : -1);
    }

    // CB..CO รายชื่อที่ทำงานอยู่ในสัปดาห์นั้น (เทียบกับวันศุกร์ C5)
    const active = s.persons.map((p) => {
      if (p.name === "") return "";
      const startedOk = p.start === null || p.start <= friday;
      const notLeft = p.lastDay === null || p.lastDay >= friday;
      if (startedOk && notLeft) return p.name;
      if (p.replacement !== "" && p.replacementStart !== null && p.replacementStart <= friday) return p.replacement;
      return "";
    });
    const CO = active[13];

    // BA =IF(AND(AL5=13,$A5>=B7,$A5<B9),1,0)
    const BA = AL === 13 && A >= B7 && A < B9 ? 1 : 0;
    // BB =IF(BA5=1,INDEX('ตั้งค่า'!$R$13:$R$22,$A5-B7+1),-1)
    let BB = -1;
    if (BA === 1) {
      const step = s.training[A - B7];
      if (!step) throw new Error(`INDEX ตั้งค่า!R13:R22 แถว ${A - B7 + 1} ไม่มีค่า`);
      BB = step.code;
    }

    const matchPos = (x: number | null): number => (x === null ? -1 : pos.indexOf(x));
    const nameAtPos = (x: number | null): string => {
      const idx = matchPos(x);
      return idx < 0 ? "" : active[idx];
    };

    // D..P (จุด 0..12)
    // =IF(AND($BA5=1,$BB5=k),$CO5,IFERROR(INDEX($CB5:$CO5,1,MATCH(IF($AL5=14,N,M),$CP5:$DC5,0)),""))
    const s1: string[] = [];
    for (let k = 0; k < 13; k++) {
      if (BA === 1 && BB === k) s1.push(CO);
      else s1.push(nameAtPos(AL === 14 ? s.spots[k].pos14 : s.spots[k].pos13));
    }
    // Q (จุด 13 = OPD ทั่วไป13)
    // =IF($AL5=14,IFERROR(INDEX(CB:CO,MATCH($N$26,CP:DC,0)),""),IF($CO5="","",IF($BA5=1,IFERROR(INDEX(CB:CO,MATCH(INDEX($M$13:$M$26,$BB5+1),CP:DC,0)),""),$CO5)))
    if (AL === 14) s1.push(nameAtPos(s.spots[13].pos14));
    else if (CO === "") s1.push("");
    else if (BA === 1) s1.push(nameAtPos(s.spots[BB]?.pos13 ?? null));
    else s1.push(CO);

    // R =IF(ISODD($A5),B29,B30) ; S =IF(ISODD($A5),B30,B29)
    const odd = A % 2 === 1;
    const R = odd ? s.pairOddKw8 : s.pairOddOpd11;
    const S = odd ? s.pairOddOpd11 : s.pairOddKw8;
    // BC =IF(ISODD($A5),B35,B36)
    const BC = odd ? s.poctAlt1 : s.poctAlt2;

    // COUNTIF({'ตั้งค่า'!$B$34,$BC5},v)>0
    const isPoct = (v: string) => (s.poctOpd !== "" && eq(s.poctOpd, v)) || (BC !== "" && eq(BC, v));

    // BD..BQ =IF(AND(D5<>"",COUNTIF({B34,BC},D5)>0,O<99),O,999)
    const prio = s1.map((v, k) => {
      const o = s.spots[k].fillOrder;
      return v !== "" && isPoct(v) && o !== null && o < 99 ? o : 999;
    });
    // BZ =COUNTIF($BD5:$BQ5,"<999")
    const BZ = prio.filter((p) => p < 999).length;
    // BR/BS =IF(BZ>=n,MATCH(SMALL(BD:BQ,n),BD:BQ,0)-1,-1)
    const sorted = [...prio].sort((a, b) => a - b);
    const BR = BZ >= 1 ? prio.indexOf(sorted[0]) : -1;
    const BS = BZ >= 2 ? prio.indexOf(sorted[1]) : -1;

    // BT/BU/BV =LET(v,IFERROR(INDEX($D5:$Q5,1,MATCH(B40,W13:W26,0)),""),IF(AND(v<>"",COUNTIF({B34,BC},v)=0),v,""))
    const fillVal = (spotName: string) => {
      if (spotName === "") return "";
      const idx = this.spotFullNames.findIndex((n) => eq(n, spotName));
      const v = idx < 0 ? "" : s1[idx] ?? "";
      return v !== "" && !isPoct(v) ? v : "";
    };
    const BT = fillVal(s.fillFrom[0]);
    const BU = fillVal(s.fillFrom[1]);
    const BV = fillVal(s.fillFrom[2]);
    // BW/BX =IF(BZ>=n,IFERROR(INDEX(FILTER(BT:BV,BT:BV<>""),n),""),"")
    const nonEmpty = [BT, BU, BV].filter((v) => v !== "");
    const BW = BZ >= 1 ? nonEmpty[0] ?? "" : "";
    const BX = BZ >= 2 ? nonEmpty[1] ?? "" : "";

    // T..AG (ส่วนที่ 3 จุด k)
    // =IF($BR5=k,$BW5,IF($BS5=k,$BX5,IF(D5="","",IF(COUNTIF({B34,BC},D5)>0,"",IF(AND(BW<>"",D5=BW),"",IF(AND(BX<>"",D5=BX),"",D5))))))
    const s3 = s1.map((v, k) => {
      if (BR === k) return BW;
      if (BS === k) return BX;
      if (v === "") return "";
      if (isPoct(v)) return "";
      if (BW !== "" && eq(v, BW)) return "";
      if (BX !== "" && eq(v, BX)) return "";
      return v;
    });

    // ตรวจสอบ DD / DE / DF
    let chkSame = 0;
    if (A > 1) {
      const prev = this.week(A - 1).s1;
      for (let k = 0; k < 13; k++) if (s1[k] !== "" && eq(s1[k], prev[k])) chkSame++;
    }
    let chkDup = 0;
    for (const v of s1) if (v !== "" && s1.filter((x) => eq(x, v)).length > 1) chkDup++;
    const chkBlank = s1.filter((v) => v === "").length;

    return {
      week: A, monday, friday, AL, AM, pos, active, BA, BB, s1, R, S, BC, prio, BZ, BR, BS,
      BT, BU, BV, BW, BX, s3,
      AH: s.poctKw, // =ตั้งค่า!$B$33
      AI: s.poctOpd, // =ตั้งค่า!$B$34
      AJ: BC, // =$BC5
      chkSame, chkDup, chkBlank,
    };
  }

  /** ค่าในคอลัมน์ของแผนรายสัปดาห์ตามตัวอักษร (D..AJ) */
  value(week: number, letter: string): string {
    const w = this.week(week);
    const c = colIndex(letter);
    if (c >= 3 && c <= 16) return w.s1[c - 3];
    if (letter === "R") return w.R;
    if (letter === "S") return w.S;
    if (c >= 19 && c <= 32) return w.s3[c - 19];
    if (letter === "AH") return w.AH;
    if (letter === "AI") return w.AI;
    if (letter === "AJ") return w.AJ;
    throw new Error(`ไม่มีคอลัมน์ ${letter} ในแผนรายสัปดาห์`);
  }
}

/** หัวคอลัมน์แถว 4 ของแผนรายสัปดาห์ (ใช้ในชีต ลา-แลกเวร ช่อง E) */
export const PLAN_HEADERS_D_Q = [
  "ส1 OPD Key2", "ส1 OPD สว.6", "ส1 OPD สว.7", "ส1 OPD ทั่วไป12", "ส1 OPD เด็ก14", "ส1 OPD รถ15",
  "ส1 OPD รถ16", "ส1 กว. Key1", "ส1 กว. สว./ผส.7", "ส1 กว. เด็ก10", "ส1 กว. รถ11", "ส1 SMC KEY2",
  "ส1 SMC เจาะ1", "ส1 OPD ทั่วไป13",
];

// ---------- ฟอร์มรายเดือน ----------

type CellSource =
  /**
   * train: ช่วงพนักงานใหม่ฝึกเวียนจุด (แผนรายสัปดาห์!BA = 1)
   *  "off" = ช่องนี้ว่างในช่วงฝึก (OPD ทั่วไป13 — ผู้จัดใส่ชื่อเอง)
   *  "on"  = แสดงเฉพาะช่วงฝึก (กว. ทั่วไป 5 — จุดพักของคนที่ถูกพนักงานใหม่เบียด)
   */
  | { kind: "plan"; col: string; train?: "off" | "on" }
  | { kind: "manual" } // =IF($AM8=1,"จนท.","") ผู้จัดเลือกชื่อทับได้
  | { kind: "free" } // เวชกรรมสังคม / SHE เว้นว่างให้ใส่เอง
  | { kind: "empty" }
  | { kind: "chem" }
  | { kind: "molec" }
  | { kind: "b30key1" };

const P = (col: string): CellSource => ({ kind: "plan", col });
/** OPD ทั่วไป13: ว่างในช่วงฝึก · กว. ทั่วไป 5: คนที่ถูกเบียด (ผู้ใช้กำหนด 6 พ.ย. 69) */
const P_OFF = (col: string): CellSource => ({ kind: "plan", col, train: "off" });
const P_ON = (col: string): CellSource => ({ kind: "plan", col, train: "on" });
const M: CellSource = { kind: "manual" };
const F: CellSource = { kind: "free" };
const E: CellSource = { kind: "empty" };

/** แผนที่คอลัมน์ B..AK (index 1..36) ของแต่ละส่วน — ตรงกับสูตรในชีตเดือน */
export const SECTION_MAP: Record<SectionNo, CellSource[]> = {
  1: [
    /*A*/ E, /*B*/ M, /*C*/ P("D"), /*D*/ M, /*E*/ M, /*F*/ M, /*G*/ P("E"), /*H*/ P("F"), /*I*/ E, /*J*/ E,
    /*K*/ E, /*L*/ P("S"), /*M*/ P("G"), /*N*/ P_OFF("Q"), /*O*/ P("H"), /*P*/ P("I"), /*Q*/ P("J"), /*R*/ P("K"),
    /*S*/ M, /*T*/ M, /*U*/ M, /*V*/ P_ON("Q"), /*W*/ E, /*X*/ P("L"), /*Y*/ P("R"), /*Z*/ E, /*AA*/ P("M"),
    /*AB*/ P("N"), /*AC*/ M, /*AD*/ P("O"), /*AE*/ P("P"), /*AF*/ E, /*AG*/ E, /*AH*/ F, /*AI*/ F, /*AJ*/ F, /*AK*/ F,
  ],
  2: [
    /*A*/ E, /*B*/ P("S"), /*C*/ P("D"), /*D*/ M, /*E*/ M, /*F*/ M, /*G*/ P("E"), /*H*/ P("F"), /*I*/ E, /*J*/ E,
    /*K*/ { kind: "chem" }, /*L*/ { kind: "molec" }, /*M*/ P("G"), /*N*/ P_OFF("Q"), /*O*/ P("H"), /*P*/ P("I"),
    /*Q*/ P("J"), /*R*/ P("K"), /*S*/ M, /*T*/ M, /*U*/ M, /*V*/ P_ON("Q"), /*W*/ E, /*X*/ P("L"), /*Y*/ P("R"), /*Z*/ E,
    /*AA*/ P("M"), /*AB*/ P("N"), /*AC*/ M, /*AD*/ P("O"), /*AE*/ P("P"), /*AF*/ E, /*AG*/ E, /*AH*/ F, /*AI*/ F,
    /*AJ*/ F, /*AK*/ F,
  ],
  3: [
    /*A*/ E, /*B*/ { kind: "b30key1" }, /*C*/ P("T"), /*D*/ M, /*E*/ M, /*F*/ M, /*G*/ P("U"), /*H*/ P("V"),
    /*I*/ E, /*J*/ E, /*K*/ P("AI"), /*L*/ P("AJ"), /*M*/ P("W"), /*N*/ P_OFF("AG"), /*O*/ P("X"), /*P*/ P("Y"),
    /*Q*/ P("Z"), /*R*/ P("AA"), /*S*/ M, /*T*/ M, /*U*/ M, /*V*/ P_ON("AG"), /*W*/ E, /*X*/ P("AB"), /*Y*/ E,
    /*Z*/ P("AH"), /*AA*/ P("AC"), /*AB*/ P("AD"), /*AC*/ M, /*AD*/ P("AE"), /*AE*/ P("AF"), /*AF*/ E, /*AG*/ E,
    /*AH*/ F, /*AI*/ F, /*AJ*/ F, /*AK*/ F,
  ],
};

/**
 * คอลัมน์ที่สูตรตรวจ "ชื่อนี้ถูกเลือกไปไว้ช่องอื่นในแถวเดียวกันแล้ว"
 * ส่วนที่ 1: B, D:F, S:U, AC, AH:AK  · ส่วนที่ 2: AH:AK  · ส่วนที่ 3: ไม่ตรวจ
 */
export const DEDUPE_COLS: Record<SectionNo, string[]> = {
  1: ["B", "D", "E", "F", "S", "T", "U", "AC", "AH", "AI", "AJ", "AK"],
  2: ["AH", "AI", "AJ", "AK"],
  3: [],
};

/** คอลัมน์ที่ผู้จัดเลือก/พิมพ์เองได้ (ช่อง จนท. + เวชกรรมสังคม/SHE) */
export function editableCols(section: SectionNo): number[] {
  return SECTION_MAP[section]
    .map((src, i) => (src.kind === "manual" || src.kind === "free" ? i : -1))
    .filter((i) => i >= 0);
}

export function manualKey(section: SectionNo, colIdx: number, day: number): string {
  return `${section}:${colLetter(colIdx)}:${day}`;
}

const TITLE_1 =
  "ตารางเวรปฏิบัติงานนักเทคนิคการแพทย์และพยาบาล หน่วยเจาะเลือดเก็บสิ่งส่งตรวจและ POCT เวลา 06.00 - 16.30 (ส่วนที่ 1) FM-CL-05-002-00";
const TIME_LABEL: Record<SectionNo, string> = { 1: "06.00 - 8.30 น.", 2: "08.30 - 12.30 น.", 3: "12.30 - 16.30 น." };

export function computeMonth(
  settings: Shift3Settings,
  leaves: LeaveRow[],
  manual: ManualCells,
  yearBE: number,
  month: number,
  plan: PlanCalculator = new PlanCalculator(settings),
): MonthResult {
  const yearCE = yearBE - 543;
  const nDays = daysInMonth(yearCE, month);
  const holidaySet = new Set(settings.holidays.map((h) => h.date).filter((d): d is number => d !== null));

  // ="ประจำเดือน "&INDEX('ตั้งค่า'!$A$46:$A$57,$AO$1)&" พ.ศ."&$AP$1
  const subtitle = `ประจำเดือน ${settings.monthNames[month - 1] ?? ""} พ.ศ.${yearBE}`;

  const sections: MonthSection[] = ([1, 2, 3] as SectionNo[]).map((sec) => {
    const map = SECTION_MAP[sec];
    const dedupe = DEDUPE_COLS[sec].map(colIndex);
    const rows: MonthRow[] = [];
    for (let day = 1; day <= 31; day++) {
      // A =IF(ROW()-7<=DAY(EOMONTH(DATE(..),0)),DATE(...,ROW()-7),"")
      const date = day <= nDays ? serialFromYMD(yearCE, month, day) : null;
      // AM =IF($A8="",0,IF(OR(WEEKDAY($A8,2)>5,COUNTIF('ตั้งค่า'!$H$45:$H$85,$A8)>0),0,1))
      const workday: 0 | 1 = date === null ? 0 : weekday2(date) > 5 || holidaySet.has(date) ? 0 : 1;
      // AN =IF($AM8=1,IFERROR(MATCH($A8,'แผนรายสัปดาห์'!$B$5:$B$62,1),""),"")
      const week = workday === 1 && date !== null ? weekOfDate(settings, date) : null;

      const cells: string[] = new Array(37).fill("");
      cells[0] = date === null ? "" : String(day);
      const manualCols: number[] = [];

      // รอบแรก: ช่องที่ผู้จัดกรอกเอง (สูตรอื่นในแถวอ้างถึงค่านี้)
      map.forEach((src, ci) => {
        if (src.kind !== "manual" && src.kind !== "free") return;
        const key = manualKey(sec, ci, day);
        if (key in manual) {
          cells[ci] = manual[key];
          manualCols.push(ci);
        } else if (src.kind === "manual") {
          cells[ci] = workday === 1 ? "จนท." : "";
        }
      });

      const inDedupe = (name: string) => dedupe.some((ci) => cells[ci] !== "" && eq(cells[ci], name));

      // แม่แบบสูตรลา/แลกเวร
      const leaveCell = (n: string, checkDedupe: boolean): string => {
        if (n === "") return "";
        const same = leaves.filter((l) => l.date === date);
        const lvRows = same.filter((l) => eq(l.name, n));
        const lv = lvRows.length;
        const rp = same.filter((l) => eq(l.replacement, n)).length;
        const s = lvRows.length > 0 ? lvRows[0].replacement : "";
        if (checkDedupe && (inDedupe(n) || (lv > 0 && s !== "" && inDedupe(s)))) return "";
        if (lv > 0) return s === "" ? `⚠ ${n} ลา` : `${s} (แทน ${n})`;
        if (rp > 0) return "→ ไปช่วยจุดอื่น";
        return n;
      };

      map.forEach((src, ci) => {
        switch (src.kind) {
          case "plan": {
            // แท็บเดือน: =IF(IFERROR(INDEX('แผนรายสัปดาห์'!$BA$5:$BA$62,$AN8)=1,FALSE), …)
            const training = week !== null && plan.week(week).BA === 1;
            if (week === null || (src.train === "off" && training) || (src.train === "on" && !training)) cells[ci] = "";
            else cells[ci] = leaveCell(plan.value(week, src.col), sec !== 3);
            break;
          }
          case "b30key1":
            cells[ci] = week === null ? "" : leaveCell(settings.b30AtKey1 === "ใช่" ? settings.pairOddOpd11 : "", false);
            break;
          case "chem":
            cells[ci] = workday === 1 && date !== null && weekday2(date) <= 3 ? "Chem" : "";
            break;
          case "molec":
            cells[ci] = workday === 1 && date !== null && weekday2(date) <= 2 ? "Molec" : "";
            break;
          default:
            break;
        }
      });

      // ผู้จัดพิมพ์ทับช่องสูตรเอง (เหมือนพิมพ์ทับสูตรในชีต) — ไม่มีผลกับช่องอื่นในแถว
      map.forEach((src, ci) => {
        if (ci === 0 || src.kind === "manual" || src.kind === "free") return;
        const key = manualKey(sec, ci, day);
        if (date !== null && key in manual) {
          cells[ci] = manual[key];
          manualCols.push(ci);
        }
      });

      rows.push({ day, date, workday, week, cells, manualCols });
    }
    return {
      section: sec,
      // =SUBSTITUTE($A$1,"(ส่วนที่ 1)","(ส่วนที่ n)")
      title: TITLE_1.replace("(ส่วนที่ 1)", `(ส่วนที่ ${sec})`),
      subtitle,
      timeLabel: TIME_LABEL[sec],
      rows,
    };
  });

  return { yearBE, month, sections, signerName: settings.signerName, signerTitle: settings.signerTitle };
}

/** ชีต ลา-แลกเวร ช่อง E: จุดของคนลา ช่วงเช้า */
export function leaveSpotOf(plan: PlanCalculator, date: number | null, name: string): string {
  if (date === null || name === "") return "";
  const w = weekOfDate(plan.s, date);
  if (w !== null) {
    const idx = plan.week(w).s1.findIndex((v) => eq(v, name));
    if (idx >= 0) return PLAN_HEADERS_D_Q[idx].replace("ส1 ", "");
  }
  return [plan.s.pairOddKw8, plan.s.pairOddOpd11].some((p) => eq(p, name)) ? "คู่สลับ กว.8/OPD11" : "ไม่พบในสัปดาห์นี้";
}

/** ชีต ลา-แลกเวร ช่อง F: คนที่อยู่ OPD ทั่วไป12 วันนั้น */
export function suggestedReplacement(plan: PlanCalculator, date: number | null): string {
  if (date === null) return "";
  if (weekday2(date) > 5) return "-";
  const w = weekOfDate(plan.s, date);
  return w === null ? "" : plan.week(w).s1[3];
}
