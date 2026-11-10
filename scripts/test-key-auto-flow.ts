// ทดสอบ API จัดเวรอัตโนมัติ Key (OPD Key1 = B · กว. Key2 = K) ด้วยชีต/ระบบจอง/การลาจำลอง
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
process.env.SHEET_ID_KEY = "KEYSHEET";

const { keySettings: S } = require("../fixtures/key-fixture");
const iso = (n: number) => new Date((n - 25569) * 86400000).toISOString().slice(0, 10);

// ---------- สมุดงานจำลอง (ชีต Key) ----------
const setG: string[][] = Array.from({ length: 112 }, () => Array(20).fill(""));
const put = (r: number, c: number, v: unknown) => (setG[r - 1][c - 1] = v == null ? "" : String(v));
[iso(S.rotStart), S.key4Name, S.signerName, S.signerTitle, S.threshold, S.title, S.docNo, S.head].forEach((v, i) => put(3 + i, 2, v));
S.rot.forEach((n: string, i: number) => { put(13 + i, 2, n); put(13 + i, 3, S.rotNote[i]); });
S.holidays.forEach((h: any, i: number) => { put(13 + i, 5, iso(h.date)); put(13 + i, 6, h.name); });
S.monthNames.forEach((n: string, i: number) => put(13 + i, 8, n));
S.dropdown.forEach((n: string, i: number) => put(13 + i, 10, n));
S.heads.forEach((n: string, i: number) => put(13 + i, 18, n));
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
  const repo = require("../src/lib/key/repo");
  const eng = require("../src/lib/key/engine");
  const route = require("../src/app/api/key/auto/route");
  const manual = require("../src/app/api/key/manual/route");
  const call = (h: any, body: unknown) => h.POST({ json: async () => body });
  let s = await repo.loadKey();
  const pool: string[] = Array.from(new Set([...s.dropdown].filter((x: string) => x && x !== "MT full-time"))) as string[];
  const staff = pool.slice(0, 7);
  ok(staff.length >= 5, "มีรายชื่อ dropdown อย่างน้อย 5 คน: " + staff.length);

  // ระบบจองจำลอง: ทุกคนจองจุดลงทะเบียน (เช้า) ทุกวันทำการ + คนนอกรายชื่อ + จุดอื่นที่ไม่ใช่จุดลงทะเบียน (ต้องไม่ถูกนับ) + จองช่วงสายอย่างเดียว (ไม่นับ)
  const bk: string[][] = [["Timestamp", "Date", "ชื่อ", "นามสกุล", "ตำแหน่ง", "Room", "Station", "เช้า", "สาย", "บ่าย"]];
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(Date.UTC(2026, 11, d));
    if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) continue;
    const date = dt.toISOString().slice(0, 10);
    for (const n of staff) bk.push(["", date, n, "ทดสอบ", "", "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", "จุดลงทะเบียนรายการตรวจ", "06:00-08:30"]);
    bk.push(["", date, "คนนอกรายชื่อ", "ทดสอบ", "", "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", "จุดลงทะเบียนรายการตรวจ", "06:00-08:30"]);
    bk.push(["", date, "จุดอื่นคนหนึ่ง", "ทดสอบ", "", "ห้องเจาะเลือด SMC", "จุดเจาะเลือด", "06:00-08:30"]);
    bk.push(["", date, "สายอย่างเดียว", "ทดสอบ", "", "ห้องเจาะเลือด SMC", "จุดลงทะเบียนรายการตรวจ", "", "08:30-12:30"]);
  }
  wb.set("Booking Data", bk);

  console.log("1) ขอแผน (ไม่เขียนชีต)");
  const snap = () => JSON.stringify([...wb.entries()].filter(([k]) => k !== "Booking Data"));
  const before = snap();
  let r = await call(route, { ym: "2569-12" });
  ok(r.status === 200 && r.body.ok, "แผนสำเร็จ " + JSON.stringify(r.body).slice(0, 200));
  const plan = r.body.plan;
  const m0 = eng.computeKeyMonth(s, {}, 2569, 12);
  const wd = m0.rows.filter((x: any) => x.Q === 1);
  ok(plan.cols.join() === "B,K", "จัดเฉพาะช่อง B และ K");
  ok(plan.assigns.every((a: any) => a.col === "B" || a.col === "K"), "ไม่แตะช่องอื่น");
  ok(plan.assigns.length === wd.length * 2, `เติม 2 ช่องทุกวันทำการ ${plan.assigns.length}/${wd.length * 2}`);
  ok(!plan.assigns.some((a: any) => /นอก|อื่น|สาย/.test(a.name)), "ไม่ใส่คนนอกรายชื่อ/จุดอื่น/ผู้จองช่วงสาย");
  ok(snap() === before, "ขอแผนไม่เขียนชีต");
  for (const a of plan.assigns) {
    const row = m0.rows[a.day - 1];
    const others = Object.entries(row.cells).filter(([c]) => c !== "P").map(([, v]: any) => v.toLowerCase());
    ok(!others.includes(a.name.toLowerCase()), `วัน ${a.day} ${a.name} ซ้ำกับช่องอื่นในแถว`);
  }
  const cnt: Record<string, number> = {};
  for (const a of plan.assigns) cnt[a.name] = (cnt[a.name] ?? 0) + 1;
  console.log("  ยอดต่อคน:", Object.entries(cnt).map(([k, v]) => `${k}=${v}`).join(" "));

  console.log("2) ยืนยัน → บันทึกหลายช่อง → ตารางหลังบันทึกไม่มีชื่อซ้ำ/ตรวจสอบปกติ");
  const entries = plan.assigns.map((a: any) => ({ key: `k:${a.col}:${a.day}`, value: a.name }));
  r = await call(manual, { ym: "2569-12", entries, check: false });
  ok(r.status === 200 && r.body.ok, "บันทึกสำเร็จ");
  s = await repo.loadKey();
  const st = await repo.loadKeyMonthState(s, 2569, 12);
  const m1 = eng.computeKeyMonth(s, st.manual, 2569, 12);
  ok(plan.assigns.every((a: any) => m1.rows[a.day - 1].cells[a.col] === a.name), "ค่าที่บันทึกตรงแผน");
  ok(m1.checks.dup === 0, "ชื่อซ้ำ = 0 (" + m1.checks.dup + ")");

  console.log("3) กดซ้ำไม่ทับ · แก้เองได้ · ล้างกลับ");
  r = await call(route, { ym: "2569-12" });
  ok(r.body.plan.assigns.length === 0 && r.body.plan.fullDays === wd.length, "ไม่เติมซ้ำ");
  r = await call(manual, { ym: "2569-12", entries: entries.map((e: any) => ({ key: e.key, value: null })), check: false });
  ok(r.status === 200, "ล้างกลับ");
  s = await repo.loadKey();
  const m2 = eng.computeKeyMonth(s, (await repo.loadKeyMonthState(s, 2569, 12)).manual, 2569, 12);
  ok(m2.rows.every((x: any) => (x.cells.B ?? "") === "" && (x.cells.K ?? "") === ""), "ย้อนกลับแล้ว B/K ว่าง");

  console.log("4) ลา (รวมคนที่อยู่ในสายหมุนเวียนวันนั้น) / ไม่มีผู้จอง / ข้อผิดพลาด");
  const lt = require("../src/lib/leave-tab");
  const rotMan = m0.rows[1].cells.D; // คนที่อยู่ช่อง D วันที่ 2 → ถ้าจองด้วย ต้องไม่ถูกจัดซ้ำ
  await lt.saveLeaveTabMonth("KEYSHEET", "2569-12", [{ date: "2026-12-03", name: staff[0], replacement: "", type: "", note: "" }]);
  r = await call(route, { ym: "2569-12" });
  ok(!r.body.plan.assigns.some((a: any) => a.day === 3 && a.name === staff[0]), "คนลาไม่ถูกจัด");
  ok(r.body.plan.skips.some((k: any) => k.day === 3 && k.name === staff[0] && /ลา|ช่อง/.test(k.reason)), "รายงานเหตุผลที่ข้าม");
  ok(!r.body.plan.assigns.some((a: any) => a.day === 2 && a.name === rotMan), "คนที่อยู่สายหมุนเวียนวันนั้นไม่ถูกจัดซ้ำ");
  r = await call(route, { ym: "2570-01" });
  ok(r.status === 200 && r.body.plan.assigns.length === 0, "เดือนไม่มีผู้จอง = ไม่เติม");
  r = await call(route, { ym: "x" });
  ok(r.status === 400, "ym ผิด");
  wb.delete("Booking Data");
  require("../src/lib/booking").invalidateBookings();
  r = await call(route, { ym: "2569-12" });
  ok(r.status === 502 && !!r.body.error, "อ่านระบบจองไม่ได้ → แจ้งข้อผิดพลาด");
  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail} · เรียก API จำลอง ${calls} ครั้ง`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
