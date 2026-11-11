// ทดสอบ ตารางเวรนอกเวลา ด้วยชีตจำลองทั้งหมด (แท็บเดือน / ตั้งค่า / แท็บเว็บ / ระบบลา)
// รัน: tsx scripts/test-off-flow.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const require: any;
declare const process: any;
declare const __dirname: string;
process.env.SHEET_TITLES_TTL_MS = "0";
const path = require("path");
const Module = require("module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (req: string, ...rest: any[]) {
  if (req === "server-only" || req === "next/headers" || req === "next/server" || req === "google-auth-library") return path.join(__dirname, "stubs", req.replace("/", "_") + ".js");
  return orig.call(this, req, ...rest);
};
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "test@example.iam";
process.env.GOOGLE_PRIVATE_KEY = "test";
process.env.SHEET_ID_OFF = "OFFSHEET";
process.env.SHEET_ID_LEAVE_SYSTEM = "LEAVESHEET";

// ---------- ข้อมูลจำลอง ----------
const STAFF = ["สมพาน", "จีรินันท์", "เดือน", "อัมพร", "ศศิประภา", "กฤษฎา", "มุกดารัตน์", "ภัทรสุดา", "ชัชวิชญ์", "เพชรชรินทร์", "ณัฐณิชา", "บัวปรีญา", "กนกดาว", "อาภาศิริ", "อรพรรณ", "นันธิชา", "วรินยุพา", "สาวิลักษณ์", "ภูมิโชค", "วิภาวดี"];
const HJ = ["มุกดารัตน์", "กฤษฎา", "ภัทรสุดา", "ชัชวิชญ์"];
const COLL = ["สุพัตตรา", "ขวัญจิรา", "จำเลียง", "ยอดชาย", "นัฐ"];
const KEYY = ["เดือน", "อัมพร", "ศศิประภา", "กฤษฎา"];
const ZL = ["กฤษฎา", "มุกดารัตน์", "ภัทรสุดา", "ชัชวิชญ์"];
const WD = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const L = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** สร้างแท็บเดือนจำลอง (ค่าที่สูตรคำนวณแล้ว) — closed = วันที่งดบริการ */
function monthTab(yCE: number, m: number, seed: number, closed: number[]): string[][] {
  const g: string[][] = Array.from({ length: 40 }, () => Array(30).fill(""));
  g[0][0] = "ตารางเวรปฏิบัติงานหน่วยเจาะเลือดเก็บสิ่งส่งตรวจและ POCT (คลินิกบูรณาการนอกเวลา และ SMC นอกเวลา) FM-CL-05-005-01";
  g[1][0] = `ประจำเดือน ${MONTHS[m - 1]} พ.ศ.${yCE + 543}`;
  const heads: Record<string, string> = { A3: "วันที่", B3: "วัน", C3: "ห้องเจาะเลือดฯ คลินิกบูรณาการนอกเวลา (ห้องเจาะเลือด OPD)", T3: "ห้องเจาะเลือด SMC / Check-up", X3: "วันที่", Y3: "นอกเวลา (จ.-ศ.) OPD", C4: "จุด Key (เริ่ม 06.00-.....)", H4: "จุดเจาะเลือด (เริ่ม 06.00-.....)", Q4: "จุดเก็บ-บัตรคิว (เริ่ม 06.00-.....)", Y4: "Key/เก็บ", Z4: "เจาะเลือด", T5: "ประจำ SMC 07.00-12.00 น.", Y5: "16.30-20.30 น. (+OT)" };
  const r6 = ["Key 1", "Key 2", "Key 3", "Key 4", "Key 5", "ช่อง 6(E)", "ช่อง 7", "ช่อง 8", "ช่อง 9", "ช่อง 10", "ช่อง 11", "ช่อง 12", "ช่อง 13", "ช่อง 14,16", "เก็บ 1", "เก็บ 2", "บัตรคิว", "Key SMC(E)", "ช่อง 1 SMC", "ช่อง 2 C/U", "เก็บ SMC"];
  r6.forEach((t, i) => (heads[`${String.fromCharCode(67 + i)}6`] = t));
  heads.Y6 = "Key ช่อง 2";
  heads.Z6 = "เวร ช่อง 6";
  for (const [k, v] of Object.entries(heads)) g[Number(k.slice(1)) - 1][L(k[0])] = v;
  const nd = new Date(Date.UTC(yCE, m, 0)).getUTCDate();
  let s = seed;
  const rnd = (n: number) => ((s = (s * 48271) % 2147483647), Math.floor((s / 2147483647) * n));
  for (let d = 1; d <= 31; d++) {
    const r = g[5 + d];
    if (d > nd) continue;
    const wd = new Date(Date.UTC(yCE, m - 1, d)).getUTCDay();
    r[0] = String(d);
    r[1] = WD[wd];
    r[L("X")] = String(d);
    const isClosed = closed.includes(d);
    r[L("AC")] = wd === 0 || wd === 6 || isClosed ? "1" : "0";
    r[L("AD")] = isClosed ? "1" : "0";
    if (isClosed) continue;
    if (wd === 0 || wd === 6) {
      // 1 คน 1 จุดต่อวัน (ข้อมูลตั้งต้นไม่มีชื่อซ้ำในวันเดียวกัน)
      const used = new Set<string>();
      const pick = (list: string[]) => { const free = list.filter((x) => !used.has(x)); if (!free.length) return ""; const n = free[rnd(free.length)]; used.add(n); return n; };
      if (d === 12 || d === 13) { r[L("I")] = "เดือน"; used.add("เดือน"); } // ชื่อซ้ำในคอลัมน์ I ข้ามวัน (กฎชมพู)
      for (const c of "HJ") r[L(c)] = pick(HJ);
      for (const c of "CDEFGIKLMNOPTUV") if (r[L(c)] === "" && rnd(5) > 0) r[L(c)] = pick(STAFF);
      for (const c of "QRSW") if (rnd(3) > 0) r[L(c)] = pick(COLL);
    } else {
      if (rnd(4) > 0) r[L("Y")] = KEYY[rnd(KEYY.length)];
      if (rnd(4) > 0) r[L("Z")] = ZL[rnd(ZL.length)];
    }
  }
  g[38][L("Q")] = "(......................................................)";
  g[39][L("Q")] = "หัวหน้าหน่วยเจาะเลือด เก็บสิ่งส่งตรวจและ POCT";
  return g;
}
const settings: string[][] = Array.from({ length: 105 }, () => Array(10).fill(""));
STAFF.forEach((n, i) => (settings[i][0] = n)); // T5..
HJ.forEach((n, i) => (settings[4 + i][4] = n)); // X9..X12
COLL.forEach((n, i) => (settings[i][9] = n)); // AC5.. (ย้ายจาก X16:X41)
ZL.forEach((n, i) => (settings[39 + i][4] = n)); // X44..
KEYY.forEach((n, i) => (settings[47 + i][3] = n)); // W52..

const books: Record<string, Map<string, string[][]>> = {
  OFFSHEET: new Map([
    // แท็บหลัก ส-อา: แถว 4–107 · C = วันที่ (serial) เหมือนสูตร DATE(2026,12,5)+INT((n-1)/2)*7+MOD(n-1,2)
    ["ตารางเวร ส-อา", (() => { const g: string[][] = [[], [], []]; for (let n = 1; n <= 104; n++) g.push(["", "", String(46361 + Math.floor((n - 1) / 2) * 7 + ((n - 1) % 2))]); return g; })()],
    ["ธ.ค. 69", monthTab(2026, 12, 7, [5])],
    ["ก.พ. 70", monthTab(2027, 2, 11, [])],
    ["ตั้งค่า", (() => { const g: string[][] = Array.from({ length: 110 }, () => []); settings.forEach((row, i) => { g[4 + i] = Array(19).fill("").concat(row); }); return g; })()],
  ]),
  LEAVESHEET: new Map([["Leave", [["ts", "ชื่อ-สกุล", "", "ประเภท", "เริ่ม", "สิ้นสุด", "", "สถานะ", "id"]]]]),
};
const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
function pr(r: string) {
  const m = /^'?([^'!]+)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(r);
  if (!m) throw new Error("range? " + r);
  const c1 = colNum(m[2]), r1 = +m[3];
  return { tab: m[1], c1, r1, c2: m[4] ? colNum(m[4]) : c1, r2: m[5] ? +m[5] : r1 };
}
const bookOf = (url: string) => { const id = /spreadsheets\/([^/:?]+)/.exec(url)![1]; const b = books[id]; if (!b) throw new Error("ไม่มีชีต " + id); return b; };
function read(wb: Map<string, string[][]>, r: string) {
  const { tab, c1, r1, c2, r2 } = pr(r);
  const g = wb.get(tab);
  if (!g) throw new Error("ไม่มีแท็บ " + tab);
  const out: string[][] = [];
  for (let y = r1; y <= r2; y++) { const row: string[] = []; for (let x = c1; x <= c2; x++) row.push(g[y - 1]?.[x - 1] ?? ""); while (row.length && row[row.length - 1] === "") row.pop(); out.push(row); }
  while (out.length && out[out.length - 1].length === 0) out.pop();
  return out;
}
const writes: string[] = [];
function write(wb: Map<string, string[][]>, r: string, values: unknown[][]) {
  const { tab, c1, r1 } = pr(r);
  writes.push(tab);
  const g = wb.get(tab)!;
  values.forEach((row, dy) => row.forEach((v, dx) => { const y = r1 - 1 + dy, x = c1 - 1 + dx; while (g.length <= y) g.push([]); while (g[y].length <= x) g[y].push(""); g[y][x] = v == null ? "" : String(v); }));
}
(globalThis as any).fetch = async (url: string, init?: any) => {
  const u = new URL(url);
  const wb = bookOf(url);
  const json = (o: unknown) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
  if (u.pathname.endsWith("/values:batchGet")) return json({ valueRanges: u.searchParams.getAll("ranges").map((r) => ({ values: read(wb, r) })) });
  if (u.pathname.endsWith("/values:batchUpdate")) { const b = JSON.parse(init.body); for (const d of b.data) write(wb, d.range, d.values); return json({}); }
  if (u.pathname.endsWith(":batchUpdate")) { const b = JSON.parse(init.body); for (const q of b.requests) if (q.addSheet) wb.set(q.addSheet.properties.title, []); return json({}); }
  if (u.searchParams.get("fields") === "sheets.properties.title") return json({ sheets: [...wb.keys()].map((title) => ({ properties: { title } })) });
  throw new Error("API? " + url);
};

let pass = 0, fail = 0;
const ok = (c: boolean, msg: string) => { if (c) pass++; else { fail++; console.log("✗", msg); } };
const eq = (a: unknown, b: unknown, msg: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

(async () => {
  const repo = require("../src/lib/off/repo");
  const eng = require("../src/lib/off/engine");
  const rnd = require("../src/lib/off/render");
  const ls = require("../src/lib/leave-system");
  const manual = require("../src/app/api/off/manual/route");
  const style = require("../src/app/api/off/style/route");
  const pcol = require("../src/app/api/off/person-colors/route");
  const call = (h: any, body: unknown) => h.POST({ json: async () => body });
  const dec = books.OFFSHEET.get("ธ.ค. 69")!;
  const cellOf = (g: string[][], col: string, day: number) => g[5 + day]?.[L(col)] ?? "";

  console.log("1) อ่านแท็บเดือน (ค่าจากสูตร) ตรงทุกช่อง");
  let st = await repo.loadOffMonth(2569, 12);
  ok(st.hasTab && st.tab === "ธ.ค. 69", "พบแท็บ ธ.ค. 69 (มีเว้นวรรค)");
  let mism = 0;
  for (const r of st.month.rows) for (const c of eng.OFF_EDIT_COLS) if ((r.cells[c] ?? "") !== cellOf(dec, c, r.day)) mism++;
  eq(mism, 0, "ทุกช่อง C–W, Y, Z ตรงกับแท็บเดือน");
  ok(st.month.rows.every((r: any) => r.date !== null), "ธ.ค. มี 31 วัน");
  eq(st.month.rows[4].AD, 1, "วันที่ 5 งดบริการ (AD=1)");
  eq(st.month.head.C6, "Key 1", "หัวคอลัมน์อ่านจากชีต");
  eq(st.month.signerTitle, "หัวหน้าหน่วยเจาะเลือด เก็บสิ่งส่งตรวจและ POCT", "ผู้ลงนาม Q40");
  eq(st.lists.hj, HJ, "รายชื่อ X9:X12");
  eq(st.lists.keyY, [...KEYY, "", "", "", ""], "รายชื่อ W52:W59");
  eq(st.lists.z, [...ZL, "", ""], "รายชื่อ X44:X49");
  eq(st.lists.coll.filter((x: string) => x), COLL, "รายชื่อ X16:X41");
  const feb = await repo.loadOffMonth(2570, 2);
  ok(feb.month.rows[27].date !== null && feb.month.rows[28].date === null && feb.month.rows[30].date === null, "ก.พ. 70 มี 28 วัน (วันที่ 29–31 ว่าง)");
  const none = await repo.loadOffMonth(2571, 1);
  ok(!none.hasTab && none.month.rows.every((r: any) => r.date === null), "เดือนที่ไม่มีแท็บ → ไม่มีข้อมูล ไม่ error");

  console.log("2) กฎจัดรูปแบบตามเงื่อนไข (ลำดับเหมือนชีต)");
  const mo = st.month;
  const counts = Object.fromEntries(eng.OFF_EDIT_COLS.map((c: string) => [c, eng.colCounts(mo.rows, c)]));
  const dc = (c: string, v: string) => counts[c]?.get(v.trim().toLowerCase()) ?? 0;
  const day = (d: number) => mo.rows[d - 1];
  // ธ.ค. 2026: 1 = อังคาร · 5 = เสาร์ (งดบริการ) · 6 = อาทิตย์ · 12 = เสาร์ · 13 = อาทิตย์
  eq(eng.cfOf(day(1), "C", dc)?.bg, "#D5D5D5", "วันธรรมดา C:W เทา");
  eq(eng.cfOf(day(5), "C", dc)?.bg, "#D5D5D5", "งดบริการ C:W เทา");
  eq(eng.cfOf(day(5), "A", dc), { fg: "#CC0000", bold: true }, "งดบริการ A ตัวแดงหนา");
  eq(eng.cfOf(day(6), "R", dc)?.bg, "#D5D5D5", "อาทิตย์ R เทา (แม้มีชื่อ)");
  eq(eng.cfOf(day(6), "G", dc)?.bg, "#D5D5D5", "อาทิตย์ G เทา");
  eq(eng.cfOf(day(6), "J", dc)?.bg, "#D5D5D5", "อาทิตย์ J เทา");
  eq(eng.cfOf(day(12), "G", dc), (day(12).cells.G ?? "") === "" ? null : null, "เสาร์ G ไม่เทา (กฎว่าง C:E/I/L:P/T:V ไม่ครอบ G)");
  eq(eng.cfOf(day(6), "B", dc), { fg: "#BF0000", bold: true }, "อาทิตย์ B ตัวแดง");
  eq(eng.cfOf(day(12), "B", dc), null, "เสาร์ B ปกติ");
  // เสาร์ว่าง C → เทา · มีชื่อ → ไม่เทา
  const sat = day(12);
  for (const c of ["C", "D", "E", "I", "L", "T"]) {
    const f = eng.cfOf(sat, c, dc);
    if ((sat.cells[c] ?? "") === "") eq(f?.bg, "#D5D5D5", `เสาร์ ${c} ว่าง → เทา`);
    else ok(f === null || f.dup === true, `เสาร์ ${c} มีชื่อ → ไม่เทา`);
  }
  eq(eng.cfOf(day(12), "Y", dc)?.bg, (day(12).cells.Y ?? "") === "" ? "#D8D8D8" : "#D5D5D5", "เสาร์ Y เทา");
  const wkY = mo.rows.find((r: any) => r.date !== null && !["เสาร์", "อาทิตย์"].includes(r.B) && r.AD === 0 && (r.cells.Y ?? "") === "");
  if (wkY) eq(eng.cfOf(wkY, "Z", dc)?.bg, "#D8D8D8", "จ.-ศ. Y ว่าง → Y:Z เทา D8");
  if (process.env.DBG) console.log(mo.rows.map((r: any) => r.day + r.B + ":" + r.cells.Y + "/" + r.cells.C).join(" "));
  const wkYf = mo.rows.find((r: any) => r.date !== null && !["เสาร์", "อาทิตย์"].includes(r.B) && (r.cells.Y ?? "") !== "");
  eq(eng.cfOf(wkYf, "Y", dc), null, "จ.-ศ. Y มีชื่อ → ปกติ");
  // ชื่อซ้ำในคอลัมน์ I ทั้งเดือน → ชมพู · คอลัมน์ C ไม่อยู่ในกฎชมพู
  const iDup = mo.rows.find((r: any) => r.cells.I && dc("I", r.cells.I) > 1 && ["เสาร์", "อาทิตย์"].includes(r.B));
  ok(!!iDup, "มีชื่อซ้ำในคอลัมน์ I (ข้อมูลสุ่ม)");
  if (iDup) eq(eng.cfOf(iDup, "I", dc), { bg: "#F4CCCC", dup: true }, "I ซ้ำ → ชมพู");
  const cDup = mo.rows.find((r: any) => r.cells.C && dc("C", r.cells.C) > 1 && ["เสาร์", "อาทิตย์"].includes(r.B) && r.AD === 0);
  if (cDup) eq(eng.cfOf(cDup, "C", dc), null, "C ซ้ำ → ไม่ชมพู (ไม่อยู่ในช่วงกฎ)");
  const fdays = feb.month;
  const fc = Object.fromEntries(eng.OFF_EDIT_COLS.map((c: string) => [c, eng.colCounts(fdays.rows, c)]));
  const fdc = (c: string, v: string) => fc[c]?.get(v.trim().toLowerCase()) ?? 0;
  eq(eng.cfOf(fdays.rows[29], "A", fdc)?.bg, "#D5D5D5", "เกินวันของเดือน A เทา");
  eq(eng.cfOf(fdays.rows[29], "C", fdc)?.bg, "#D5D5D5", "เกินวันของเดือน C เทา");
  eq(eng.cfOf(fdays.rows[29], "Z", fdc)?.bg, "#D5D5D5", "เกินวันของเดือน Z เทา");

  console.log("3) สรุป = สูตร AF–AM / AO–AR");
  const cnt = (cols: string, n: string) => { let k = 0; for (let d = 1; d <= 31; d++) for (const c of cols) if ((cellOf(dec, c, d) ?? "").toLowerCase() === n.toLowerCase() && n) k++; return k; };
  const sum = eng.offSummary(mo, st.lists);
  for (const r of sum[0].rows) {
    const opd = cnt("CDEFGHIJKLMNOP", r.name), smc = cnt("TUV", r.name);
    eq(r.counts, [opd, smc, opd + smc, cnt("C", r.name), cnt("D", r.name), cnt("H", r.name), cnt("J", r.name)], `สรุป ส-อา ${r.name}`);
  }
  eq(sum[0].rows.map((r: any) => r.name), STAFF, "รายชื่อสรุป = T5:T32");
  for (const r of sum[1].rows) eq(r.counts, [cnt("Y", r.name), cnt("Z", r.name), cnt("Y", r.name) + cnt("Z", r.name)], `สรุป จ.-ศ. ${r.name}`);
  eq(sum[1].rows.map((r: any) => r.name), KEYY, "รายชื่อสรุป จ.-ศ. = W52:W59");
  const byCol = eng.offNamesByCol(st.lists);
  eq(byCol.H, HJ, "dropdown H"); eq(byCol.Q, COLL, "dropdown Q"); eq(byCol.Y, KEYY, "dropdown Y"); eq(byCol.Z, ZL, "dropdown Z"); eq(byCol.P, STAFF, "dropdown P");
  ok(!("X" in byCol) && !("A" in byCol), "ไม่มี dropdown ที่ A/X");

  console.log("4) แก้ชื่อบนเว็บ → แท็บ WEB-ช่องเลือกเอง (ไม่แตะแท็บเดือน)");
  const decBefore = JSON.stringify(dec);
  const satD = 12;
  const orig = cellOf(dec, "C", satD);
  let r = await call(manual, { ym: "2569-12", key: `w:C:${satD}`, value: "ทดสอบแก้" });
  eq(r.status, 200, "บันทึก 1 ช่อง");
  const web = books.OFFSHEET.get("WEB-ช่องเลือกเอง")!;
  ok(web.some((row) => row[0] === `2569-12|C:${satD}` && row[1] === "ทดสอบแก้"), "เขียนแท็บ WEB-ช่องเลือกเอง");
  st = await repo.loadOffMonth(2569, 12);
  eq(st.month.rows[satD - 1].cells.C, "ทดสอบแก้", "โหลดใหม่เห็นค่าที่แก้");
  ok(st.month.rows[satD - 1].manualCols.includes("C"), "ทำเครื่องหมายช่องแก้เอง");
  eq(st.manual[`C:${satD}`], "ทดสอบแก้", "manual map");
  r = await call(manual, { ym: "2569-12", key: `w:Y:2`, value: "" });
  st = await repo.loadOffMonth(2569, 12);
  eq(st.month.rows[1].cells.Y, "", "ล้างให้ว่าง = เก็บค่าว่างทับ");
  r = await call(manual, { ym: "2569-12", entries: [{ key: `w:C:${satD}`, value: null }, { key: "w:Y:2", value: null }, { key: "w:W:14", value: "ยอดชาย" }] });
  eq(r.status, 200, "หลายช่อง (entries)");
  st = await repo.loadOffMonth(2569, 12);
  eq(st.month.rows[satD - 1].cells.C, orig, "คืนค่าสูตร → กลับเป็นค่าจากชีต");
  eq(st.month.rows[1].cells.Y, cellOf(dec, "Y", 2), "คืนค่าสูตร Y");
  eq(st.month.rows[13].cells.W, "ยอดชาย", "W วันที่ 14 (วันจันทร์ ไม่มีในแท็บหลัก → เก็บในแท็บเว็บ)");
  const other = await repo.loadOffMonth(2570, 2);
  ok(Object.keys(other.manual).length === 0, "ค่าที่แก้ไม่ข้ามเดือน");
  eq(JSON.stringify(dec), decBefore, "แท็บเดือน (สูตร) ไม่ถูกแตะ");
  ok(!writes.some((t) => t === "ธ.ค. 69" || t === "ตั้งค่า" || t === "ตารางเวร ส-อา"), "ช่องสูตรไม่เขียนแท็บสูตรใด ๆ");

  console.log("4c) ช่องไม่มีสูตร (Key 4/5, ช่อง 9, เก็บ 1/2, บัตรคิว, เก็บ SMC) → เขียนแท็บ ตารางเวร ส-อา");
  const master = books.OFFSHEET.get("ตารางเวร ส-อา")!;
  const mcell = (c: string, row: number) => master[row - 1]?.[L(c)] ?? "";
  const masterBefore = JSON.stringify(master.map((r) => r.slice(0, 3)));
  // 5 ธ.ค. = แถว 4 · 12 ธ.ค. (เสาร์) = แถว 6 · 13 ธ.ค. (อาทิตย์) = แถว 7 · 19 ธ.ค. = แถว 8
  eq(mcell("C", 6), String(46368), "แถว 6 = 12 ธ.ค.");
  writes.length = 0;
  r = await call(manual, { ym: "2569-12", key: "w:F:12", value: "สมพาน" });
  eq(r.status, 200, "บันทึก Key 4 วันเสาร์");
  eq(mcell("H", 6), "สมพาน", "Key 4 (แท็บเดือน F) → แท็บหลัก H6");
  ok(!(books.OFFSHEET.get("WEB-ช่องเลือกเอง") ?? []).some((x) => x[0] === "2569-12|F:12" && x[1] !== ""), "ไม่เก็บซ้ำในแท็บเว็บ");
  r = await call(manual, { ym: "2569-12", entries: [{ key: "w:G:13", value: "จีรินันท์" }, { key: "w:K:12", value: "อัมพร" }, { key: "w:Q:13", value: "สุพัตตรา" }, { key: "w:R:12", value: "ขวัญจิรา" }, { key: "w:S:13", value: "จำเลียง" }, { key: "w:W:12", value: "ยอดชาย" }, { key: "w:I:12", value: "เดือน" }] });
  eq(r.status, 200, "หลายช่องพร้อมกัน");
  eq([mcell("I", 7), mcell("M", 6), mcell("S", 7), mcell("T", 6), mcell("U", 7), mcell("Y", 6)], ["จีรินันท์", "อัมพร", "สุพัตตรา", "ขวัญจิรา", "จำเลียง", "ยอดชาย"], "G→I K→M Q→S R→T S→U W→Y");
  eq(mcell("K", 6), "", "ช่องสูตร (I = ช่อง 7) ไม่เขียนลงแท็บหลัก");
  st = await repo.loadOffMonth(2569, 12);
  eq(st.manual["I:12"], "เดือน", "ช่องสูตรเก็บในแท็บเว็บ");
  eq(JSON.stringify(master.map((r) => r.slice(0, 3))), masterBefore, "คอลัมน์ A–D ของแท็บหลักไม่ถูกแตะ");
  r = await call(manual, { ym: "2569-12", key: "w:F:12", value: null });
  eq(mcell("H", 6), "", "คืนค่า/ล้าง → ล้างช่องในแท็บหลัก");
  r = await call(manual, { ym: "2569-12", key: "w:F:2", value: "สมพาน" });
  eq(mcell("H", 4), "", "วันพุธ (ไม่มีในแท็บหลัก) ไม่เขียนแท็บหลัก");
  st = await repo.loadOffMonth(2569, 12);
  eq(st.manual["F:2"], "สมพาน", "วันพุธ → เก็บในแท็บเว็บ");
  // ค่าเก่าในแท็บเว็บของช่องไม่มีสูตร ถูกลบเมื่อบันทึกลงแท็บหลัก
  await require("../src/lib/webtabs").writeManual("OFFSHEET", "2569-12", [{ key: "F:19", value: "ค่าเก่า" }]);
  r = await call(manual, { ym: "2569-12", key: "w:F:19", value: "คนทดสอบ" });
  eq(r.status, 200, "บันทึก F:19");
  st = await repo.loadOffMonth(2569, 12);
  ok(!("F:19" in st.manual), "ลบค่าเก่าในแท็บเว็บ");
  eq(mcell("H", 8), "คนทดสอบ", "19 ธ.ค. → แถว 8");
  await call(manual, { ym: "2569-12", entries: ["G:13", "K:12", "Q:13", "R:12", "S:13", "W:12", "I:12", "F:2", "F:19"].map((k) => ({ key: "w:" + k, value: null })) });
  ok(master.every((row, i) => i < 3 || ["H", "I", "M", "S", "T", "U", "Y"].every((c) => (row[L(c)] ?? "") === "")), "ล้างกลับหมด");
  ok(!writes.some((t) => t === "ธ.ค. 69" || t === "ตั้งค่า"), "ไม่เขียนแท็บเดือน/ตั้งค่า");
  // ช่อง 9 วันอาทิตย์เป็นสูตรหมุนเวรในแท็บหลัก → เว็บไม่เขียนทับ (เก็บในแท็บเว็บ) · วันเสาร์ยังเขียนลงแท็บหลัก
  master[6][L("M")] = "=IF(OR($Z7=1,MOD($A7,2)=1),\"\",LET(...))"; // แถว 7 = 13 ธ.ค. (อาทิตย์)
  r = await call(manual, { ym: "2569-12", key: "w:K:13", value: "สมพาน" });
  eq(r.status, 200, "บันทึกช่อง 9 วันอาทิตย์");
  ok(master[6][L("M")].startsWith("=IF("), "สูตรช่อง 9 วันอาทิตย์ไม่ถูกเขียนทับ");
  st = await repo.loadOffMonth(2569, 12);
  eq(st.manual["K:13"], "สมพาน", "ช่อง 9 วันอาทิตย์ → แท็บเว็บ");
  r = await call(manual, { ym: "2569-12", key: "w:K:12", value: "คนทดสอบเก้า" });
  eq(mcell("M", 6), "คนทดสอบเก้า", "ช่อง 9 วันเสาร์ → แท็บหลัก M6");
  await call(manual, { ym: "2569-12", entries: [{ key: "w:K:13", value: null }, { key: "w:K:12", value: null }] });
  eq(mcell("M", 6), "", "ล้างช่อง 9 วันเสาร์");
  for (const bad of ["w:X:5", "w:A:5", "w:B:5", "w:AA:5", "w:C:0", "w:C:32", "m:C:5", "w:c:5"]) {
    r = await call(manual, { ym: "2569-12", key: bad, value: "x" });
    eq(r.status, 400, `ปฏิเสธคีย์ ${bad}`);
  }
  r = await call(manual, { ym: "2569-13", key: "w:C:5", value: "x" });
  eq(r.status, 400, "ปฏิเสธเดือนผิด");
  r = await call(manual, { ym: "2569-12", keys: ["w:C:6", "w:D:6"], value: "x" });
  eq(r.status, 400, "หลายช่องค่าเดียวกันที่ไม่ว่าง → ปฏิเสธ");
  r = await call(manual, { ym: "2569-12", keys: ["w:C:6", "w:D:6"], value: null });
  eq(r.status, 200, "หลายช่อง คืนค่าสูตร");

  console.log("4b) กฎ 1 คน 1 จุดต่อวัน");
  st = await repo.loadOffMonth(2569, 12);
  const sat19 = st.month.rows[18]; // 19 ธ.ค. = เสาร์
  const nameH = sat19.cells.H;
  ok(nameH !== "", "เสาร์ 19 มีชื่อใน H");
  r = await call(manual, { ym: "2569-12", key: "w:U:19", value: nameH });
  eq(r.status, 409, "ใส่ชื่อที่อยู่ H แล้วลง U (SMC) วันเดียวกัน → ปฏิเสธ");
  ok(/อยู่ที่ ช่อง 6\(E\)/.test(r.body.error ?? ""), "ข้อความบอกจุดที่อยู่: " + r.body.error);
  r = await call(manual, { ym: "2569-12", key: "w:H:19", value: nameH });
  eq(r.status, 200, "ใส่ชื่อเดิมในช่องเดิม → ได้");
  r = await call(manual, { ym: "2569-12", key: "w:U:19", value: " " + nameH.toUpperCase() + " " });
  eq(r.status, 409, "ไม่สนช่องว่าง/ตัวพิมพ์");
  const satOther = st.month.rows[25]; // 26 = เสาร์
  if (satOther.cells.H !== nameH && !Object.values(satOther.cells).includes(nameH)) {
    r = await call(manual, { ym: "2569-12", key: "w:U:26", value: nameH });
    eq(r.status, 200, "คนละวัน → ได้");
    await call(manual, { ym: "2569-12", key: "w:U:26", value: null });
  }
  const wk2 = st.month.rows[1]; // 2 ธ.ค. = พุธ
  if (wk2.cells.Z) {
    r = await call(manual, { ym: "2569-12", key: "w:Y:2", value: wk2.cells.Z });
    eq(r.status, 409, "จ.-ศ.: Y ซ้ำกับ Z วันเดียวกัน → ปฏิเสธ");
  }
  r = await call(manual, { ym: "2569-12", key: "w:C:2", value: wk2.cells.Y || "x" });
  eq(r.status, 200, "C วันธรรมดา (กลุ่ม ส.-อา.) ไม่ชนกับ Y (กลุ่ม จ.-ศ.)");
  await call(manual, { ym: "2569-12", key: "w:C:2", value: null });
  r = await call(manual, { ym: "2569-12", key: "w:U:19", value: "" });
  eq(r.status, 200, "ล้างช่องว่าง → ไม่ตรวจ");
  await call(manual, { ym: "2569-12", key: "w:U:19", value: null });
  // ย้อนกลับ/ทำซ้ำ (entries) ไม่ตรวจ → ถ้ามีซ้ำ หน้าเว็บแสดงกรอบแดง + วันที่ซ้ำ
  r = await call(manual, { ym: "2569-12", entries: [{ key: "w:U:19", value: nameH }] });
  eq(r.status, 200, "entries บันทึกได้ (ใช้กับย้อนกลับ)");
  st = await repo.loadOffMonth(2569, 12);
  ok(eng.offDupDays(st.month).includes(19), "offDupDays พบวันที่ 19");
  eq([...eng.offRowDupCols(st.month.rows[18].cells)].sort(), ["H", "U"], "ช่องซ้ำ = H, U");
  const dh = rnd.renderOffHtml(st.month, { editable: true });
  ok(/class="d e dup"[^>]*data-k="w:H:19"/.test(dh) || /class="d e m dup"[^>]*data-k="w:H:19"/.test(dh) || /data-k="w:H:19"/.test(dh) && /class="[^"]*dup[^"]*" data-k="w:U:19"/.test(dh), "กรอบแดงที่ช่องซ้ำ");
  eq(eng.offBusyCol(st.month.rows[18].cells, "C", nameH), "H", "offBusyCol");
  await call(manual, { ym: "2569-12", entries: [{ key: "w:U:19", value: null }] });
  st = await repo.loadOffMonth(2569, 12);
  ok(!eng.offDupDays(st.month).includes(19), "ล้างแล้วไม่ซ้ำ");

  console.log("5) สี/สีพนักงาน");
  r = await call(style, { ym: "2569-12", keys: ["w:C:6", "w:Z:2"], bg: "#FFC7CE" });
  eq(r.status, 200, "ตั้งสีพื้น");
  st = await repo.loadOffMonth(2569, 12);
  eq(st.styles["w:C:6"], { bg: "#FFC7CE" }, "อ่านสีกลับ (คีย์ w:)");
  r = await call(style, { ym: "2569-12", keys: ["w:C:6"], bg: "red" });
  eq(r.status, 400, "สีผิดรูปแบบ");
  r = await call(pcol, { colors: { "กฤษฎา": "#1F4E9E" } });
  eq(r.status, 200, "สีพนักงาน");
  st = await repo.loadOffMonth(2569, 12);
  eq(st.personColors["กฤษฎา"], "#1F4E9E", "อ่านสีพนักงานกลับ");

  console.log("6) การลา: เฉพาะ งดเวรนอกเวลา (Approve)");
  // คนที่อยู่ในตารางวันเสาร์ที่ 12
  const who = st.month.rows[11].cells.H; // H มีชื่อทุกวันเสาร์-อาทิตย์ที่ไม่งดบริการ
  const who2 = st.month.rows[12].cells.J;
  const lv = books.LEAVESHEET.get("Leave")!;
  lv.push(["", `${who} นามสกุล`, "", "งดเวรนอกเวลา", "2026-12-12", "2026-12-12", "", "Approved", "L1"]);
  lv.push(["", `${who2} นามสกุล`, "", "ลาป่วย", "2026-12-13", "2026-12-13", "", "Approved", "L2"]);
  lv.push(["", `${who2} นามสกุล`, "", "งดเวรนอกเวลา", "2026-12-13", "2026-12-13", "", "Pending", "L3"]);
  lv.push(["", `สมพาน นามสกุล`, "", "งด เวรนอกเวลา", "2027-01-02", "2027-01-03", "", "approve", "L4"]);
  ls.invalidateApprovedLeaves();
  const off = await ls.readOffLeaves();
  eq(off.map((x: any) => x.leaveId).sort(), ["L1", "L4"], "readOffLeaves = งดเวรนอกเวลา + Approve เท่านั้น");
  const reg = await ls.readApprovedLeaves();
  eq(reg.map((x: any) => x.leaveId), ["L2"], "4 ตารางเดิมยังดึงเฉพาะ ลาป่วย/กิจ/พักร้อน/อื่น (ไม่ดึง งดเวรนอกเวลา)");
  const { leaves } = await repo.loadOffLeaves();
  const hits = eng.offLeaveHits(st.month, leaves);
  ok(hits.some((h: any) => h.day === 12 && h.name === who), "พบชื่อที่งดเวรวันที่ 12");
  ok(!hits.some((h: any) => h.day === 13 && h.name === who2 && h.col === "J" && !leaves.some((l: any) => l.firstName === who2)), "ลาป่วย/ยังไม่อนุมัติ ไม่เตือน");
  ok(hits.every((h: any) => h.day === 12), "เตือนเฉพาะวันที่ 12 (เดือนนี้)");

  console.log("7) วาดตาราง");
  const html = rnd.renderOffHtml(st.month, { editable: true, styles: st.styles, personColors: st.personColors, leaves, today: null });
  const keys = [...html.matchAll(/data-k="([^"]+)"/g)].map((m: any) => m[1]);
  eq(keys.length, 31 * 23, "ช่องแก้ได้ = 31 วัน × 23 คอลัมน์ (C–W, Y, Z)");
  ok(keys.every((k: string) => repo.isOffKey(k)), "ทุกคีย์ผ่าน isOffKey");
  const fhtml = rnd.renderOffHtml(feb.month, { editable: true });
  eq([...fhtml.matchAll(/data-k="w:C:(\d+)"/g)].length, 28, "ก.พ. แก้ได้ 28 วัน");
  ok(html.includes("text-decoration:line-through") && html.includes(">" + who + "<"), "ชื่อที่งดเวร → ขีดฆ่า");
  ok(html.includes("background:#FFC7CE"), "สีรายช่องแสดง");
  eq((html.match(/<tr/g) ?? []).length, 2 + 4 + 31 + 3, "จำนวนแถว (หัว 6 + ข้อมูล 31 + ท้าย 3)");
  // ทุกแถวต้องมี 26 คอลัมน์ (นับ colspan/rowspan)
  const rows = html.split("<tr").slice(1).map((t: string) => t.split("</tr>")[0]);
  const occ: number[] = Array(rows.length).fill(0);
  rows.forEach((t: string, i: number) => {
    for (const m of t.matchAll(/<td([^>]*)>/g)) {
      const cs = Number(/colspan="(\d+)"/.exec(m[1])?.[1] ?? 1), rs = Number(/rowspan="(\d+)"/.exec(m[1])?.[1] ?? 1);
      for (let k = 0; k < rs; k++) occ[i + k] += cs;
    }
  });
  ok(occ.every((n) => n === 26), "ทุกแถวกว้าง 26 คอลัมน์: " + occ.join(","));
  eq(rnd.OFF_COL_W.length, 26, "ความกว้าง 26 คอลัมน์");

  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
