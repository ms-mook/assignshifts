// ทดสอบกรณีที่ข้อมูลจริงในชีตยังไม่มี (การลา, ช่องเลือกเอง, ลาออก/คนแทน)
// ผลที่คาดหวังเขียนตามสูตรในชีตทีละขั้น
declare const require: any;
declare const process: any;
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

import { PlanCalculator, computeMonth, colIndex, manualKey } from "../src/lib/shift3/engine";
import { parseSettings, type Grid } from "../src/lib/shift3/parse";
import { serialFromYMD } from "../src/lib/sheets-date";
import type { LeaveRow, Shift3Settings } from "../src/lib/shift3/types";

const book = JSON.parse(fs.readFileSync(process.argv[2] ?? path.join(__dirname, "..", "fixtures", "shift3-sheet.json"), "utf8"));
const base: Shift3Settings = parseSettings(book["ตั้งค่า"] as Grid);
let fails = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : ` — ได้ ${JSON.stringify(got)} ต้องการ ${JSON.stringify(want)}`}`);
}
const C = (L: string) => colIndex(L);
const d4jan = serialFromYMD(2027, 1, 4); // จันทร์ 4 ม.ค.70 สัปดาห์ 6

// สัปดาห์ 6: OPD Key2 (C ในส่วน 1) = สาวิลักษณ์ ตามชีตจริง
const plain = computeMonth(base, [], {}, 2570, 1);
const row = (r: ReturnType<typeof computeMonth>, sec: number, day: number) => r.sections[sec - 1].rows[day - 1].cells;
check("ม.ค.70 วันที่ 4 ส่วน 1 C (OPD Key2)", row(plain, 1, 4)[C("C")], "สาวิลักษณ์");
const tw12 = row(plain, 1, 4)[C("M")]; // OPD ทั่วไป12

// 1) ลาโดยยังไม่มีคนแทน
const lv1: LeaveRow[] = [{ date: d4jan, name: "สาวิลักษณ์", replacement: "", type: "ลาพักผ่อน", note: "" }];
const r1 = computeMonth(base, lv1, {}, 2570, 1);
check("ลาไม่มีคนแทน ส่วน 1", row(r1, 1, 4)[C("C")], "⚠ สาวิลักษณ์ ลา");
check("ลาไม่มีคนแทน ส่วน 2", row(r1, 2, 4)[C("C")], "⚠ สาวิลักษณ์ ลา");
check("ลาไม่มีคนแทน ส่วน 3", row(r1, 3, 4)[C("C")], "⚠ สาวิลักษณ์ ลา");
check("วันอื่นไม่กระทบ", row(r1, 1, 5)[C("C")], "สาวิลักษณ์");

// 2) ลาและมีคนแทน = คนที่อยู่ OPD ทั่วไป12
const lv2: LeaveRow[] = [{ date: d4jan, name: "สาวิลักษณ์", replacement: tw12, type: "", note: "" }];
const r2 = computeMonth(base, lv2, {}, 2570, 1);
check("มีคนแทน → ชื่อ (แทน ...)", row(r2, 1, 4)[C("C")], `${tw12} (แทน สาวิลักษณ์)`);
check("จุดเดิมของคนแทน", row(r2, 1, 4)[C("M")], "→ ไปช่วยจุดอื่น");

// 3) เลือกชื่อในช่อง จนท. ส่วนที่ 1 (OPD Key1 = B) → ชื่อหายจากจุดเดิมเฉพาะส่วนที่ 1
const man = { [manualKey(1, C("B"), 4)]: "สาวิลักษณ์" };
const r3 = computeMonth(base, [], man, 2570, 1);
check("ช่อง B แสดงชื่อที่เลือก", row(r3, 1, 4)[C("B")], "สาวิลักษณ์");
check("จุดเดิมว่างในส่วน 1", row(r3, 1, 4)[C("C")], "");
check("ส่วน 2 ไม่กระทบ", row(r3, 2, 4)[C("C")], "สาวิลักษณ์");
// เลือก MT-RN มาใส่ช่องเดิมไม่ได้ เพราะ C เป็นสูตร — ตรงกับชีต (ช่องว่างให้เลือก MT-RN ได้คือช่อง จนท.)

// 3b) คนลาแต่คนแทนถูกเลือกไปอยู่ช่อง จนท. แล้ว → ว่าง
const r3b = computeMonth(base, lv2, { [manualKey(1, C("D"), 4)]: tw12 }, 2570, 1);
check("คนแทนอยู่ช่องเลือกเองแล้ว → ว่าง", row(r3b, 1, 4)[C("C")], "");
check("ส่วน 3 ไม่ตรวจซ้ำ", row(r3b, 3, 4)[C("C")], `${tw12} (แทน สาวิลักษณ์)`);

// 4) วันหยุดเพิ่ม → แถวว่าง
const s4 = { ...base, holidays: [...base.holidays, { date: d4jan, name: "ทดสอบ" }] };
const r4 = computeMonth(s4, [], {}, 2570, 1);
check("วันหยุด workday=0", r4.sections[0].rows[3].workday, 0);
check("วันหยุดไม่มีชื่อ", row(r4, 1, 4).slice(1).every((c) => c === ""), true);

// 5) ลาออก + คนแทน (สูตร CB..CO เทียบวันศุกร์ของสัปดาห์)
const fri = serialFromYMD(2027, 1, 8);
const s5: Shift3Settings = {
  ...base,
  persons: base.persons.map((p) =>
    p.name === "สาวิลักษณ์" ? { ...p, lastDay: fri - 1, replacement: "คนใหม่ทดสอบ", replacementStart: fri } : p,
  ),
};
const p5 = new PlanCalculator(s5);
check("ลาออกก่อนศุกร์ → คนแทนรับตำแหน่งเดิม", p5.week(6).s1[0], "คนใหม่ทดสอบ");
check("สัปดาห์ก่อนหน้ายังเป็นคนเดิม", p5.week(5).s1.includes("สาวิลักษณ์"), true);
const s5b: Shift3Settings = {
  ...base,
  persons: base.persons.map((p) => (p.name === "สาวิลักษณ์" ? { ...p, lastDay: fri - 1 } : p)),
};
check("ลาออกไม่มีคนแทน → จุดว่าง", new PlanCalculator(s5b).week(6).s1[0], "");

// 6) สัปดาห์ที่เกิน 58 (ลากสูตรต่อ) ยังวนต่อแบบ 14 คน
const p = new PlanCalculator(base);
check("สัปดาห์ 72 = สัปดาห์ 58 + 14 (รอบ 14)", p.week(72).s1, p.week(58).s1);

console.log(fails === 0 ? "\nผ่านทุกกรณี" : `\nไม่ผ่าน ${fails} กรณี`);
process.exit(fails ? 1 : 0);
