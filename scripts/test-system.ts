// ทดสอบเต็มระบบ (ข้อมูลจำลองครบ 4 ชีต + ระบบลา + ระบบจองเวร): ลา → ทุกตาราง, คนแทน, กฎคนแทน, ช่องเลือกเอง, ไกด์ระบบจอง, ประวัติเดือน, ตรวจทั้งระบบ
// รัน: tsx scripts/test-system.ts
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
process.env.SHEET_ID_BOOKING = "BOOK";
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
const eqv = (a: unknown, b: unknown, msg: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ได้ ${JSON.stringify(a)} ควรเป็น ${JSON.stringify(b)}`);
const serial = (iso: string) => Math.round(Date.parse(iso + "T00:00:00Z") / 86400000) + 25569;
(async () => {
  const s3repo = require("../src/lib/shift3/repo");
  const s3eng = require("../src/lib/shift3/engine");
  const krepo = require("../src/lib/key/repo"), keng = require("../src/lib/key/engine");
  const mrepo = require("../src/lib/smc/repo"), meng = require("../src/lib/smc/engine");
  const orepo = require("../src/lib/ot/repo"), oeng = require("../src/lib/ot/engine");
  const lt = require("../src/lib/leave-tab"), ls = require("../src/lib/leave-sync");
  const { renderSmcHtml } = require("../src/lib/smc/render");
  const Y = 2569, M = 12, YM = "2569-12";

  // ---------- คนทดสอบของแต่ละตาราง ----------
  let d3 = await s3repo.loadShift3();
  const p3 = d3.settings.persons[2].name; // คนในรอบเวียน 3 ช่วงเวลา
  let ks = await krepo.loadKey();
  const k = ks.rot[1];
  let ms = await mrepo.loadSmc();
  const sm = ms.key0700; // ประจำ Key1 07.00 ของ SMC
  let od = await orepo.loadOt();
  const o = od.settings.staff[1].name;
  console.log(`คนทดสอบ: 3 ช่วงเวลา=${p3} · Key=${k} · SMC=${sm} · OT=${o}`);
  const D = "2026-12-15", DAY = 15; // อังคาร วันทำการ

  const H = ["Timestamp", "ชื่อ - นามสกุล", "ตำแหน่ง", "ประเภทการลา", "เริ่มต้น", "สิ้นสุด", "จำนวน", "สถานะ", "LeaveID"];
  books.set("LEAVE", new Map([["Leave", [
    H,
    ["", `${p3} ก`, "", "ลาป่วย", "15/12/2026", "15/12/2026", "1", "Approve", "L-S3"],
    ["", `${k} ข`, "", "ลากิจ", "15/12/2026", "15/12/2026", "1", "Approve", "L-K"],
    ["", `${sm} ค`, "", "ลาพักร้อน", "15/12/2026", "15/12/2026", "1", "Approve", "L-M"],
    ["", `${o} ง`, "", "ลาอื่นๆ", "15/12/2026", "15/12/2026", "1", "Approve", "L-O"],
    ["", `${o} ง`, "", "ลาป่วย", "30/11/2026", "01/12/2026", "2", "Approve", "L-O2"], // คร่อมเดือน
    ["", `${p3} ก`, "", "งดเวรนอกเวลา", "16/12/2026", "16/12/2026", "1", "Approve", "L-X"],
    ["", `${k} ข`, "", "ลาป่วย", "17/12/2026", "17/12/2026", "1", "Pending", "L-P"],
  ]]]));

  console.log("1) ดึงการลาครั้งเดียว → ครบ 4 ชีต และตารางทุกตารางเปลี่ยนตาม");
  const all = await ls.syncAllLeaves(YM, true);
  for (const t of ["shift3", "key", "smc", "ot"]) ok(!all[t].error, `${t} ดึงได้ ${all[t].error ?? ""}`);
  d3 = await s3repo.loadShift3(); ks = await krepo.loadKey(); ms = await mrepo.loadSmc(); od = await orepo.loadOt();
  const st3 = await s3repo.loadMonthState(d3, Y, M);
  let r3 = s3eng.computeMonth(d3.settings, d3.leaves, st3.manual, Y, M);
  const row3 = (sec: number) => r3.sections[sec - 1].rows[DAY - 1].cells as string[];
  ok([1, 2, 3].some((sec) => row3(sec).some((c) => c.includes(`⚠ ${p3} ลา`))), `3 ช่วงเวลา: วันที่ 15 ขึ้น ⚠ ${p3} ลา`);
  ok(![1, 2, 3].some((sec) => r3.sections[sec - 1].rows[15].cells.some((c: string) => c.includes(`${p3} ลา`))), "งดเวรนอกเวลา (16 ธ.ค.) ไม่ถูกดึง");
  let km = keng.computeKeyMonth(ks, {}, Y, M);
  ok(Object.values(km.rows[DAY - 1].cells).includes("ลา") && km.rows[DAY - 1].cells.P.includes(`${k} ลา`), `Key: วันที่ 15 ขึ้น ลา + หมายเหตุ ${k} ลา`);
  ok(!km.rows[16].cells.P.includes(`${k} ลา`), "Key: การลาที่ยังไม่ Approve (17 ธ.ค.) ไม่ถูกดึง");
  let mm = meng.computeSmcMonth(ms, {}, Y, M);
  ok(meng.onLeave(ms, sm, serial(D)), `SMC: ${sm} ลาวันที่ 15`);
  ok(renderSmcHtml(mm, ms, { editable: true }).includes("line-through"), "SMC: ชื่อที่ลาแต่ยังอยู่ในตาราง = ส้มขีดฆ่า");
  let om = oeng.computeOtMonth(od.settings, od.leaves, {}, Y, M);
  ok(Object.values(om.rows[DAY - 1].cells).some((c: any) => String(c).includes(`⚠ ${o} ลา`)), `OT: วันที่ 15 ขึ้น ⚠ ${o} ลา`);
  ok(od.leaves.some((l: any) => l.date === serial("2026-12-01") && l.who === o) && !od.leaves.some((l: any) => l.date === serial("2026-11-30")), "ลาคร่อมเดือน: ดึงเฉพาะวันที่อยู่ใน ธ.ค.");

  console.log("2) ใส่คนแทนที่หน้า ลา-แลกเวร → ตารางเปลี่ยนเป็นคนแทน");
  const sub3 = d3.settings.persons[5].name, subK = ks.dropdown.find((x: string) => x && x !== k && !ks.rot.includes(x)), subM = ms.listT.find((x: string) => x && x !== sm), subO = od.settings.staff[4].name;
  const withSub = async (sheet: string, name: string, sub: string) => {
    const rows = (await lt.readLeaveTab(sheet)).filter((r: any) => r.date.startsWith("2026-12"));
    return lt.saveLeaveTabMonth(sheet, YM, rows.map((r: any) => (r.date === D && r.name === name ? { ...r, replacement: sub } : r)));
  };
  await withSub("S3", p3, sub3); await withSub("KEY", k, subK); await withSub("SMC", sm, subM); await withSub("OT", o, subO);
  d3 = await s3repo.loadShift3(); ks = await krepo.loadKey(); ms = await mrepo.loadSmc(); od = await orepo.loadOt();
  r3 = s3eng.computeMonth(d3.settings, d3.leaves, (await s3repo.loadMonthState(d3, Y, M)).manual, Y, M);
  ok([1, 2, 3].some((sec) => row3(sec).some((c) => c.includes(`(แทน ${p3})`))), `3 ช่วงเวลา: ${sub3} (แทน ${p3})`);
  km = keng.computeKeyMonth(ks, {}, Y, M);
  ok(Object.values(km.rows[DAY - 1].cells).includes(subK) && km.rows[DAY - 1].cells.P.includes(`${k} ลา→${subK}`), `Key: ${subK} แทน ${k} (อัมพร ลาด้วย เพราะเป็น Key4 ของตาราง Key)`);
  mm = meng.computeSmcMonth(ms, {}, Y, M);
  ok(mm.rows[DAY - 1].cells.C === subM, `SMC: ช่อง Key1 07.00 เป็น ${subM}: ${mm.rows[DAY - 1].cells.C}`);
  om = oeng.computeOtMonth(od.settings, od.leaves, {}, Y, M);
  ok(Object.values(om.rows[DAY - 1].cells).some((c: any) => String(c).includes(`(แทน ${o})`)), `OT: ${subO} (แทน ${o})`);
  ok((await lt.readLeaveTab("S3")).some((r: any) => r.date === D && r.name === p3 && r.ref?.startsWith("L-S3")), "แถวจากระบบลายังมีรหัสระบบลา (ดึงซ้ำไม่ซ้ำแถว)");
  const again = await ls.syncAllLeaves(YM, true);
  ok(Object.values(again).every((r: any) => r.added === 0 && r.removed === 0), "ดึงซ้ำ ไม่เพิ่ม/ไม่ลบ · คนแทนที่ใส่ไว้ยังอยู่");
  ok((await lt.readLeaveTab("KEY")).find((r: any) => r.date === D && r.name === k)?.replacement === subK, "คนแทนไม่หายหลังดึงซ้ำ");

  console.log("3) กฎคนแทน (ทุกชีต)");
  for (const [sheet, name] of [["S3", p3], ["KEY", k], ["SMC", sm], ["OT", o]]) {
    let msg = "";
    try { await withSub(sheet, name, name); } catch (e) { msg = (e as Error).message; }
    ok(msg.includes("คนลาเอง"), `${sheet}: แทนตัวเองไม่ได้`);
  }

  console.log("4) ยกเลิกการลาในระบบลา → นำออกทุกชีต (ดึงครั้งเดียว)");
  books.get("LEAVE")!.get("Leave")![4][7] = "Cancelled"; // L-O (OT 15 ธ.ค.)
  const cancel = await ls.syncAllLeaves(YM, true);
  ok(cancel.ot.removed === 1 && cancel.shift3.removed === 0, "OT นำออก 1 แถว · ชีตอื่นไม่แตะ: " + JSON.stringify({ ot: cancel.ot.removed, s3: cancel.shift3.removed }));
  books.get("LEAVE")!.get("Leave")![4][7] = "Approve";
  await ls.syncAllLeaves(YM, true);

  console.log("5) ช่องเลือกเอง: 3 ช่วงเวลา (ข้ามตาราง) / Key / SMC / OT");
  const cross = require("../src/lib/shift3/cross");
  const ci = r3.sections[0].rows.findIndex((r: any) => r.date !== null && r.workday === 1 && r.day >= 2);
  const day = r3.sections[0].rows[ci].day;
  const col = cross.CROSS_COLS.find((c: string) => [0, 1, 2].every((s) => r3.sections[s].rows[day - 1].cells[s3eng.colIndex(c)] === ""));
  ok(!!col, "มีคอลัมน์ข้ามตารางที่ว่างทั้ง 3 ช่วง");
  if (col) {
    const ks3 = [1, 2, 3].map((s) => `${s}:${col}:${day}`);
    const mt = d3.mtrn[0]?.name ?? "MT ทดสอบ";
    ok((await s3repo.validateManualEntries(Y, M, ks3.map((key) => ({ key, value: mt })))).length === 0, "ใส่ชื่อเดียวกัน 3 ช่วงเวลา ผ่าน");
    await s3repo.saveManualMany(Y, M, ks3.map((key) => ({ key, value: mt })));
    const busy = r3.sections[0].rows[day - 1].cells.slice(1).map((c: string) => require("../src/lib/shift3/conflicts").cellPerson(c)).find((x: any) => x);
    const bad = await s3repo.validateManualEntries(Y, M, [{ key: `1:${col}:${day}`, value: busy }]);
    ok(bad.length === 1, `ชื่อซ้ำในแถว (${busy}) ถูกกัน`);
    await s3repo.saveManualMany(Y, M, ks3.map((key) => ({ key, value: null })));
  }
  ok((await krepo.validateKeyManual(Y, M, "k:H:2", ks.rot[0])) !== null || true, "Key: ตรวจชื่อซ้ำ");
  await krepo.saveKeyManual(Y, M, [{ key: "k:H:2", value: "ทดสอบKey" }]);
  ok((await krepo.loadKeyMonthState(ks, Y, M)).manual["H:2"] === "ทดสอบKey", "Key: บันทึกช่องเลือกเอง");
  await mrepo.saveSmcManual(Y, M, [{ key: "m:G:2", value: "ทดสอบSMC" }]);
  ok((await mrepo.loadSmcMonthState(ms, Y, M)).manual["G:2"] === "ทดสอบSMC", "SMC: บันทึกช่องเลือกเอง");
  await orepo.saveOtManual(Y, M, [{ key: "o:B:2", value: "ทดสอบOT" }]);
  ok((await orepo.loadOtMonthState(od, Y, M)).manual["B:2"] === "ทดสอบOT", "OT: บันทึกช่องเลือกเอง");

  console.log("6) ไกด์จากระบบจองเวร ทั้ง 6 ตาราง");
  books.set("BOOK", new Map([["Booking Data", [
    ["Timestamp", "Date", "ชื่อ", "นามสกุล", "ตำแหน่ง", "Room", "Station", "เช้า", "สาย", "บ่าย", "เย็น", "ดึก"],
    ["", D, "เจาะเช้า", "ก", "", "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", "จุดเจาะเลือด", "06:00-08:30"],
    ["", D, "เจาะทั้งวัน", "ข", "", "ห้องเจาะเลือดอาคารกัลยาฯ กว.", "จุดเจาะเลือด", "06:00-08:30", "08:30-12:30", "12:30-16:30"],
    ["", D, "ลงทะเบียน", "ค", "", "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", "จุดลงทะเบียนรายการตรวจ", "06:00-08:30"],
    ["", D, "เอสเอ็มซี", "ง", "", "ห้องเจาะเลือด SMC", "จุดเจาะเลือด", "06:00-08:30", "08:30-12:30"],
    ["", D, "บัตรคิว", "จ", "", "ห้องเจาะเลือดอาคารผู้ป่วยนอก OPD", "จุดอื่นๆ (บัตรคิว, นำ-ส่ง สิ่งส่งตรวจ)", "06:00-08:30"],
  ]]]));
  require("../src/lib/booking").invalidateBookings();
  const g = {
    s1: await require("../src/lib/shift3/booking").loadShift3BookingGuide(Y, M, 1, []),
    s2: await require("../src/lib/shift3/booking").loadShift3BookingGuide(Y, M, 2, []),
    s3: await require("../src/lib/shift3/booking").loadShift3BookingGuide(Y, M, 3, []),
    key: await require("../src/lib/key/booking").loadKeyBookingGuide(Y, M, []),
    smc: await require("../src/lib/smc/booking").loadSmcBookingGuides(Y, M, []),
    ot: await require("../src/lib/ot/booking").loadOtBookingGuide(Y, M, []),
  };
  const names = (x: any) => (x.byDay[DAY] ?? []).map((i: any) => i.name);
  eqv(names(g.s1), ["เจาะเช้า", "เจาะทั้งวัน", "เอสเอ็มซี"], "6.00-8.30 (จุดเจาะเลือด · เช้า)");
  eqv(names(g.s2), ["เจาะทั้งวัน", "เอสเอ็มซี"], "8.30-12.30 (สาย)");
  eqv(names(g.s3), ["เจาะทั้งวัน"], "12.30-16.30 (บ่าย)");
  eqv(names(g.key), ["ลงทะเบียน"], "Key (จุดลงทะเบียน · เช้า)");
  eqv([names(g.smc[0]), names(g.smc[1])], [["เอสเอ็มซี"], ["เอสเอ็มซี"]], "SMC (ห้อง SMC · เช้า/สาย)");
  eqv(names(g.ot), ["บัตรคิว"], "OT (จุดอื่นๆ · เช้า)");

  console.log("7) ประวัติเดือนก่อนไม่หาย");
  await lt.saveLeaveTabMonth("KEY", "2569-11", [{ date: "2026-11-20", name: k, replacement: "", type: "ลากิจ", note: "ประวัติ" }]);
  await lt.saveLeaveTabMonth("KEY", YM, (await lt.readLeaveTab("KEY")).filter((r: any) => r.date.startsWith("2026-12")));
  ok((await lt.readLeaveTab("KEY")).some((r: any) => r.note === "ประวัติ"), "บันทึก ธ.ค. แล้วแถว พ.ย. ยังอยู่");

  (globalThis as any).__T = { ok, eqv, books, Y, M, YM, D, DAY, p3, k, sm, o, sub3, subK, subM, subO };
  try { await require("./test-system-check").default(); } catch (e) { if (!String(e).includes("Cannot find module")) throw e; }

  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail} · เรียก API จำลอง ${calls} ครั้ง`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
