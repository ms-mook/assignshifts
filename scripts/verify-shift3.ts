// ตรวจผลเครื่องคำนวณเทียบกับค่าจริงในชีต (fixtures/shift3-sheet.json ที่ export จาก Google Sheet)
// - แผนรายสัปดาห์: ทุกสัปดาห์ (1-58) ทุกคอลัมน์ที่มีค่า
// - ฟอร์มรายเดือน 12 เดือน × 3 ส่วน × ทุกวัน × คอลัมน์ A..AK
// - ชีต สรุป: ตารางนับสัปดาห์ + แถวตรวจสอบ
// รัน: npx tsx scripts/verify-shift3.ts  (หรือ ts-node --transpile-only)

/* eslint-disable @typescript-eslint/no-var-requires */
declare const require: any;
declare const process: any;
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

import { PlanCalculator, computeMonth, colIndex, colLetter, editableCols, manualKey, eq } from "../src/lib/shift3/engine";
import { parseSettings, parseLeaves, type Grid } from "../src/lib/shift3/parse";
import { toSerial } from "../src/lib/sheets-date";
import type { ManualCells, SectionNo } from "../src/lib/shift3/types";

const fixture = process.argv[2] ?? path.join(__dirname, "..", "fixtures", "shift3-sheet.json");
const book: Record<string, string[][]> = JSON.parse(fs.readFileSync(fixture, "utf8"));

// ไฟล์ export ตัดแถวว่างท้ายชีต ตั้งค่า ออก — วาง "ผู้จัดทำ" กลับไปที่แถว 88-90 ตามชีตจริง
const settingsGrid: Grid = book["ตั้งค่า"].map((r) => [...r]);
const signerIdx = settingsGrid.findIndex((r) => r[0] === "ชื่อผู้จัดทำ");
if (signerIdx >= 0 && signerIdx !== 88) {
  const tail = settingsGrid.splice(signerIdx - 1, 3);
  while (settingsGrid.length < 87) settingsGrid.push([]);
  settingsGrid.push(...tail);
}
const settings = parseSettings(settingsGrid);
const leaves = parseLeaves(book["ลา-แลกเวร"].slice(4));
const plan = new PlanCalculator(settings);

let failures = 0;
let checks = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 60) console.log("  ✗ " + msg);
};

// ---------- B7 / B9 ----------
checks += 2;
if (String(plan.B7) !== settingsGrid[6][1]) fail(`B7 = ${plan.B7} ชีต = ${settingsGrid[6][1]}`);
if (String(plan.B9) !== settingsGrid[8][1]) fail(`B9 = ${plan.B9} ชีต = ${settingsGrid[8][1]}`);

// ---------- แผนรายสัปดาห์ ----------
const planGrid = book["แผนรายสัปดาห์"];
const header = planGrid[0];
const weeks = planGrid.slice(1).filter((r) => /^\d+$/.test(r[0] ?? ""));
console.log(`แผนรายสัปดาห์: ${weeks.length} สัปดาห์`);
for (const row of weeks) {
  const A = Number(row[0]);
  const w = plan.week(A);
  const get = (L: string) => row[colIndex(L)] ?? "";
  const expect = (L: string, v: string | number) => {
    checks++;
    if (String(v) !== get(L)) fail(`สัปดาห์ ${A} ${L} (${header[colIndex(L)] ?? ""}) เว็บ="${v}" ชีต="${get(L)}"`);
  };
  checks++;
  if (toSerial(get("B")) !== w.monday) fail(`สัปดาห์ ${A} B`);
  checks++;
  if (toSerial(get("C")) !== w.friday) fail(`สัปดาห์ ${A} C`);
  for (let c = colIndex("D"); c <= colIndex("AJ"); c++) expect(colLetter(c), plan.value(A, colLetter(c)));
  expect("AL", w.AL);
  expect("AM", w.AM);
  expect("BA", w.BA);
  expect("BB", w.BB);
  expect("BC", w.BC);
  w.prio.forEach((p, k) => expect(colLetter(colIndex("BD") + k), p));
  expect("BR", w.BR);
  expect("BS", w.BS);
  expect("BT", w.BT);
  expect("BU", w.BU);
  expect("BV", w.BV);
  expect("BW", w.BW);
  expect("BX", w.BX);
  expect("BZ", w.BZ);
  w.active.forEach((n, k) => expect(colLetter(colIndex("CB") + k), n));
  w.pos.forEach((p, k) => expect(colLetter(colIndex("CP") + k), p));
  expect("DD", w.chkSame);
  expect("DE", w.chkDup);
  expect("DF", w.chkBlank);
}

// ---------- ฟอร์มรายเดือน ----------
const monthSheets = Object.keys(book).filter((k) => /^[\u0E00-\u0E7F.]+\d{2}$/.test(k) && book[k][0]?.[colIndex("AO")]);
for (const name of monthSheets) {
  const g = book[name];
  const month = Number(g[0][colIndex("AO")]);
  const yearBE = Number(g[0][colIndex("AP")]);
  // หาแถวข้อมูลของ 3 ส่วน (แถวหลัง "เวลา" ที่ขึ้นต้นด้วยเลขวัน)
  const sectionsRows: Map<number, string[]>[] = [];
  let cur: Map<number, string[]> | null = null;
  for (const r of g) {
    if (r[0] === "เวลา") {
      cur = new Map();
      sectionsRows.push(cur);
      continue;
    }
    if (cur && /^\d+$/.test(r[0] ?? "")) cur.set(Number(r[0]), r);
    else if (cur && (r[0] ?? "") !== "") cur = null;
  }
  if (sectionsRows.length !== 3) {
    fail(`${name}: พบ ${sectionsRows.length} ส่วน`);
    continue;
  }
  // ช่องที่ผู้จัดเลือกเองในชีต = ค่าที่ต่างจากค่าเริ่มต้นของสูตร
  const manual: ManualCells = {};
  const base = computeMonth(settings, leaves, {}, yearBE, month, plan);
  base.sections.forEach((sec, si) => {
    for (const row of sec.rows) {
      const sheetRow = sectionsRows[si].get(row.day);
      if (!sheetRow) continue;
      for (const ci of editableCols(sec.section as SectionNo)) {
        const v = sheetRow[ci] ?? "";
        if (v !== row.cells[ci]) manual[manualKey(sec.section as SectionNo, ci, row.day)] = v;
      }
    }
  });
  const res = computeMonth(settings, leaves, manual, yearBE, month, plan);
  let monthFail = 0;
  res.sections.forEach((sec, si) => {
    for (const row of sec.rows) {
      const sheetRow = sectionsRows[si].get(row.day);
      if (!sheetRow) {
        // ชีต export ตัดแถวว่างทิ้ง: ต้องเป็นแถวที่ว่างทั้งแถวเท่านั้น
        checks++;
        if (row.cells.some((c) => c !== "")) fail(`${name} ส่วน ${sec.section} วัน ${row.day}: ชีตไม่มีแถวนี้ แต่เว็บมีค่า`);
        continue;
      }
      for (let ci = 0; ci < 37; ci++) {
        checks++;
        const sv = sheetRow[ci] ?? "";
        if (sv !== row.cells[ci]) {
          monthFail++;
          fail(`${name} ส่วน ${sec.section} วัน ${row.day} คอลัมน์ ${colLetter(ci)} เว็บ="${row.cells[ci]}" ชีต="${sv}"`);
        }
      }
      // AM/AN (ส่วน 1-2) หรือ AP/AQ (ส่วน 3) ถ้ามีใน export
      const wdCol = sec.section === 3 ? colIndex("AP") : colIndex("AM");
      const sw = sheetRow[wdCol];
      if (sw !== undefined && sw !== "") {
        checks++;
        if (sw !== String(row.workday)) fail(`${name} ส่วน ${sec.section} วัน ${row.day} workday`);
        checks++;
        if ((sheetRow[wdCol + 1] ?? "") !== (row.week === null ? "" : String(row.week)))
          fail(`${name} ส่วน ${sec.section} วัน ${row.day} week เว็บ=${row.week} ชีต=${sheetRow[wdCol + 1]}`);
      }
    }
  });
  // หัวเรื่อง
  checks++;
  if (g[1][0] !== res.sections[0].subtitle) fail(`${name} ชื่อเดือน "${res.sections[0].subtitle}" vs "${g[1][0]}"`);
  console.log(
    `${name}: ${monthFail === 0 ? "ตรงทุกช่อง" : `ไม่ตรง ${monthFail} ช่อง`} (ช่องเลือกเองในชีต ${Object.keys(manual).length} ช่อง)`,
  );
}

// ---------- ชีต สรุป ----------
const sum = book["สรุป"];
const from = toSerial(sum[1][1])!;
const to = toSerial(sum[2][1])!;
const people = sum.slice(5, 19);
for (const r of people) {
  const name = r[0];
  for (let k = 0; k < 14; k++) {
    let n = 0;
    for (let A = 1; A <= 58; A++) {
      const w = plan.week(A);
      if (w.monday >= from && w.monday <= to && eq(w.s1[k], name)) n++;
    }
    checks++;
    if (String(n) !== r[k + 1]) fail(`สรุป ${name} จุด ${k} เว็บ=${n} ชีต=${r[k + 1]}`);
  }
}

console.log(`\nตรวจทั้งหมด ${checks} รายการ — ${failures === 0 ? "ตรงกับชีต 100%" : `ไม่ตรง ${failures} รายการ`}`);
process.exit(failures === 0 ? 0 : 1);
