// ทดสอบตัวจัดเวรอัตโนมัติ SMC (planSmcAuto) ด้วยข้อมูลจำลองแบบสุ่ม (seed คงที่) — รัน: tsx scripts/test-smc-auto.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: any;
import { planSmcAuto, AUTO_COLS, type AutoInput, type AutoRow } from "../src/lib/smc/auto";

let fails = 0;
const ok = (c: boolean, msg: string) => {
  if (!c) {
    fails++;
    console.log("  ✗ " + msg);
  }
};
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const STAFF = ["กมล", "ขวัญ", "จิตรา", "ดวงใจ", "ธนา", "นภา", "บุญเรือง", "ประภา", "พิมพ์", "รัตนา"];
const MT = "MT", PT = "Part-time";
const COLS = "BCDEFGHIJKLMNOPQRST".split("");
const BASE = 46000; // serial ของวันที่ 1 (จันทร์สมมติ)

function makeMonth(r: () => number, nd: number, fillExisting: boolean): AutoRow[] {
  const rows: AutoRow[] = [];
  for (let day = 1; day <= 31; day++) {
    const cells: Record<string, string> = Object.fromEntries(COLS.map((c) => [c, ""]));
    if (day > nd) {
      rows.push({ day, date: null, V: 0, cells });
      continue;
    }
    const dow = (day - 1) % 7; // 5,6 = เสาร์อาทิตย์
    const V = dow >= 5 || day === 13 ? 0 : 1;
    if (V === 1) {
      cells.B = STAFF[(day * 3) % 10];
      cells.C = STAFF[(day * 3 + 1) % 10];
      cells.D = cells.E = MT;
      cells.F = PT;
      cells.J = STAFF[(day * 3 + 2) % 10];
      cells.Q = STAFF[(day + 5) % 10];
      if (fillExisting) {
        if (r() < 0.2) cells.G = STAFF[Math.floor(r() * 10)];
        if (r() < 0.1) cells.O = STAFF[Math.floor(r() * 10)];
      }
    }
    rows.push({ day, date: BASE + day, V, cells });
  }
  return rows;
}

function check(label: string, inp: AutoInput) {
  const plan = planSmcAuto(inp);
  const byDay = new Map<number, AutoRow>(inp.rows.map((r) => [r.day, r]));
  const lc = (s: string) => s.toLowerCase();
  for (const a of plan.assigns) {
    const r = byDay.get(a.day)!;
    ok(r.date !== null && r.V === 1, `${label}: วัน ${a.day} ไม่ใช่วันทำการ`);
    ok((r.cells[a.col] ?? "") === "", `${label}: วัน ${a.day} ช่อง ${a.col} ไม่ว่าง`);
    ok((inp.booked[a.day] ?? []).some((b) => lc(b.name) === lc(a.name) && !b.unlisted), `${label}: ${a.name} วัน ${a.day} ไม่ได้จอง/ชื่อไม่ตรง`);
    ok(!inp.onLeave(a.name, r.date!), `${label}: ${a.name} ลาวัน ${a.day}`);
    ok(!inp.freeNames.includes(a.name), `${label}: ใส่ช่องประจำ`);
  }
  // ชื่อไม่ซ้ำในวันเดียวกันทุกช่อง (หลังเติม)
  for (const r of inp.rows) {
    if (r.date === null) continue;
    const all = { ...r.cells };
    for (const a of plan.assigns) if (a.day === r.day) all[a.col] = a.name;
    const names = Object.values(all).filter((v) => v && !inp.freeNames.includes(v)).map(lc);
    const origDup = (() => {
      const o = Object.values(r.cells).filter((v) => v && !inp.freeNames.includes(v)).map(lc);
      return o.length - new Set(o).size;
    })();
    ok(names.length - new Set(names).size === origDup, `${label}: วัน ${r.day} ชื่อซ้ำเพิ่มขึ้น`);
    // จำนวนที่เติม = min(ช่องว่าง, ผู้มีสิทธิ์)
    if (r.V === 1) {
      const empty = AUTO_COLS.filter((c) => (r.cells[c] ?? "") === "").length;
      const elig = new Set(
        (inp.booked[r.day] ?? [])
          .filter((b) => !b.unlisted && !inp.freeNames.includes(b.name) && !inp.onLeave(b.name, r.date!) && !Object.values(r.cells).some((v) => lc(v) === lc(b.name)))
          .map((b) => lc(b.name)),
      ).size;
      const got = plan.assigns.filter((a) => a.day === r.day).length;
      ok(got === Math.min(empty, elig), `${label}: วัน ${r.day} เติม ${got} ควร ${Math.min(empty, elig)}`);
    }
  }
  // ซ้ำช่องเดียวกันวันเดียว
  const keys = plan.assigns.map((a) => `${a.day}:${a.col}`);
  ok(keys.length === new Set(keys).size, `${label}: ช่องซ้ำ`);
  // กำหนดแน่นอน (เหมือนเดิมเมื่อรันซ้ำ)
  ok(JSON.stringify(planSmcAuto(inp)) === JSON.stringify(plan), `${label}: ผลไม่คงที่`);
  return plan;
}

// 1) สุ่ม 300 เดือน
for (let seed = 1; seed <= 300; seed++) {
  const r = rng(seed);
  const nd = [28, 29, 30, 31][seed % 4];
  const rows = makeMonth(r, nd, seed % 2 === 0);
  const booked: AutoInput["booked"] = {};
  for (let d = 1; d <= nd; d++) {
    const n = [0, 1, 2, 3, 4, 6][Math.floor(r() * 6)];
    const list: { name: string; unlisted?: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      const nm = r() < 0.08 ? "คนนอกรายชื่อ" + i : STAFF[Math.floor(r() * 10)];
      list.push({ name: i === 1 && r() < 0.2 ? nm.toUpperCase() : nm, unlisted: nm.startsWith("คนนอก") });
    }
    if (list.length) booked[d] = list;
  }
  const leaves = new Set<string>();
  for (let i = 0; i < 25; i++) leaves.add(`${STAFF[Math.floor(r() * 10)]}|${BASE + 1 + Math.floor(r() * nd)}`);
  check(`seed${seed}`, { rows, booked, onLeave: (n, d) => leaves.has(`${n}|${d}`), freeNames: [MT, PT] });
}

// 2) ทุกคนจองทุกวัน → ยอดต้องต่างกันไม่เกิน 1 และไม่ซ้ำจุดเดิมติดกันบ่อย
{
  const r = rng(7);
  const rows = makeMonth(r, 30, false);
  const booked: AutoInput["booked"] = {};
  for (let d = 1; d <= 30; d++) booked[d] = STAFF.map((n) => ({ name: n }));
  const plan = check("ทุกคนจองทุกวัน", { rows, booked, onLeave: () => false, freeNames: [MT, PT] });
  const counts = plan.people.map((p) => p.after);
  console.log("  ยอดต่อคน:", plan.people.map((p) => `${p.name}=${p.after}(${p.spots.G}/${p.spots.H}/${p.spots.I})`).join(" "));
  ok(Math.max(...counts) - Math.min(...counts) <= 1, `ยอดต่างกันเกิน 1: ${counts.join(",")}`);
  // ซ้ำจุดเดิมติดกัน (ในเวรของคนเดียวกัน)
  let rep = 0, tot = 0;
  const lastCol = new Map<string, string>();
  for (const a of plan.assigns) {
    if (lastCol.get(a.name) === a.col) rep++;
    if (lastCol.has(a.name)) tot++;
    lastCol.set(a.name, a.col);
  }
  console.log(`  ซ้ำจุดเดิมติดกัน ${rep}/${tot}`);
  ok(rep <= tot * 0.45, "ซ้ำจุดเดิมติดกันมากเกิน");
  for (const p of plan.people) {
    const sp = [p.spots.G, p.spots.H, p.spots.I];
    ok(Math.max(...sp) - Math.min(...sp) <= 2, `${p.name} กระจายจุดไม่ดี ${sp.join("/")}`);
  }
}

// 3) กรณีเฉพาะ
{
  const r = rng(3);
  const rows = makeMonth(r, 30, false);
  // ไม่มีใครจอง → ไม่เติม
  const none = planSmcAuto({ rows, booked: {}, onLeave: () => false, freeNames: [MT, PT] });
  ok(none.assigns.length === 0 && none.unfilled.length === rows.filter((x) => x.V === 1 && x.date !== null).length * 3, "ไม่มีผู้จอง ต้องว่างทั้งหมด");
  // จอง 2 คน → เติม 2 ช่อง เว้น 1
  const two = planSmcAuto({ rows, booked: { 1: [{ name: "กมล" }, { name: "ขวัญ" }] }, onLeave: () => false, freeNames: [MT, PT] });
  const d1 = two.assigns.filter((a) => a.day === 1);
  ok(d1.length === 2 && two.unfilled.some((u) => u.day === 1 && u.why === "จองไม่ครบ"), "จอง 2 คน");
  // วันเสาร์ (day 6) มีจอง → ไม่เติม
  const wk = planSmcAuto({ rows, booked: { 6: [{ name: "กมล" }] }, onLeave: () => false, freeNames: [MT, PT] });
  ok(wk.assigns.length === 0, "วันหยุดต้องไม่เติม");
  // ชื่ออยู่ที่ B วันที่ 1 (STAFF[3]=ดวงใจ) → ไม่เติมซ้ำ
  const dup = planSmcAuto({ rows, booked: { 1: [{ name: rows[0].cells.B }] }, onLeave: () => false, freeNames: [MT, PT] });
  ok(dup.assigns.length === 0 && dup.skips.some((k) => /ในวันเดียวกัน/.test(k.reason)), "ชื่อซ้ำข้ามช่อง");
  // ชื่อซ้ำช่วงเวลาอื่น (Q ช่วงบ่าย) ก็ห้าม
  const q = planSmcAuto({ rows, booked: { 1: [{ name: rows[0].cells.Q }] }, onLeave: () => false, freeNames: [MT, PT] });
  ok(q.assigns.length === 0, "ชื่อซ้ำกับช่วงบ่าย");
  // ช่องที่มีชื่ออยู่แล้วไม่ทับ
  const pre = makeMonth(r, 30, false);
  pre[0].cells.G = "ธนา";
  const pp = planSmcAuto({ rows: pre, booked: { 1: [{ name: "กมล" }, { name: "ขวัญ" }, { name: "จิตรา" }] }, onLeave: () => false, freeNames: [MT, PT] });
  ok(!pp.assigns.some((a) => a.day === 1 && a.col === "G") && pp.assigns.filter((a) => a.day === 1).length === 2, "ไม่ทับช่องที่มีชื่อ");
  ok(pp.people.find((x) => x.name === "ธนา")?.before === 1, "ยอดตั้งต้นนับ G/H/I เดิม");
  // ลา
  const lv = planSmcAuto({ rows, booked: { 1: [{ name: "กมล" }] }, onLeave: (n) => n === "กมล", freeNames: [MT, PT] });
  ok(lv.assigns.length === 0 && lv.skips[0]?.reason === "ลาในวันนี้", "ลา");
  // ชื่อไม่ตรงรายชื่อ ไม่เดา
  const un = planSmcAuto({ rows, booked: { 1: [{ name: "ใครไม่รู้", unlisted: true }] }, onLeave: () => false, freeNames: [MT, PT] });
  ok(un.assigns.length === 0 && un.skips[0]?.reason.includes("ไม่ตรงรายชื่อ"), "ชื่อไม่ตรง");
  // จองเกิน 3 คน → คนที่มียอดน้อยกว่าได้ก่อน
  const pre2 = makeMonth(r, 30, false);
  pre2[1].cells.G = "กมล"; pre2[1].cells.H = "กมล"; // day2 กมล ได้ 2 แล้ว
  const bal = planSmcAuto({ rows: pre2, booked: { 3: ["กมล", "ขวัญ", "จิตรา", "ธนา", "พิมพ์"].map((name) => ({ name })) }, onLeave: () => false, freeNames: [MT, PT] });
  ok(!bal.assigns.some((a) => a.name === "กมล"), "คนยอดมากต้องเสียสิทธิ์ก่อน");
}

console.log(fails === 0 ? "✓ test-smc-auto ผ่านทั้งหมด" : `✗ ล้มเหลว ${fails} จุด`);
process.exit(fails === 0 ? 0 : 1);
