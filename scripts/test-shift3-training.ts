// กติกาช่วงพนักงานใหม่ฝึกเวียนจุด (แผนรายสัปดาห์!BA = 1) — ผู้ใช้กำหนด 6 พ.ย. 69
//  - คนที่ถูกพนักงานใหม่เบียด ไปอยู่ กว. ทั่วไป 5 (คอลัมน์ V) ทั้ง 3 ช่วงเวลา
//  - OPD ทั่วไป13 (คอลัมน์ N) ว่างไว้ให้ผู้จัดใส่ชื่อเอง
//  - นอกช่วงฝึก: V ว่างเสมอ · N เป็นไปตามสูตรเดิม
// รัน: npx tsx scripts/test-shift3-training.ts
/* eslint-disable @typescript-eslint/no-var-requires */
declare const require: any;
declare const process: any;
declare const __dirname: string;
const fs = require("fs");
const path = require("path");
import { PlanCalculator, computeMonth, manualKey } from "../src/lib/shift3/engine";
import { parseSettings, type Grid } from "../src/lib/shift3/parse";

const book: Record<string, string[][]> = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "shift3-sheet.json"), "utf8"));
const grid: Grid = book["ตั้งค่า"].map((r) => [...r]);
const s = parseSettings(grid);
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => (c ? pass++ : (fail++, console.log("  ✗ " + m)));

for (const [label, start] of [["ตามชีต", null], ["เริ่ม 4 ม.ค. 70", "2027-01-04"]] as const) {
  const st = start ? { ...s, newHireStart: Date.UTC(2027, 0, 4) / 86400000 + 25569, persons: s.persons.map((p, i) => (i === 13 ? { ...p, start: Date.UTC(2027, 0, 4) / 86400000 + 25569 } : p)) } : s;
  const plan = new PlanCalculator(st);
  let trainDays = 0, moved = 0;
  for (const [y, m] of [[2569, 12], ...Array.from({ length: 12 }, (_, i) => [2570, i + 1])] as [number, number][]) {
    const r = computeMonth(st, [], {}, y, m, plan);
    for (const sec of r.sections) for (const row of sec.rows) {
      if (row.week === null) { ok(row.cells[21] === "", `${label} ${m}/${y} วันหยุด V ต้องว่าง`); continue; }
      const training = plan.week(row.week).BA === 1;
      const n = row.cells[13], v = row.cells[21];
      const planName = plan.value(row.week, sec.section === 3 ? "AG" : "Q");
      if (training) {
        trainDays++;
        ok(n === "", `${label} ${m}/${y} ส่วน ${sec.section} วัน ${row.day}: ช่วงฝึก OPD ทั่วไป13 ต้องว่าง (ได้ "${n}")`);
        ok(v === planName, `${label} ${m}/${y} ส่วน ${sec.section} วัน ${row.day}: ช่วงฝึก กว.ทั่วไป5 ต้องเป็น "${planName}" (ได้ "${v}")`);
        ok(v !== "พนักงานใหม่", `${label}: พนักงานใหม่ต้องไม่อยู่จุดพัก`);
        if (v) {
          moved++;
          ok(row.cells.filter((c) => c === v).length === 1, `${label} ${m}/${y} ส่วน ${sec.section} วัน ${row.day}: "${v}" ซ้ำในแถว`);
        }
      } else {
        ok(v === "", `${label} ${m}/${y} ส่วน ${sec.section} วัน ${row.day}: นอกช่วงฝึก กว.ทั่วไป5 ต้องว่าง (ได้ "${v}")`);
        ok(n === planName, `${label} ${m}/${y} ส่วน ${sec.section} วัน ${row.day}: นอกช่วงฝึก OPD ทั่วไป13 ต้องตามแผน`);
      }
    }
  }
  ok(trainDays > 0 && moved > 0, `${label}: ต้องมีวันฝึกและมีคนถูกย้าย (วันฝึก ${trainDays}, ย้าย ${moved})`);
  // หลังเข้ารอบ 14 คน: ทั่วไป 5 ว่าง, OPD ทั่วไป13 มีคน
  const after = computeMonth(st, [], {}, 2570, 9, plan);
  ok(after.sections[0].rows.every((r) => r.cells[21] === ""), `${label}: ก.ย.70 (รอบ 14 คน) ทั่วไป5 ต้องว่าง`);
  ok(after.sections[0].rows.some((r) => r.cells[13] !== ""), `${label}: ก.ย.70 (รอบ 14 คน) OPD ทั่วไป13 ต้องมีคน`);
  console.log(`${label}: วันฝึก (นับ 3 ช่วงเวลา) ${trainDays} · ย้ายไป ทั่วไป5 ${moved}`);
}

// ผู้จัดใส่ชื่อ OPD ทั่วไป13 เองในช่วงฝึกได้ (เก็บเป็นช่องพิมพ์ทับ)
{
  const plan = new PlanCalculator(s);
  const r0 = computeMonth(s, [], {}, 2570, 4, plan);
  const row = r0.sections[0].rows.find((r) => r.week !== null && plan.week(r.week).BA === 1)!;
  const manual = { [manualKey(1, 13, row.day)]: "ทดสอบชื่อ" };
  const r1 = computeMonth(s, [], manual, 2570, 4, plan);
  const row1 = r1.sections[0].rows[row.day - 1];
  ok(row1.cells[13] === "ทดสอบชื่อ" && row1.manualCols.includes(13), "ผู้จัดใส่ชื่อ OPD ทั่วไป13 เองในช่วงฝึกได้");
  ok(row1.cells[21] === row.cells[21], "ใส่ชื่อ OPD ทั่วไป13 เองแล้ว จุดพัก ทั่วไป5 ยังเหมือนเดิม");
}
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
if (fail > 0) process.exit(1);
