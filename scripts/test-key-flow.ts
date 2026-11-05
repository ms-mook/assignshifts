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
  const repo = require("../src/lib/key/repo");
  const eng = require("../src/lib/key/engine");
  const { renderKeyHtml } = require("../src/lib/key/render");
  console.log("1) โหลดและคำนวณ ธ.ค.69");
  let s = await repo.loadKey();
  ok(s.rot.join() === S.rot.join() && s.head === "มุกดารัตน์" && s.rotStart === S.rotStart, "อ่านตั้งค่า");
  let st = await repo.loadKeyMonthState(s, 2569, 12);
  let m = eng.computeKeyMonth(s, st.manual, 2569, 12);
  ok(m.rows[0].cells.D === "สมพาน" && m.checks.status === "✓ ปกติ", "ค่าตามสูตร + ตรวจสอบปกติ");
  console.log("2) แท็บเดือนเดิม → อ่านช่องที่พิมพ์ไว้");
  const tab: string[][] = Array.from({ length: 40 }, () => []);
  m.rows.forEach((r: any, i: number) => { const row = [""]; for (const c of "BCDEFGHIJKLMNOP") row.push(r.cells[c] ?? ""); tab[9 + i] = row; });
  tab[9][1] = "ปณิชา"; // B10 = 1 ธ.ค. Key1
  wb.set("ธ.ค.69", tab);
  st = await repo.loadKeyMonthState(s, 2569, 12);
  ok(st.manual["B:1"] === "ปณิชา" && Object.keys(st.manual).length === 1, "อ่านช่องพิมพ์เอง " + JSON.stringify(st.manual));
  console.log("3) เลือกชื่อ / กันชื่อซ้ำ / คืนค่า");
  let err = await repo.validateKeyManual(2569, 12, "k:H:1", "สมพาน");
  ok(err !== null && err.includes("ช่อง D"), "กันชื่อซ้ำ: " + err);
  ok((await repo.validateKeyManual(2569, 12, "k:H:1", "กฤษณา")) === null, "ชื่อไม่ซ้ำผ่าน");
  await repo.saveKeyManual(2569, 12, [{ key: "k:H:1", value: "กฤษณา" }]);
  st = await repo.loadKeyMonthState(s, 2569, 12);
  ok(st.manual["H:1"] === "กฤษณา", "บันทึกช่อง H");
  await repo.saveKeyManual(2569, 12, [{ key: "k:B:1", value: null }]);
  st = await repo.loadKeyMonthState(s, 2569, 12);
  m = eng.computeKeyMonth(s, st.manual, 2569, 12);
  ok(m.rows[0].cells.B === "", "คืนค่าสูตรช่องที่พิมพ์ไว้ในแท็บเดิม");
  console.log("4) ลา-แลกเวร (แท็บรูปแบบเดียวกันทุกชีต) + ตั้งค่า");
  const lt = require("../src/lib/leave-tab");
  const f = repo.keyToForm(s);
  await lt.saveLeaveTabMonth("KEYSHEET", "2569-12", [{ date: "2026-12-15", name: "สมพาน", replacement: "", type: "", note: "" }]);
  s = await repo.loadKey();
  m = eng.computeKeyMonth(s, {}, 2569, 12);
  ok(m.rows[14].cells.F === "ลา" && m.rows[14].cells.P === "สมพาน ลา" && m.checks.vacancy === 1, "ลายังไม่มีผู้แทน");
  await lt.saveLeaveTabMonth("KEYSHEET", "2569-12", [{ date: "2026-12-15", name: "สมพาน", replacement: "ปณิชา", type: "", note: "" }]);
  s = await repo.loadKey();
  m = eng.computeKeyMonth(s, {}, 2569, 12);
  ok(m.rows[14].cells.F === "ปณิชา" && m.checks.status === "✓ ปกติ", "มีผู้แทน");
  const html = renderKeyHtml(m, s, { editable: true });
  ok(html.includes("#D1EED1") && (html.match(/<tr class="dr"/g) ?? []).length === 31, "วาดตาราง + สีเขียวผู้แทน");
  f.rot[3] = { name: "เดือนใหม่", note: "" };
  f.head = "ชัชวิชญ์";
  await repo.saveKeyForm(f, "settings");
  s = await repo.loadKey();
  m = eng.computeKeyMonth(s, {}, 2569, 12);
  ok(m.rows[0].cells.L === "เดือนใหม่" && m.rows[0].cells.G === "ชัชวิชญ์", "แก้ตั้งค่าแล้วตารางเปลี่ยนตาม");
  ok(s.leaves.length === 1 && s.leaves[0].sub === "ปณิชา", "อ่านการลากลับจากแท็บ ลา-แลกเวร");
  ok(setG.slice(12).every((r) => r.slice(12, 16).every((v) => v === "")), "ไม่เขียน ตั้งค่า M13:P112 (ตารางเก่า) แล้ว");
  let threw = false;
  try { await repo.saveKeyForm(f, "leaves"); } catch { threw = true; }
  ok(threw, "บันทึกการลาผ่านฟอร์มตั้งค่าแบบเดิมไม่ได้แล้ว");
  console.log("4b) ดึงการลาจากระบบลา (เฉพาะเดือน · เฉพาะพนักงานตาราง Key)");
  wb.set("Leave", [
    ["Timestamp", "ชื่อ - นามสกุล", "ตำแหน่ง", "ประเภทการลา", "เริ่มต้น", "สิ้นสุด", "จำนวน", "สถานะ", "LeaveID"],
    ["", "จีรินันท์ ทดสอบ", "", "ลาป่วย", "16/12/2026", "17/12/2026", "2", "Approve", "K1"],
    ["", "ปณิชา ทดสอบ", "", "ลากิจ", "16/12/2026", "16/12/2026", "1", "Approve", "K2"],
    ["", "จีรินันท์ ทดสอบ", "", "ลาพักร้อน", "05/01/2027", "05/01/2027", "1", "Approve", "K3"],
  ]);
  const ls = require("../src/lib/leave-sync");
  const r = await ls.syncLeaves("key", "2569-12", true);
  ok(r.added === 2 && !r.error && r.skippedNames.includes("ปณิชา ทดสอบ"), "ดึง ธ.ค. 2 วัน · คนที่ไม่ใช่พนักงาน Key ไม่ดึง: " + JSON.stringify(r));
  s = await repo.loadKey();
  ok(s.leaves.length === 3 && s.leaves.every((l: any) => l.date < 46388), "ไม่ดึงเดือน ม.ค. · แถวเดิม 15 ธ.ค. ยังอยู่");
  m = eng.computeKeyMonth(s, {}, 2569, 12);
  ok(m.rows[15].cells.P.includes("จีรินันท์ ลา") && Object.values(m.rows[15].cells).includes("ลา"), "ตารางวันที่ 16 ธ.ค. ขึ้นการลา");
  console.log("4c) ไกด์ชื่อจากระบบจองเวร (จุดลงทะเบียนรายการตรวจ · ช่วงเช้า)");
  wb.set("Booking Data", [
    ["Timestamp", "Date", "ชื่อ", "นามสกุล", "ตำแหน่ง", "Room", "Station", "เช้า", "สาย", "บ่าย"],
    ["", "2026-12-02", "น้ำทิพย์", "จังพล", "", "OPD", "จุดลงทะเบียนรายการตรวจ", "06:00-08:30"],
    ["", "2026-12-02", "กฤณา", "ฝาชัยภูมิ", "", "กว.", "จุดลงทะเบียนรายการตรวจ", "06:00-08:30"],
    ["", "2026-12-02", "ธัญญาธร", "นนท์ขุนทด", "", "OPD", "จุดเจาะเลือด", "06:00-08:30"],
    ["", "2026-12-05", "สุนิษา", "จันทะดวง", "", "OPD", "จุดลงทะเบียนรายการตรวจ", "", "06:00-12:00"],
    ["", "2027-01-04", "สุนิษา", "จันทะดวง", "", "OPD", "จุดลงทะเบียนรายการตรวจ", "06:00-08:30"],
    ["", "2026-12-03", "คนใหม่", "ทดสอบ", "", "OPD", "จุดลงทะเบียนรายการตรวจ", "06:00-08:30"],
    ["", "2026-12-02", "น้ำทิพย์", "จังพล", "", "OPD", "จุดลงทะเบียนรายการตรวจ", "06:00-08:30"],
  ]);
  const bk = require("../src/lib/key/booking");
  const gd = await bk.loadKeyBookingGuide(2569, 12, [...s.dropdown, ...s.rot]);
  ok(!gd.error, "อ่านระบบจองได้: " + (gd.error ?? ""));
  ok(JSON.stringify((gd.byDay[2] ?? []).map((x: any) => x.name)) === JSON.stringify(["น้ำทิพย์", "กฤณา"]), "วันที่ 2: เฉพาะจุดลงทะเบียน · ไม่ซ้ำ · ชื่อไม่ตรงไม่เดาแทน: " + JSON.stringify(gd.byDay[2]));
  ok((gd.byDay[2] ?? [])[1]?.note === "ไม่มีในรายชื่อตาราง" && (gd.byDay[2] ?? [])[1]?.booked === "กฤณา ฝาชัยภูมิ", "ชื่อสะกดคล้ายกัน = คนละคน (ไม่จับคู่ ไม่เตือน)");
  ok(!gd.byDay[5] && !Object.values(gd.byDay).flat().some((x: any) => x.name === "ธัญญาธร"), "ไม่ดึงช่วงสาย (ไม่ใช่ H) / ไม่ดึงจุดอื่น / ไม่ดึงเดือนอื่น");
  ok((gd.byDay[3] ?? [])[0]?.name === "คนใหม่" && (gd.byDay[3] ?? [])[0]?.note === "ไม่มีในรายชื่อตาราง", "ชื่อที่ไม่มีในรายชื่อ ยังแสดง (เลือกเองได้)");
  ok(bk.matchName("สมพาน", ["สมพาน", "สมพร"]).matched === "exact" && bk.matchName("นภาพร", ["นิภาพร"]).name === "นภาพร" && bk.matchName("นางสาวฐิติยา ", ["ฐิติยา"]).name === "ฐิติยา", "จับคู่ชื่อ: ตรงกัน · ตัดคำนำหน้า · ชื่อคล้ายไม่จับคู่ (นภาพร ≠ นิภาพร)");
  wb.delete("Booking Data");
  require("../src/lib/booking").invalidateBookings();
  const gd2 = await bk.loadKeyBookingGuide(2569, 12, s.dropdown);
  ok(!!gd2.error && Object.keys(gd2.byDay).length === 0, "อ่านไม่ได้ → แจ้งข้อผิดพลาด ไม่ทำให้หน้าพัง");
  console.log("5) สี");
  await repo.saveKeyStyles(2569, 12, ["k:B:2"], { bg: "#7F7F7F" });
  await repo.saveKeyPersonColors({ "สมพาน": "#C00000" });
  st = await repo.loadKeyMonthState(s, 2569, 12);
  ok(st.styles["k:B:2"]?.bg === "#7F7F7F" && st.personColors["สมพาน"] === "#C00000", "บันทึกสี");
  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail} · เรียก API จำลอง ${calls} ครั้ง`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
