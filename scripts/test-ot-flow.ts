// ทดสอบเว็บส่วน OT (จุดรับ-นำส่ง) แบบครบวงจรด้วย Google Sheets จำลองในหน่วยความจำ
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

(async () => {
  const repo = require("../src/lib/ot/repo");
  const eng = require("../src/lib/ot/engine");
  const { renderOtHtml } = require("../src/lib/ot/render");

  console.log("1) โหลดข้อมูลและคำนวณ พ.ย.69 (มีการลา 13 พ.ย.)");
  let d = await repo.loadOt();
  ok(d.settings.pattern === 6 && d.settings.staff[7].start === S.staff[7].start, "อ่านตั้งค่า");
  ok(d.leaves.length === 1 && d.leaves[0].who === "บุปผาชล", "อ่านลา-แลกเวร");
  let st = await repo.loadOtMonthState(d, 2569, 11);
  let m = eng.computeOtMonth(d.settings, d.leaves, st.manual, 2569, 11);
  ok(m.rows[12].cells.C === "กิตติยาภา (แทน บุปผาชล)" && m.rows[12].cells.K === "→ ไปช่วยจุดอื่น", "แทนคนลา + ไปช่วยจุดอื่น");

  console.log("2) แท็บเดือนเดิม: ค่าที่พิมพ์ไว้ในชีตถูกอ่านเป็นช่องเลือกเอง");
  const tab: string[][] = Array.from({ length: 38 }, () => []);
  m.rows.forEach((r: any, i: number) => { const row = [""]; for (const c of "BCDEFGHIJKLMNO") row.push(r.cells[c] ?? ""); tab[7 + i] = row; });
  tab[8][1] = "จิรายุทธ"; // B9 = 2 พ.ย.
  tab[19][14] = "บุปผาชล ลากิจ"; // O20 พิมพ์ทับสูตร
  wb.set("พ.ย.69", tab);
  st = await repo.loadOtMonthState(d, 2569, 11);
  ok(st.manual["B:2"] === "จิรายุทธ" && st.manual["O:13"] === "บุปผาชล ลากิจ" && Object.keys(st.manual).length === 2, "อ่านช่องพิมพ์เองจากแท็บ " + JSON.stringify(st.manual));

  console.log("3) เลือกชื่อ / กันชื่อซ้ำ / ล้าง / คืนค่าสูตร");
  let err = await repo.validateOtManual(2569, 11, "o:B:3", "กิตติยาภา"); // กิตติยาภาอยู่ C วันที่ 3 แล้ว
  ok(err !== null && err.includes("ช่อง C"), "กันชื่อซ้ำ: " + err);
  err = await repo.validateOtManual(2569, 11, "o:B:3", "เกษมสันต์");
  ok(err === null, "ชื่อไม่ซ้ำผ่าน");
  await repo.saveOtManual(2569, 11, [{ key: "o:B:3", value: "เกษมสันต์" }]);
  st = await repo.loadOtMonthState(d, 2569, 11);
  ok(st.manual["B:3"] === "เกษมสันต์", "บันทึกช่อง B");
  ok(read("'พ.ย.69'!B10:B10").length === 0, "ไม่เขียนทับแท็บเดือนเดิม");
  await repo.saveOtManual(2569, 11, [{ key: "o:C:6", value: "" }]);
  st = await repo.loadOtMonthState(d, 2569, 11);
  m = eng.computeOtMonth(d.settings, d.leaves, st.manual, 2569, 11);
  ok(m.rows[5].cells.C === "", "ล้างช่องสูตรให้ว่าง");
  await repo.saveOtManual(2569, 11, [{ key: "o:C:6", value: null }, { key: "o:O:13", value: null }]);
  st = await repo.loadOtMonthState(d, 2569, 11);
  m = eng.computeOtMonth(d.settings, d.leaves, st.manual, 2569, 11);
  ok(m.rows[5].cells.C === "กิตติยาภา", "คืนค่าสูตรช่อง C");
  ok(m.rows[12].cells.O === "", "คืนค่าสูตร O ที่เคยพิมพ์ทับในแท็บเดิม → กลับเป็นสูตร (ไม่ใช่วันหยุด = ว่าง)");

  console.log("4) สีช่อง/สีพนักงาน + วาดตาราง");
  await repo.saveOtStyles(2569, 11, ["o:E:2", "o:F:2"], { bg: "#7F7F7F" });
  await repo.saveOtPersonColors({ "รัษฎากร": "#C00000" });
  st = await repo.loadOtMonthState(d, 2569, 11);
  ok(st.styles["o:E:2"]?.bg === "#7F7F7F" && st.personColors["รัษฎากร"] === "#C00000", "บันทึกสี");
  const html = renderOtHtml(eng.computeOtMonth(d.settings, d.leaves, st.manual, 2569, 11), { editable: true, styles: st.styles, personColors: st.personColors });
  ok(html.includes('data-k="o:E:2"') && html.includes("background:#7F7F7F") && html.includes("color:#C00000"), "วาดสีในตาราง");
  ok((html.match(/<tr class="dr"/g) ?? []).length === 31, "31 แถวข้อมูล");

  console.log("5) สลับรูปแบบการเวียน (เมนู Apps Script)");
  ok((await repo.stepOtPattern(1)) === 7, "6 → 7");
  ok((await repo.stepOtPattern(1)) === 1, "7 → 1 (วนรอบ)");
  ok((await repo.stepOtPattern(-1)) === 7, "1 → 7 (ย้อน)");
  await repo.stepOtPattern(1); await repo.stepOtPattern(1); await repo.stepOtPattern(1); await repo.stepOtPattern(1); await repo.stepOtPattern(1); await repo.stepOtPattern(1);
  d = await repo.loadOt();
  ok(d.settings.pattern === 6, "กลับมารูปแบบ 6");

  console.log("6) ตั้งค่า: คนลาออก + ผู้มาแทน");
  const f = repo.otToForm(d);
  f.staff[2] = { ...f.staff[2], last: "2026-12-11", rep: "สมปอง", repStart: "2026-12-21" };
  await repo.saveOtSettings(f);
  d = await repo.loadOt();
  ok(d.settings.staff[2].rep === "สมปอง", "บันทึกผู้มาแทน");
  const plan = new eng.OtPlan(d.settings);
  const w7 = plan.week(7); // 14-18 ธ.ค. รัษฎากรออกแล้ว ยังไม่มีคนแทน
  ok(eng.spotCol(w7).every((v: string) => v !== "รัษฎากร") && w7.L !== "", "สัปดาห์ที่ขาดคน: " + w7.L);
  const w8 = plan.week(8);
  ok(eng.spotCol(w8).includes("สมปอง"), "ผู้มาแทนรับคิวต่อ");
  ok(JSON.stringify(repo.otToForm(d)) === JSON.stringify(f), "อ่านกลับตรงกับที่บันทึก");

  console.log("7) ลา-แลกเวร");
  await repo.saveOtLeaves([{ date: "2026-12-15", who: "อุษณีย์", sub: "", type: "ลาป่วย" }]);
  d = await repo.loadOt();
  m = eng.computeOtMonth(d.settings, d.leaves, {}, 2569, 12);
  ok(Object.values(m.rows[14].cells).includes("⚠ อุษณีย์ ลา"), "ยังไม่มีคนแทน → ⚠");
  const info = eng.leaveInfo(d.settings, d.leaves[0]);
  ok(info.spot !== "" && info.smcPerson !== "", "จุดของคนลา/คนแนะนำ: " + JSON.stringify(info));

  console.log("8) สรุปหลายเดือน");
  const many = await repo.loadOtManyMonths(d, [{ y: 2569, m: 11 }, { y: 2569, m: 12 }]);
  ok(many["2569-11"]["B:2"] === "จิรายุทธ" && many["2569-11"]["B:3"] === "เกษมสันต์", "อ่านช่องเลือกเองหลายเดือน");

  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail} · เรียก API จำลอง ${calls} ครั้ง`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
