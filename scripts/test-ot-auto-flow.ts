// ทดสอบ API จัดเวรอัตโนมัติ OT (B D J ช่วง 06.00-08.30) ด้วยชีต/ระบบจอง/การลาจำลอง
process.env.SHEET_TITLES_TTL_MS = "0"; // ชีตจำลองเปลี่ยนแท็บระหว่างทดสอบ → ไม่จำรายชื่อแท็บ
// รัน: tsx scripts/test-ot-flow.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const require: any;
declare const process: any;
declare const __dirname: string;
const path = require("path");
const Module = require("module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (req: string, ...rest: any[]) {
  if (req === "server-only" || req === "next/headers" || req === "next/server" || req === "google-auth-library") return path.join(__dirname, "stubs", req.replace("/", "_") + ".js");
  return orig.call(this, req, ...rest);
};
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "test@example.iam";
process.env.GOOGLE_PRIVATE_KEY = "test";
process.env.SHEET_ID_OT = "OTSHEET";

const { otSettings } = require("../fixtures/ot-fixture");
const iso = (n: number) => new Date((n - 25569) * 86400000).toISOString().slice(0, 10);

// ---------- สมุดงานจำลอง ----------
const S = otSettings;
const setG: string[][] = Array.from({ length: 55 }, () => Array(16).fill(""));
const put = (r: number, c: number, v: unknown) => (setG[r - 1][c - 1] = v === null || v === undefined ? "" : String(v));
put(3, 2, S.pattern); put(4, 2, iso(S.startMonday)); put(5, 2, iso(S.eightStart)); put(6, 2, iso(S.smcOpen));
put(4, 7, S.signerName); put(5, 7, S.signerTitle);
S.staff.forEach((p: any, i: number) => { put(10 + i, 2, p.name); if (p.start) put(10 + i, 3, iso(p.start)); });
["", "", "ห้อง", "OPD", "OPD", "OPD", "OPD", "กว."].forEach((v, i) => put(18 + i, 2, v));
S.spots.forEach((p: any, i: number) => { put(21 + i, 1, p.name); put(21 + i, 2, p.room); put(21 + i, 3, p.time); put(21 + i, 4, p.heavy); put(21 + i, 5, p.pos7); put(21 + i, 6, p.pos8); put(21 + i, 7, p.fill); });
S.table7.forEach((row: number[], i: number) => row.forEach((v, j) => put(32 + i, 2 + j, v)));
S.table8.forEach((row: number[], i: number) => row.forEach((v, j) => put(43 + i, 2 + j, v)));
S.holidays.forEach((h: any, i: number) => { put(10 + i, 10, iso(h.date)); put(10 + i, 11, h.name); });
S.monthNames.forEach((m: string, i: number) => put(10 + i, 12, m));
S.dropdown.forEach((n: string, i: number) => put(10 + i, 15, n));
const wb = new Map<string, string[][]>([
  ["ตั้งค่า", setG],
  ["ลา-แลกเวร", [[], [], [], [], ["2026-11-13", "บุปผาชล", "กิตติยาภา", "ลากิจ"]]],
  ["สรุป", [[], ["", "2026-11-02"], ["", "2027-11-29"]]],
]);
let calls = 0;
const colNum = (L: string) => [...L].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
function pr(r: string) {
  const m = /^'?([^'!]+)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(r);
  if (!m) throw new Error("range? " + r);
  const c1 = colNum(m[2]), r1 = +m[3];
  return { tab: m[1], c1, r1, c2: m[4] ? colNum(m[4]) : c1, r2: m[5] ? +m[5] : r1 };
}
function read(r: string) {
  const { tab, c1, r1, c2, r2 } = pr(r);
  const g = wb.get(tab);
  if (!g) throw new Error("ไม่มีแท็บ " + tab);
  const out: string[][] = [];
  for (let y = r1; y <= r2; y++) { const row: string[] = []; for (let x = c1; x <= c2; x++) row.push(g[y - 1]?.[x - 1] ?? ""); while (row.length && row[row.length - 1] === "") row.pop(); out.push(row); }
  while (out.length && out[out.length - 1].length === 0) out.pop();
  return out;
}
function write(r: string, values: unknown[][]) {
  const { tab, c1, r1 } = pr(r);
  const g = wb.get(tab)!;
  values.forEach((row, dy) => row.forEach((v, dx) => { const y = r1 - 1 + dy, x = c1 - 1 + dx; while (g.length <= y) g.push([]); while (g[y].length <= x) g[y].push(""); g[y][x] = v == null ? "" : String(v); }));
}
(globalThis as any).fetch = async (url: string, init?: any) => {
  calls++;
  const u = new URL(url);
  const json = (o: unknown) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
  if (u.pathname.endsWith("/values:batchGet")) return json({ valueRanges: u.searchParams.getAll("ranges").map((r) => ({ values: read(r) })) });
  if (u.pathname.endsWith("/values:batchUpdate")) { const b = JSON.parse(init.body); for (const d of b.data) write(d.range, d.values); return json({}); }
  if (u.pathname.endsWith(":batchUpdate")) { const b = JSON.parse(init.body); for (const q of b.requests) if (q.addSheet) wb.set(q.addSheet.properties.title, []); return json({}); }
  if (u.searchParams.get("fields") === "sheets.properties.title") return json({ sheets: [...wb.keys()].map((title) => ({ properties: { title } })) });
  throw new Error("API? " + url);
};

let pass = 0, fail = 0;
const ok = (c: boolean, msg: string) => { if (c) pass++; else { fail++; console.log("✗", msg); } };
const STN = "จุดอื่นๆ (บัตรคิว, นำ-ส่ง สิ่งส่งตรวจ)";
(async () => {
  process.env.SHEET_ID_BOOKING = "BOOKSHEET";
  const repo = require("../src/lib/ot/repo");
  const eng = require("../src/lib/ot/engine");
  const route = require("../src/app/api/ot/auto/route");
  const manual = require("../src/app/api/ot/manual/route");
  const call = (h: any, body: unknown) => h.POST({ json: async () => body });
  let d = await repo.loadOt();
  const staff: string[] = d.settings.staff.map((x: any) => x.name).filter((x: string) => x);
  ok(staff.length >= 6, "พนักงาน OT อย่างน้อย 6 คน: " + staff.length);

  // จำลองการจอง ธ.ค.69 (= ธ.ค.2026): จำนวนผู้จองต่อวันวนเป็น 0,1,2,3,4 คน (น้อยกว่า 3 เป็นปกติ) · มีจุดเจาะเลือด/ช่วงสายที่ต้องไม่ถูกนับ
  const bk: string[][] = [["Timestamp", "Date", "ชื่อ", "นามสกุล", "ตำแหน่ง", "Room", "Station", "เช้า", "สาย", "บ่าย", "เย็น", "ดึก"]];
  const per: Record<number, string[]> = {};
  let k = 0;
  for (let day = 1; day <= 31; day++) {
    const dt = new Date(Date.UTC(2026, 11, day));
    if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) continue;
    const date = dt.toISOString().slice(0, 10);
    const n = k++ % 4;
    per[day] = [];
    for (let i = 0; i < n; i++) {
      // ผู้จองส่วนใหญ่เป็นคนนอกแถว OT (รายชื่อ dropdown) · คนที่ 3 เป็นพนักงาน OT ที่ถูกจัดอยู่ในแถววันนั้นแล้ว (ต้องถูกข้าม ไม่ซ้ำ)
      const extras = ["สุพัตตรา", "ขวัญจิรา", "จำเลียง", "ยอดชาย"];
      const nm = i === 2 ? staff[day % staff.length] : extras[(day + i) % extras.length];
      per[day].push(nm);
      bk.push(["", date, nm, "ทดสอบ", "", i === 1 ? "ห้องเจาะเลือดอาคารกัลยาฯ กว." : "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", STN, "06:00-08:30"]);
    }
    bk.push(["", date, "ไม่ใช่จุดนี้", "ทดสอบ", "", "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", "จุดเจาะเลือด", "06:00-08:30"]);
    bk.push(["", date, "ช่วงสายเท่านั้น", "ทดสอบ", "", "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", STN, "", "08:30-12:30"]);
    if (day % 4 === 0) bk.push(["", date, "คนนอกรายชื่อ", "ทดสอบ", "", "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", STN, "06:00-08:30"]);
  }
  wb.set("Booking Data", bk);

  console.log("1) ขอแผน (ไม่เขียนชีต)");
  const snap = () => JSON.stringify([...wb.entries()].filter(([x]) => x !== "Booking Data"));
  const before = snap();
  let r = await call(route, { ym: "2569-12" });
  ok(r.status === 200 && r.body.ok, "แผนสำเร็จ " + JSON.stringify(r.body).slice(0, 200));
  const plan = r.body.plan; if (process.env.DBG) console.log(JSON.stringify(plan).slice(0, 900));
  const st0 = await repo.loadOtMonthState(d, 2569, 12);
  const m0 = eng.computeOtMonth(d.settings, d.leaves, st0.manual, 2569, 12);
  ok(plan.cols.join() === "B,D,J", "จัดเฉพาะช่อง B, D, J");
  ok(plan.assigns.every((a: any) => "BDJ".includes(a.col)), "ไม่แตะช่องอื่น");
  ok(!plan.assigns.some((a: any) => /นอก|ไม่ใช่|สาย/.test(a.name)), "ไม่ใส่คนนอกรายชื่อ/จุดอื่น/ผู้จองช่วงสาย");
  ok(snap() === before, "ขอแผนไม่เขียนชีต");
  // ลำดับ: วันที่มีผู้จอง n คน (ไม่ติดเงื่อนไขอื่น) → เติม B, D, J ตามลำดับ และไม่เติมช่องท้ายถ้าไม่มีคน
  let seq = 0;
  for (const row of m0.rows) {
    if (row.date === null || row.P !== 1) continue;
    const got = plan.assigns.filter((a: any) => a.day === row.day).map((a: any) => a.col);
    const empties = ["B", "D", "J"].filter((c) => (row.cells[c] ?? "") === "");
    ok(got.join() === empties.slice(0, got.length).join(), `วัน ${row.day} เติมตามลำดับ B→D→J: ${got.join()} (ว่าง ${empties.join()})`);
    // ชื่อไม่ซ้ำกับช่องอื่นในแถว
    for (const a of plan.assigns.filter((x: any) => x.day === row.day)) {
      const others = Object.entries(row.cells).filter(([c]) => c !== "O").map(([, v]: any) => (require("../src/lib/ot/conflicts").otPerson(v) ?? "").toLowerCase());
      ok(!others.includes(a.name.toLowerCase()), `วัน ${row.day} ${a.name} ซ้ำช่องอื่น`);
    }
    seq++;
  }
  ok(plan.assigns.length > 20, "มีการเติมจริง " + plan.assigns.length);
  ok(seq > 15, "ตรวจ " + seq + " วันทำการ");
  // วันที่ไม่มีผู้จอง/ผู้จอง 1 คน
  const emptyDay = Object.entries(per).find(([, v]) => v.length === 0);
  if (emptyDay) ok(plan.assigns.filter((a: any) => a.day === +emptyDay[0]).length === 0 && plan.unfilled.some((u: any) => u.day === +emptyDay[0]), "วันไม่มีผู้จองเว้นว่าง");
  // คนเดิมอยู่จุดเดิมได้: มีบางคนที่อยู่จุดเดียวกันซ้ำหลายวัน
  const rep = new Map<string, number>();
  for (const a of plan.assigns) rep.set(a.name + "|" + a.col, (rep.get(a.name + "|" + a.col) ?? 0) + 1);
  ok(plan.skips.some((x: any) => /ในวันเดียวกันแล้ว/.test(x.reason)), "ข้ามพนักงานที่อยู่ในแถววันนั้นแล้ว");
  ok([...rep.values()].some((v) => v > 1), "คนเดิมอยู่จุดเดิมซ้ำวันอื่นได้");

  console.log("2) ยืนยัน → บันทึกผ่าน /manual · กดซ้ำไม่ทับ · ล้างกลับ");
  const entries = plan.assigns.map((a: any) => ({ key: `o:${a.col}:${a.day}`, value: a.name }));
  r = await call(manual, { ym: "2569-12", entries, check: false });
  ok(r.status === 200 && r.body.ok, "บันทึกสำเร็จ " + JSON.stringify(r.body).slice(0, 120));
  const st1 = await repo.loadOtMonthState(d, 2569, 12);
  const m1 = eng.computeOtMonth(d.settings, d.leaves, st1.manual, 2569, 12);
  ok(plan.assigns.every((a: any) => m1.rows[a.day - 1].cells[a.col] === a.name), "ค่าที่บันทึกตรงแผน");
  const { otDupCols } = require("../src/lib/ot/conflicts");
  ok(m1.rows.every((x: any) => otDupCols(x.cells).size === 0 || otDupCols(m0.rows[x.day - 1].cells).size > 0), "การจัดไม่ทำให้เกิดชื่อซ้ำใหม่");
  r = await call(route, { ym: "2569-12" });
  ok(r.body.plan.assigns.length === 0 || r.body.plan.assigns.every((a: any) => (m1.rows[a.day - 1].cells[a.col] ?? "") === ""), "ไม่ทับช่องที่มีชื่อแล้ว");
  r = await call(manual, { ym: "2569-12", entries: entries.map((e: any) => ({ key: e.key, value: null })), check: false });
  ok(r.status === 200, "ล้างกลับ");
  const st2 = await repo.loadOtMonthState(d, 2569, 12);
  const m2 = eng.computeOtMonth(d.settings, d.leaves, st2.manual, 2569, 12);
  ok(m2.rows.every((x: any, i: number) => ["B", "D", "J"].every((c) => x.cells[c] === m0.rows[i].cells[c])), "ย้อนกลับแล้ว B/D/J กลับเป็นเดิม");

  console.log("3) ลา / เดือนไม่มีผู้จอง / ข้อผิดพลาด");
  const day = +Object.entries(per).find(([, v]) => v.length >= 2)![0];
  const who = per[day][0];
  const lt = require("../src/lib/leave-tab");
  await lt.saveLeaveTabMonth("OTSHEET", "2569-12", [{ date: `2026-12-${String(day).padStart(2, "0")}`, name: who, replacement: "", type: "ลากิจ", note: "" }]);
  r = await call(route, { ym: "2569-12" });
  ok(!r.body.plan.assigns.some((a: any) => a.day === day && a.name === who), "คนลาไม่ถูกจัด");
  ok(r.body.plan.skips.some((x: any) => x.day === day && x.name === who), "รายงานเหตุผลที่ข้าม");
  r = await call(route, { ym: "2570-01" });
  ok(r.status === 200 && r.body.plan.assigns.length === 0, "เดือนไม่มีผู้จอง");
  r = await call(route, { ym: "x" });
  ok(r.status === 400, "ym ผิด");
  wb.delete("Booking Data");
  require("../src/lib/booking").invalidateBookings();
  r = await call(route, { ym: "2569-12" });
  ok(r.status === 502 && !!r.body.error, "อ่านระบบจองไม่ได้ → แจ้งข้อผิดพลาด");
  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail} · เรียก API จำลอง ${calls} ครั้ง`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
