import { computeKeyMonth, keyLeaveSpot } from "../src/lib/key/engine";
import { keySettings, keyDec69, keyDec69Counts } from "../fixtures/key-fixture";
let ok = 0, bad = 0;
const eq = (a: unknown, b: unknown, w: string) => { if (a === b) ok++; else { bad++; console.log("✗", w, "ได้", JSON.stringify(a), "ชีต", JSON.stringify(b)); } };
const m = computeKeyMonth(keySettings, {}, 2569, 12);
eq(m.subtitle, "ประจำเดือน ธันวาคม พ.ศ.2569", "หัวเรื่อง");
eq(m.title, "ตารางเวรปฏิบัติงานเจ้าหน้าที่ประจำ(นอกเวลาราชการ) หน่วยเจาะเลือดเก็บสิ่งส่งตรวจและ POCT เวลา 06.00 - 08.30 น.     FM-CL-05-001-03", "ชื่อหัวตาราง");
for (const e of keyDec69) {
  const r = m.rows[e.day - 1];
  for (const c of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"]) eq(r.cells[c], (e as any)[c] ?? "", `ธ.ค.69 วันที่ ${e.day} ${c}`);
  eq(r.Q, e.Q, `วันที่ ${e.day} Q`);
  eq(r.R, e.R, `วันที่ ${e.day} R`);
}
for (const d of m.dayCounts) eq(d.count, keyDec69Counts[d.name], `สรุป ${d.name}`);
eq(m.dayCounts.length, 13, "จำนวนชื่อในสรุป");
eq(JSON.stringify(m.checks), JSON.stringify({ dup: 0, vacancy: 0, onHoliday: 0, unknown: 0, status: "✓ ปกติ" }), "ตรวจสอบตารางเวร");
// ลา: จีรินันท์ลา 15 ธ.ค. ยังไม่มีผู้แทน → "ลา" + หมายเหตุ, มีผู้แทน → ชื่อผู้แทน
const d15 = keyDec69[14];
const s2 = { ...keySettings, leaves: [{ date: Math.round(Date.parse("2026-12-15T00:00:00Z") / 86400000) + 25569, who: "สมพาน", sub: "", note: "" }] };
let mm = computeKeyMonth(s2, {}, 2569, 12);
eq(mm.rows[14].cells.F, "ลา", "ลาไม่มีผู้แทน → ลา");
eq(mm.rows[14].cells.P, "สมพาน ลา", "หมายเหตุลา");
eq(mm.checks.vacancy, 1, "ตำแหน่งว่าง 1");
s2.leaves[0].sub = "ปณิชา";
mm = computeKeyMonth(s2, {}, 2569, 12);
eq(mm.rows[14].cells.F, "ปณิชา", "มีผู้แทน");
eq(mm.rows[14].cells.P, "สมพาน ลา→ปณิชา", "หมายเหตุลา→ผู้แทน");
eq(keyLeaveSpot(s2, s2.leaves[0]), "OPD", "จุดที่ลา (สมพาน สัปดาห์ 2 = F = OPD)");
eq(keyLeaveSpot(s2, { ...s2.leaves[0], who: "อัมพร" }), "กว.", "จุดที่ลา Key4");
eq(keyLeaveSpot(s2, { ...s2.leaves[0], who: "ชัชวิชญ์" }), "หัวหน้าเวร", "จุดที่ลา หัวหน้าเวร");
void d15;
console.log(`\nตรวจ ${ok + bad} รายการ — ตรง ${ok} · ไม่ตรง ${bad}`);
process.exit(bad ? 1 : 0);
