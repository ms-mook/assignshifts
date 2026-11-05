// ทดสอบเว็บส่วน OT (จุดรับ-นำส่ง) แบบครบวงจรด้วย Google Sheets จำลองในหน่วยความจำ
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
  if (req === "server-only" || req === "next/headers" || req === "google-auth-library") return path.join(__dirname, "stubs", req.replace("/", "_") + ".js");
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
  const repo = require("../src/lib/smc/repo");
  const eng = require("../src/lib/smc/engine");
  const { renderSmcHtml } = require("../src/lib/smc/render");
  console.log("1) โหลดและคำนวณ ธ.ค.69");
  let s = await repo.loadSmc();
  ok(s.key0700 === "อัมพร" && s.hours[1] === 4 && s.listL.filter((x: string) => x).length === 15, "อ่านตั้งค่า");
  let st = await repo.loadSmcMonthState(s, 2569, 12);
  let m = eng.computeSmcMonth(s, st.manual, 2569, 12);
  ok(m.rows[0].cells.C === "อัมพร" && m.workdays === 20, "ค่าตามสูตร");
  console.log("2) แท็บเดือนเดิม");
  const tab: string[][] = Array.from({ length: 37 }, () => []);
  m.rows.forEach((r: any, i: number) => { const row = [""]; for (const c of "BCDEFGHIJKLMNOPQRST") row.push(r.cells[c] ?? ""); tab[6 + i] = row; });
  tab[6][6] = "จุฑาพร"; // G7 = 1 ธ.ค. ช่อง3 (A=0,B=1,…,G=6)
  wb.set("ธ.ค.69", tab);
  st = await repo.loadSmcMonthState(s, 2569, 12);
  ok(st.manual["G:1"] === "จุฑาพร" && Object.keys(st.manual).length === 1, "อ่านช่องที่เลือกไว้ " + JSON.stringify(st.manual));
  console.log("3) เลือกชื่อ / กันชื่อซ้ำในช่วงเวลาเดียวกัน");
  ok((await repo.validateSmcManual(2569, 12, "m:H:1", "จุฑาพร")) !== null, "ซ้ำในช่วง 07.00 ถูกกัน");
  ok((await repo.validateSmcManual(2569, 12, "m:O:1", "จุฑาพร")) === null, "ต่างช่วงเวลาได้");
  await repo.saveSmcManual(2569, 12, [{ key: "m:O:1", value: "จุฑาพร" }, { key: "m:G:1", value: null }]);
  st = await repo.loadSmcMonthState(s, 2569, 12);
  m = eng.computeSmcMonth(s, st.manual, 2569, 12);
  ok(m.rows[0].cells.O === "จุฑาพร" && m.rows[0].cells.G === "", "บันทึก O + คืนค่า G");
  const p = m.people.find((x: any) => x.name === "จุฑาพร");
  ok(p.days === 1 && p.h0830 === 4 && p.hTotal === 4, "สรุปวัน/ชั่วโมง");
  console.log("4) ลา-แลกเวร (1 แถวต่อ 1 วัน)");
  const lt = require("../src/lib/leave-tab");
  const f = repo.smcToForm(s);
  const two = (sub: string) => ["2026-12-15", "2026-12-16"].map((date) => ({ date, name: "อัมพร", replacement: sub, type: "ลาพักร้อน", note: "" }));
  await lt.saveLeaveTabMonth("SMCSHEET", "2569-12", two("สมพาน"));
  s = await repo.loadSmc();
  m = eng.computeSmcMonth(s, {}, 2569, 12);
  ok(m.rows[14].cells.C === "สมพาน" && m.rows[15].cells.Q === "สมพาน" && m.rows[16].cells.C === "อัมพร", "คนแทนช่วงวันที่ลา");
  await lt.saveLeaveTabMonth("SMCSHEET", "2569-12", two(""));
  s = await repo.loadSmc();
  m = eng.computeSmcMonth(s, {}, 2569, 12);
  const html = renderSmcHtml(m, s, { editable: true });
  ok(html.includes("line-through") && (html.match(/<tr class="dr"/g) ?? []).length === 31, "ชื่อที่ลาค้าง = ส้มขีดฆ่า");
  ok(s.leaves.length === 2 && s.leaves.every((l: any) => l.start === l.end && l.name === "อัมพร"), "อ่านการลากลับจากแท็บ ลา-แลกเวร");
  ok(!wb.has("ตารางลา") || (wb.get("ตารางลา") ?? []).every((r) => r.every((v) => v === "")), "ไม่เขียนแท็บ ตารางลา เดิม");
  console.log("4b) ดึงการลาจากระบบลา (SMC)");
  wb.set("Leave", [
    ["Timestamp", "ชื่อ - นามสกุล", "ตำแหน่ง", "ประเภทการลา", "เริ่มต้น", "สิ้นสุด", "จำนวน", "สถานะ", "LeaveID"],
    ["", "อัมพร นามสี", "", "ลาป่วย", "21/12/2026", "22/12/2026", "2", "Approve", "S1"],
    ["", "อัมพร นามสี", "", "งดเวรนอกเวลา", "23/12/2026", "23/12/2026", "1", "Approve", "S2"],
  ]);
  const ls = require("../src/lib/leave-sync");
  const r = await ls.syncLeaves("smc", "2569-12", true);
  ok(r.added === 2 && !r.error, "ดึง 2 วัน (ไม่ดึงงดเวรนอกเวลา): " + JSON.stringify(r));
  s = await repo.loadSmc();
  m = eng.computeSmcMonth(s, {}, 2569, 12);
  ok(eng.onLeave(s, "อัมพร", m.rows[20].date) && !eng.onLeave(s, "อัมพร", m.rows[22].date), "วันที่ 21 ธ.ค. อัมพร ลา · 23 ธ.ค. ไม่ลา");
  console.log("4c) ไกด์ชื่อจากระบบจองเวร (ห้องเจาะเลือด SMC · ช่อง3/4/5 = เช้า · ช่อง3,4/5 = สาย)");
  wb.set("Booking Data", [
    ["Timestamp", "Date", "ชื่อ", "นามสกุล", "ตำแหน่ง", "Room", "Station", "เช้า", "สาย", "บ่าย"],
    ["", "2026-12-02", "นิภาพร", "ช่างเหลา", "", "ห้องเจาะเลือด SMC", "จุดเจาะเลือด", "06:00-08:30"],
    ["", "2026-12-02", "ปรางทิพย์ ", "ชาญพานิชย์", "", "ห้องเจาะเลือด SMC", "จุดเจาะเลือด", "06:00-08:30", "08:30-12:30"],
    ["", "2026-12-02", "นางสาวฐิติยา", "ผันผาย", "", "ห้องเจาะเลือด SMC", "จุดอื่นๆ (บัตรคิว, นำ-ส่ง สิ่งส่งตรวจ)", "06:00-08:30"],
    ["", "2026-12-02", "ธัญญาธร", "นนท์ขุนทด", "", "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", "จุดเจาะเลือด", "06:00-08:30"],
    ["", "2027-01-04", "นิภาพร", "ช่างเหลา", "", "ห้องเจาะเลือด SMC", "จุดเจาะเลือด", "06:00-08:30"],
  ]);
  const sb = require("../src/lib/smc/booking");
  const [gm, gl] = await sb.loadSmcBookingGuides(2569, 12, [...s.listJ, ...s.listL, ...s.listN, ...s.listP, "ปรางทิพย์", "ฐิติยา"]);
  ok(!gm.error && gm.cols.join() === "G,H,I" && gl.cols.join() === "O,P", "แยกไกด์ ช่อง3/4/5 (G H I) และ ช่อง3,4/5 (O P): " + (gm.error ?? ""));
  ok(JSON.stringify((gm.byDay[2] ?? []).map((x: any) => x.name)) === JSON.stringify(["นิภาพร", "ปรางทิพย์", "ฐิติยา"]), "เช้า: เฉพาะห้อง SMC ทุกจุด · ตัดคำนำหน้า/ช่องว่าง: " + JSON.stringify(gm.byDay[2]));
  ok(JSON.stringify((gl.byDay[2] ?? []).map((x: any) => x.name)) === JSON.stringify(["ปรางทิพย์"]), "สาย: เฉพาะคนที่จองช่วง 08:30-12:30");
  ok(!gm.byDay[4] && (gm.byDay[2] ?? [])[2]?.slot?.includes("จุดอื่นๆ"), "ไม่ดึงเดือนอื่น · บอกจุดที่จองไว้");
  console.log("5) ตั้งค่า");
  f.key0700 = "นิภาพร"; f.listT = ["สมพาน", "เดือน"];
  await repo.saveSmcForm(f, "settings");
  s = await repo.loadSmc();
  m = eng.computeSmcMonth(s, {}, 2569, 12);
  ok(m.rows[0].cells.C === "นิภาพร" && s.listT.filter((x: string) => x).join() === "สมพาน,เดือน", "แก้ตั้งค่าแล้วตารางเปลี่ยนตาม");
  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail} · เรียก API จำลอง ${calls} ครั้ง`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
