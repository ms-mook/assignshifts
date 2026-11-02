import { computeSmcMonth, smcDupCols, onLeave } from "../src/lib/smc/engine";
import { smcSettings as S } from "../fixtures/smc-fixture";
let ok = 0, bad = 0;
const eq = (a: unknown, b: unknown, w: string) => { if (a === b) ok++; else { bad++; console.log("✗", w, "ได้", JSON.stringify(a), "ชีต", JSON.stringify(b)); } };
const m = computeSmcMonth(S, {}, 2569, 12);
eq(m.title, "ตารางเวรปฏิบัติงานหน่วยเจาะเลือดเก็บสิ่งส่งตรวจและ POCT (ห้องเจาะเลือด SMC อาคาร สว. 1 ชั้น 1) FM-CL-05-057-00", "หัวตาราง");
eq(m.subtitle, "ประจำเดือน ธันวาคม พ.ศ.2569", "เดือน");
eq(m.workdays, 20, "วันทำการ 20");
// แถวทำงาน (ชีต ธ.ค.69 แถว 7): B..T
const work = ["จนท.จ้างเหมาฯ","อัมพร","MT full-time","MT full-time","Part-time","","","","จนท.จ้างเหมาฯ","อัมพร","MT full-time","MT full-time","Part-time","","","อัมพร","MT full-time","MT full-time",""];
const off = new Set([5, 6, 7, 10, 12, 13, 19, 20, 26, 27, 31]);
for (const r of m.rows) {
  const exp = off.has(r.day) ? Array(19).fill("") : work;
  "BCDEFGHIJKLMNOPQRST".split("").forEach((c, i) => eq(r.cells[c], exp[i], `วันที่ ${r.day} ${c}`));
  eq(r.V, off.has(r.day) ? 0 : 1, `วันที่ ${r.day} V`);
}
// สรุป X8:AC — อัมพร 20 วัน, ชม. 07.00 = 30, 08.30 = 80, 12.30 = 70, รวม 180 ; คนอื่น 0
const a = m.people[0];
eq(a.name, "อัมพร", "X8"); eq(a.days, 20, "Y8"); eq(a.h0700, 30, "Z8"); eq(a.h0830, 80, "AA8"); eq(a.h1230, 70, "AB8"); eq(a.hTotal, 180, "AC8");
eq(m.people.map((p) => p.name).slice(0, 5).join(","), "อัมพร,จุฑาพร,นิภาพร,วรินทร์รดา,ปวีณา", "ลำดับรายชื่อ X");
eq(m.people.length, 19, "จำนวนรายชื่อ (15 + 4 ผู้แทน)");
// ลา: อัมพรลา 15-16 ธ.ค. มีคนแทน สมพาน → C, K, Q = สมพาน; ไม่มีคนแทน → อัมพร (สีส้มขีดฆ่า)
const iso = (d: string) => Math.round(Date.parse(d + "T00:00:00Z") / 86400000) + 25569;
const S2 = { ...S, leaves: [{ name: "อัมพร", start: iso("2026-12-15"), end: iso("2026-12-16"), type: "ลาพักร้อน", sub: "สมพาน", note: "" }] };
let m2 = computeSmcMonth(S2, {}, 2569, 12);
for (const d of [15, 16]) for (const c of ["C", "K", "Q"]) eq(m2.rows[d - 1].cells[c], "สมพาน", `ลามีคนแทน วันที่ ${d} ${c}`);
eq(m2.rows[16].cells.C, "อัมพร", "หลังลา กลับเป็นอัมพร");
S2.leaves[0].sub = "";
m2 = computeSmcMonth(S2, {}, 2569, 12);
eq(m2.rows[14].cells.C, "อัมพร", "ลาไม่มีคนแทน = ชื่อเดิม");
eq(onLeave(S2, "อัมพร", iso("2026-12-15")), true, "เตือนชื่อที่ลา");
eq(onLeave(S2, "อัมพร", iso("2026-12-17")), false, "พ้นช่วงลา");
// ชื่อซ้ำในช่วงเวลาเดียวกัน
const d1 = computeSmcMonth(S, { "G:1": "อัมพร" }, 2569, 12);
eq([...smcDupCols(S, d1.rows[0].cells)].sort().join(), "C,G", "ชื่อซ้ำ 07.00");
const d2 = computeSmcMonth(S, { "T:1": "จุฑาพร", "G:1": "จุฑาพร" }, 2569, 12);
eq(smcDupCols(S, d2.rows[0].cells).size, 0, "คนละช่วงเวลาไม่ซ้ำ");
console.log(`\nตรวจ ${ok + bad} รายการ — ตรง ${ok} · ไม่ตรง ${bad}`);
process.exit(bad ? 1 : 0);
