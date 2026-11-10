// ทดสอบ API จัดเวรอัตโนมัติ SMC แบบครบวงจร (ชีตจำลองในหน่วยความจำ + ระบบจองเวรจำลอง)
process.env.SHEET_TITLES_TTL_MS = "0"; // ชีตจำลองเปลี่ยนแท็บระหว่างทดสอบ → ไม่จำรายชื่อแท็บ
// รัน: tsx scripts/test-smc-auto-flow.ts
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
process.env.SHEET_ID_SMC = "SMCSHEET";

const { smcSettings: S } = require("../fixtures/smc-fixture");
const iso = (n: number) => new Date((n - 25569) * 86400000).toISOString().slice(0, 10);

// ---------- สมุดงานจำลอง (ชีต SMC) ----------
const setG: string[][] = Array.from({ length: 66 }, () => Array(22).fill(""));
const put = (r: number, c: number, v: unknown) => (setG[r - 1][c - 1] = v == null ? "" : String(v));
[S.title, S.docNo, S.signerName, S.signerTitle, S.q0700, S.q0830, S.q1230, S.key0700, S.key0830, S.mt, S.pt].forEach((v, i) => put(3 + i, 2, v));
S.hours.forEach((h: number, i: number) => put(4 + i, 6, h));
S.holidays.forEach((h: any, i: number) => { put(17 + i, 5, iso(h.date)); put(17 + i, 6, h.name); });
S.monthNames.forEach((n: string, i: number) => put(17 + i, 8, n));
([["listJ", 10], ["listL", 12], ["listN", 14], ["listP", 16], ["listT", 20]] as const).forEach(([k, c]) => (S as any)[k].forEach((n: string, i: number) => put(17 + i, c, n)));
const wb = new Map<string, string[][]>([["ตั้งค่า", setG], ["ลา-แลกเวร", [[], [], [], []]]]);
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
(async () => {
  process.env.SHEET_ID_BOOKING = "BOOKSHEET";
  const repo = require("../src/lib/smc/repo");
  const eng = require("../src/lib/smc/engine");
  const route = require("../src/app/api/smc/auto/route");
  const manual = require("../src/app/api/smc/manual/route");
  const call = (h: any, body: unknown) => h.POST({ json: async () => body });

  // ชื่อตามรายชื่อในตั้งค่า
  let s = await repo.loadSmc();
  const staff: string[] = Array.from(new Set([...s.listJ, ...s.listL, ...s.listN, ...s.listP].filter((x: string) => x && x !== s.mt && x !== s.pt))).slice(0, 8) as string[];
  ok(staff.length >= 6, "มีรายชื่ออย่างน้อย 6 คน: " + staff.length);

  // ระบบจองจำลอง ธ.ค.69 = ธ.ค.2026: ทุกคนจองเช้าทุกวันทำการ + คนนอกรายชื่อ 1 คน + ห้องอื่น (ต้องไม่ถูกนับ)
  const bk: string[][] = [["Timestamp", "Date", "ชื่อ", "นามสกุล", "ตำแหน่ง", "Room", "Station", "เช้า", "สาย", "บ่าย"]];
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(Date.UTC(2026, 11, d));
    if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) continue;
    const date = dt.toISOString().slice(0, 10);
    for (const n of staff) bk.push(["", date, n, "ทดสอบ", "", "ห้องเจาะเลือด SMC", "จุดเจาะเลือด", "06:00-08:30"]);
    bk.push(["", date, "คนนอกรายชื่อ", "ทดสอบ", "", "ห้องเจาะเลือด SMC", "จุดเจาะเลือด", "06:00-08:30"]);
    bk.push(["", date, staff[0], "ทดสอบ", "", "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", "จุดเจาะเลือด", "06:00-08:30"]);
  }
  wb.set("Booking Data", bk);

  console.log("1) ขอแผน (ยังไม่เขียนชีต)");
  const gBefore = JSON.stringify([...wb.entries()].filter(([k]) => k !== "Booking Data"));
  let r = await call(route, { ym: "2569-12" });
  ok(r.status === 200 && r.body.ok, "แผนสำเร็จ: " + JSON.stringify(r.body).slice(0, 200));
  const plan = r.body.plan;
  const wd = eng.computeSmcMonth(s, {}, 2569, 12).rows.filter((x: any) => x.V === 1);
  ok(plan.assigns.length === wd.length * 3, `เติม 3 ช่องทุกวันทำการ ${plan.assigns.length}/${wd.length * 3}`);
  ok(!plan.assigns.some((a: any) => a.name.includes("นอก")), "ไม่ใส่คนนอกรายชื่อ");
  ok(plan.skips.some((k: any) => k.reason.includes("ไม่ตรงรายชื่อ")), "รายงานคนนอกรายชื่อ");
  ok(JSON.stringify([...wb.entries()].filter(([k]) => k !== "Booking Data")) === gBefore, "ขอแผนไม่เขียนชีต");
  // ไม่ซ้ำกับช่องอื่นวันเดียวกัน
  const m0 = eng.computeSmcMonth(s, {}, 2569, 12);
  for (const a of plan.assigns) {
    const row = m0.rows[a.day - 1];
    ok(!Object.values(row.cells).some((v: any) => v.toLowerCase() === a.name.toLowerCase()), `วัน ${a.day} ${a.name} ซ้ำช่องอื่น`);
  }

  console.log("2) ยืนยัน → บันทึกผ่าน /manual แบบหลายช่อง แล้วอ่านกลับ");
  const entries = plan.assigns.map((a: any) => ({ key: `m:${a.col}:${a.day}`, value: a.name }));
  r = await call(manual, { ym: "2569-12", entries, check: false });
  ok(r.status === 200 && r.body.ok, "บันทึกสำเร็จ " + JSON.stringify(r.body));
  s = await repo.loadSmc();
  const st = await repo.loadSmcMonthState(s, 2569, 12);
  const m1 = eng.computeSmcMonth(s, st.manual, 2569, 12);
  ok(plan.assigns.every((a: any) => m1.rows[a.day - 1].cells[a.col] === a.name), "ค่าที่บันทึกตรงกับแผน");
  ok(eng.smcDupCols !== undefined && m1.rows.every((x: any) => eng.smcDupCols(s, x.cells).size === 0), "ไม่มีชื่อซ้ำช่วงเวลาเดียวกัน");

  console.log("3) กดซ้ำ = ไม่มีช่องว่างเหลือ · แก้ชื่อเองได้ · ย้อนกลับ (ล้างคืนค่าสูตร)");
  r = await call(route, { ym: "2569-12" });
  ok(r.body.plan.assigns.length === 0 && r.body.plan.fullDays === wd.length, "ไม่เติมซ้ำ/ไม่ทับ " + r.body.plan.assigns.length);
  r = await call(manual, { ym: "2569-12", key: "m:G:2", value: staff[7] ?? staff[0] });
  ok(r.status === 200 || r.status === 409, "แก้ช่องเดียวได้ตามปกติ (" + r.status + ")");
  r = await call(manual, { ym: "2569-12", entries: entries.map((e: any) => ({ key: e.key, value: null })), check: false });
  ok(r.status === 200, "ล้างกลับ");
  s = await repo.loadSmc();
  const m2 = eng.computeSmcMonth(s, (await repo.loadSmcMonthState(s, 2569, 12)).manual, 2569, 12);
  ok(m2.rows.every((x: any) => ["G", "H", "I"].every((c) => (x.cells[c] ?? "") === "")), "ย้อนกลับแล้ว G/H/I ว่างทั้งหมด");

  console.log("4) ลา + ไม่มีผู้จอง + เดือนที่ไม่มีข้อมูล");
  const lt = require("../src/lib/leave-tab");
  await lt.saveLeaveTabMonth("SMCSHEET", "2569-12", [{ date: "2026-12-02", name: staff[0], replacement: "", type: "ลาพักร้อน", note: "" }]);
  r = await call(route, { ym: "2569-12" });
  ok(!r.body.plan.assigns.some((a: any) => a.day === 2 && a.name === staff[0]), "คนลาไม่ถูกจัด");
  ok(r.body.plan.skips.some((k: any) => k.day === 2 && k.name === staff[0] && k.reason === "ลาในวันนี้"), "รายงานว่าลา");
  r = await call(route, { ym: "2570-01" });
  ok(r.status === 200 && r.body.plan.assigns.length === 0, "เดือนที่ไม่มีผู้จอง = ไม่เติมอะไร");
  r = await call(route, { ym: "bad" });
  ok(r.status === 400, "ym ผิดรูปแบบ");
  wb.delete("Booking Data");
  require("../src/lib/booking").invalidateBookings();
  r = await call(route, { ym: "2569-12" });
  ok(r.status === 502 && !!r.body.error, "อ่านระบบจองไม่ได้ → แจ้งข้อผิดพลาด ไม่เติมมั่ว: " + r.status);

  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail} · เรียก API จำลอง ${calls} ครั้ง`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
