import { OtPlan, computeOtMonth } from "../src/lib/ot/engine";
import { otSettings, otLeaves, planExpect, dec69Expect, nov69Expect, nov70Expect } from "../fixtures/ot-fixture";
let ok = 0, bad = 0;
const eq = (a: unknown, b: unknown, what: string) => { if (a === b) ok++; else { bad++; console.log("✗", what, "ได้", JSON.stringify(a), "ชีต", JSON.stringify(b)); } };
const plan = new OtPlan(otSettings);
planExpect.forEach((e, i) => {
  const w = plan.week(i + 1);
  [w.D, w.E, w.F, w.G, w.H, w.I, w.J, w.K].forEach((v, k) => eq(v, e.D_K[k], `แผน สัปดาห์ ${i + 1} คอลัมน์ ${"DEFGHIJK"[k]}`));
  e.streak8.forEach((v, k) => eq(w.streak[k], v, `แผน สัปดาห์ ${i + 1} AZ+${k}`));
  eq(w.L, "", `แผน สัปดาห์ ${i + 1} L`);
});
const m = computeOtMonth(otSettings, otLeaves, {}, 2569, 12);
eq(m.subtitle, "ประจำเดือน ธันวาคม พ.ศ.2569", "หัวเรื่อง");
for (const e of dec69Expect) {
  const r = m.rows[e.day - 1];
  for (const c of ["C", "E", "F", "G", "H", "I", "K", "M", "N"]) eq(r.cells[c], (e as any)[c], `ธ.ค.69 วันที่ ${e.day} ${c}`);
  eq(r.holidayName, e.O, `ธ.ค.69 วันที่ ${e.day} O`);
  eq(r.P, e.P, `ธ.ค.69 วันที่ ${e.day} P`);
  eq(r.Q, e.Q, `ธ.ค.69 วันที่ ${e.day} Q`);
}
for (const [label, y, mo, exp] of [["พ.ย.69", 2569, 11, nov69Expect], ["พ.ย.70", 2570, 11, nov70Expect]] as const) {
  const mm = computeOtMonth(otSettings, otLeaves, {}, y, mo);
  for (const [d, line] of Object.entries(exp)) {
    const v = line.split("|");
    const r = mm.rows[Number(d) - 1];
    ["C", "E", "F", "G", "I", "K", "M", "N"].forEach((c, i) => eq(r.cells[c], v[i], `${label} วันที่ ${d} ${c}`));
    eq(r.Q === null ? "" : String(r.Q), v[8], `${label} วันที่ ${d} Q`);
  }
}
console.log(`\nตรวจ ${ok + bad} รายการ — ตรง ${ok} · ไม่ตรง ${bad}`);
process.exit(bad ? 1 : 0);
