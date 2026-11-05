// ทดสอบ: ดึงการลาครั้งเดียว → เข้าแท็บ ลา-แลกเวร ครบทั้ง 4 ชีต (แต่ละชีตรับเฉพาะพนักงานของตัวเอง)
// รัน: tsx scripts/test-leave-all.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const require: any;
declare const process: any;
declare const __dirname: string;
process.env.SHEET_TITLES_TTL_MS = "0";
const path = require("path");
const fs = require("fs");
const Module = require("module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (req: string, ...rest: any[]) {
  if (req === "server-only" || req === "next/headers" || req === "google-auth-library") return path.join(__dirname, "stubs", req.replace("/", "_") + ".js");
  return orig.call(this, req, ...rest);
};
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "test@example.iam";
process.env.GOOGLE_PRIVATE_KEY = "test";
process.env.SHEET_ID_SHIFT3 = "S3";
process.env.SHEET_ID_KEY = "KEY";
process.env.SHEET_ID_SMC = "SMC";
process.env.SHEET_ID_OT = "OT";
process.env.SHEET_ID_LEAVE_SYSTEM = "LEAVE";
const empty4 = () => [[], [], [], []] as string[][];

const books = new Map<string, Map<string, string[][]>>();
// 3 ช่วงเวลา
{
  const book: Record<string, string[][]> = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "shift3-sheet.json"), "utf8"));
  const g = book["ตั้งค่า"];
  const i = g.findIndex((r) => r[0] === "ชื่อผู้จัดทำ");
  if (i >= 0 && i !== 88) { const tail = g.splice(i - 1, 3); while (g.length < 87) g.push([]); g.push(...tail); }
  const m = new Map<string, string[][]>(Object.entries(book).map(([k, v]) => [k, v.map((r) => [...r])]));
  m.set("ลา-แลกเวร", empty4());
  books.set("S3", m);
}
books.set("KEY", (() => {
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
  return new Map<string, string[][]>([["ตั้งค่า", setG], ["ลา-แลกเวร", empty4()]]);
})());
books.set("SMC", (() => {
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
  return new Map<string, string[][]>([["ตั้งค่า", setG], ["ลา-แลกเวร", empty4()]]);
})());
books.set("OT", (() => {
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
return new Map<string, string[][]>([
  ["ตั้งค่า", setG],
  ["ลา-แลกเวร", [[], [], [], [], ["2026-11-13", "บุปผาชล", "กิตติยาภา", "ลากิจ"]]],
  ["สรุป", [[], ["", "2026-11-02"], ["", "2027-11-29"]]],
]);
})());

// ---------- Google Sheets จำลอง (แยกตาม spreadsheetId) ----------
let calls = 0;
const colNum = (L: string) => [...L].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
function pr(r: string) {
  const m = /^'?([^'!]+)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(r);
  if (!m) throw new Error("range? " + r);
  const c1 = colNum(m[2]), r1 = +m[3];
  return { tab: m[1], c1, r1, c2: m[4] ? colNum(m[4]) : c1, r2: m[5] ? +m[5] : r1 };
}
function read(wb: Map<string, string[][]>, r: string) {
  const { tab, c1, r1, c2, r2 } = pr(r);
  const g = wb.get(tab);
  if (!g) throw new Error("ไม่มีแท็บ " + tab);
  const out: string[][] = [];
  for (let y = r1; y <= r2; y++) { const row: string[] = []; for (let x = c1; x <= c2; x++) row.push(g[y - 1]?.[x - 1] ?? ""); while (row.length && row[row.length - 1] === "") row.pop(); out.push(row); }
  while (out.length && out[out.length - 1].length === 0) out.pop();
  return out;
}
function write(wb: Map<string, string[][]>, r: string, values: unknown[][]) {
  const { tab, c1, r1 } = pr(r);
  const g = wb.get(tab)!;
  values.forEach((row, dy) => row.forEach((v, dx) => { const y = r1 - 1 + dy, x = c1 - 1 + dx; while (g.length <= y) g.push([]); while (g[y].length <= x) g[y].push(""); g[y][x] = v == null ? "" : String(v); }));
}
let leaveReads = 0;
(globalThis as any).fetch = async (url: string, init?: any) => {
  calls++;
  const u = new URL(url);
  const id = decodeURIComponent(u.pathname.split("/spreadsheets/")[1].split(/[/:]/)[0]);
  const wb = books.get(id);
  if (!wb) throw new Error("ไม่มีชีต " + id);
  const json = (o: unknown) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
  if (u.pathname.endsWith("/values:batchGet")) {
    if (id === "LEAVE") leaveReads++;
    return json({ valueRanges: u.searchParams.getAll("ranges").map((r) => ({ values: read(wb, r) })) });
  }
  if (u.pathname.endsWith("/values:batchUpdate")) { for (const d of JSON.parse(init.body).data) write(wb, d.range, d.values); return json({}); }
  if (u.pathname.endsWith(":batchUpdate")) { for (const q of JSON.parse(init.body).requests) if (q.addSheet) wb.set(q.addSheet.properties.title, []); return json({}); }
  return json({ sheets: [...wb.keys()].map((title) => ({ properties: { title } })) });
};

let pass = 0, fail = 0;
const ok = (c: boolean, msg: string) => { if (c) pass++; else { fail++; console.log("  ✗", msg); } };
(async () => {
  const ks = require("../fixtures/key-fixture").keySettings;
  const ss = require("../fixtures/smc-fixture").smcSettings;
  const os = require("../fixtures/ot-fixture").otSettings;
  const s3 = await require("../src/lib/shift3/repo").loadShift3();
  const k = ks.rot[0], sm = ss.key0700 || ss.listL.find((x: string) => x), o = os.staff[0].name, p3 = s3.settings.persons[0].name;
  console.log(`ชื่อทดสอบ: 3 ช่วงเวลา=${p3} · Key=${k} · SMC=${sm} · OT=${o}`);
  const H = ["Timestamp", "ชื่อ - นามสกุล", "ตำแหน่ง", "ประเภทการลา", "เริ่มต้น", "สิ้นสุด", "จำนวน", "สถานะ", "LeaveID"];
  books.set("LEAVE", new Map([["Leave", [
    H,
    ["", `${p3} ก`, "", "ลาป่วย", "15/12/2026", "15/12/2026", "1", "Approve", "A1"],
    ["", `${k} ข`, "", "ลากิจ", "16/12/2026", "16/12/2026", "1", "Approve", "A2"],
    ["", `${sm} ค`, "", "ลาพักร้อน", "17/12/2026", "17/12/2026", "1", "Approve", "A3"],
    ["", `${o} ง`, "", "ลาอื่นๆ", "18/12/2026", "18/12/2026", "1", "Approve", "A4"],
    ["", `${o} ง`, "", "ลาป่วย", "05/01/2027", "05/01/2027", "1", "Approve", "A5"],
  ]]]));
  const ls = require("../src/lib/leave-sync");
  const lt = require("../src/lib/leave-tab");
  console.log("1) ดึงครั้งเดียว (ธ.ค.69) → ครบ 4 ชีต");
  const all = await ls.syncAllLeaves("2569-12", true);
  for (const t of ["shift3", "key", "smc", "ot"]) ok(!all[t].error, `${t} ไม่มีข้อผิดพลาด: ${all[t].error ?? ""}`);
  ok(leaveReads === 1, `อ่านชีตระบบลาครั้งเดียว (อ่าน ${leaveReads} ครั้ง)`);
  const names = async (id: string) => (await lt.readLeaveTab(id)).map((r: any) => `${r.date}|${r.name}`);
  const r3 = await names("S3"), rk = await names("KEY"), rs = await names("SMC"), ro = await names("OT");
  console.log({ r3, rk, rs, ro });
  ok(r3.includes(`2026-12-15|${p3}`), "ชีต 3 ช่วงเวลา ได้การลาของพนักงานตัวเอง");
  ok(rk.includes(`2026-12-16|${k}`), "ชีต Key ได้การลาของพนักงาน Key");
  ok(rs.includes(`2026-12-17|${sm}`), "ชีต SMC ได้การลาของพนักงาน SMC");
  ok(ro.includes(`2026-12-18|${o}`), "ชีต OT ได้การลาของพนักงาน OT");
  ok(!ro.some((x: string) => x.startsWith("2027-01")), "ไม่ดึงเดือนอื่น (ม.ค.)");
  const own = (rows: string[], allow: string[]) => rows.every((x) => allow.includes(x.split("|")[1]));
  const kStaff = await ls.leaveContext("key"), sStaff = await ls.leaveContext("smc"), oStaff = await ls.leaveContext("ot");
  ok(own(rk, kStaff.staff) && own(rs, sStaff.staff) && own(ro, oStaff.staff), "แต่ละชีตรับเฉพาะพนักงานของตารางตัวเอง");
  console.log("2) ดึงซ้ำ ไม่เพิ่มแถวซ้ำ");
  const again = await ls.syncAllLeaves("2569-12", true);
  ok(Object.values(again).every((r: any) => r.added === 0 && r.removed === 0), "ไม่เพิ่ม/ไม่ลบ");
  console.log("2b) คนมาแทนต้องไม่ใช่คนลาเอง / ไม่ใช่คนที่ลาวันเดียวกัน");
  const rules = require("../src/lib/leave-rules");
  const pr = rules.leaveRowProblems([
    { date: "2026-12-18", name: "สมพาน", replacement: "สมพาน" },
    { date: "2026-12-18", name: "เดือน", replacement: " สมพาน " },
    { date: "2026-12-19", name: "เดือน", replacement: "สมพาน" },
    { date: "2026-12-18", name: "จีรินันท์", replacement: "" },
  ]);
  ok(pr.has(0) && pr.has(1) && !pr.has(2) && !pr.has(3), "ตรวจ: แทนตัวเอง / แทนโดยคนที่ลาวันนั้น · ต่างวันได้");
  let blocked = "";
  try {
    await lt.saveLeaveTabMonth("KEY", "2569-12", [{ date: "2026-12-18", name: "สมพาน", replacement: "สมพาน", type: "ลาพักร้อน", note: "" }]);
  } catch (e) { blocked = (e as Error).message; }
  ok(blocked.includes("คนลาเอง"), "บันทึกแทนตัวเองไม่ได้ (ฝั่งเซิร์ฟเวอร์): " + blocked);
  ok((await names("KEY")).join() === rk.join(), "ข้อมูลเดิมไม่ถูกเขียนทับเมื่อบันทึกไม่ผ่าน");
  console.log("3) ชีตหนึ่งผิดพลาด ไม่กระทบชีตอื่น");
  books.get("SMC")!.delete("ลา-แลกเวร");
  books.get("LEAVE")!.get("Leave")!.push(["", `${k} ข`, "", "ลาป่วย", "21/12/2026", "21/12/2026", "1", "Approve", "A6"]);
  await new Promise((r) => setTimeout(r, 16000)); // ผลอ่านระบบลาจำไว้ 15 วินาที
  const part = await ls.syncAllLeaves("2569-12", true);
  ok(!!part.smc.error && !part.key.error && part.key.added === 1, "SMC ผิดพลาด แต่ Key ยังดึงได้: " + JSON.stringify({ smc: part.smc.error, key: part.key }));
  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail} · เรียก API จำลอง ${calls} ครั้ง`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
