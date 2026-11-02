// ทดสอบการทำงานของเว็บแบบครบวงจร โดยจำลอง Google Sheets API ในหน่วยความจำ (โหลดสมุดงานจาก fixtures)
process.env.SHEET_TITLES_TTL_MS = "0"; // ชีตจำลองเปลี่ยนแท็บระหว่างทดสอบ → ไม่จำรายชื่อแท็บ
// ไล่ใช้งานเหมือนผู้จัดตาราง: ตั้งค่า → ลา/แลกเวร → เลือกชื่อ → ชื่อซ้ำถูกกัน → สี → ล้าง/คืนค่า
// รัน: tsx scripts/test-web-flow.ts fixtures/shift3-sheet.json

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const require: any;
declare const process: any;
declare const __dirname: string;
const fs = require("fs");
const path = require("path");
const Module = require("module");

// แทนที่โมดูลที่ต้องใช้เน็ต/Next ด้วย stub
const orig = Module._resolveFilename;
Module._resolveFilename = function (req: string, ...rest: any[]) {
  if (req === "server-only" || req === "next/headers" || req === "google-auth-library")
    return path.join(__dirname, "stubs", req.replace("/", "_") + ".js");
  return orig.call(this, req, ...rest);
};
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "test@example.iam";
process.env.GOOGLE_PRIVATE_KEY = "test";
process.env.SHEET_ID_SHIFT3 = "TESTSHEET";

const book: Record<string, string[][]> = JSON.parse(fs.readFileSync(process.argv[2] ?? "fixtures/shift3-sheet.json", "utf8"));
// เหมือน verify-shift3: ไฟล์ export ตัดแถวว่างท้ายชีต ตั้งค่า — วางผู้จัดทำกลับแถว 88-90
{
  const g = book["ตั้งค่า"];
  const i = g.findIndex((r) => r[0] === "ชื่อผู้จัดทำ");
  if (i >= 0 && i !== 88) {
    const tail = g.splice(i - 1, 3);
    while (g.length < 87) g.push([]);
    g.push(...tail);
  }
}

// ---------- Google Sheets จำลอง ----------
const wb = new Map<string, string[][]>(Object.entries(book).map(([k, v]) => [k, v.map((r) => [...r])]));
let apiCalls = 0;
const writes: { range: string; values: unknown[][] }[] = [];
const colNum = (L: string) => [...L].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
function parseRange(r: string) {
  const m = /^'?([^'!]+)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(r);
  if (!m) throw new Error("range? " + r);
  const c1 = colNum(m[2]), r1 = +m[3];
  return { tab: m[1], c1, r1, c2: m[4] ? colNum(m[4]) : c1, r2: m[5] ? +m[5] : r1 };
}
function readRange(r: string): string[][] {
  const { tab, c1, r1, c2, r2 } = parseRange(r);
  const g = wb.get(tab);
  if (!g) throw new Error("ไม่มีแท็บ " + tab);
  const out: string[][] = [];
  for (let y = r1; y <= r2; y++) {
    const row: string[] = [];
    for (let x = c1; x <= c2; x++) row.push(g[y - 1]?.[x - 1] ?? "");
    while (row.length && row[row.length - 1] === "") row.pop();
    out.push(row);
  }
  while (out.length && out[out.length - 1].length === 0) out.pop();
  return out;
}
function writeRange(r: string, values: unknown[][]) {
  const { tab, c1, r1 } = parseRange(r);
  const g = wb.get(tab);
  if (!g) throw new Error("ไม่มีแท็บ " + tab);
  values.forEach((row, dy) =>
    row.forEach((v, dx) => {
      const y = r1 - 1 + dy, x = c1 - 1 + dx;
      while (g.length <= y) g.push([]);
      while (g[y].length <= x) g[y].push("");
      g[y][x] = v === null || v === undefined ? "" : String(v);
    }),
  );
  writes.push({ range: r, values });
}
(globalThis as any).fetch = async (url: string, init?: any) => {
  apiCalls++;
  const u = new URL(url);
  const json = (o: unknown) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
  if (u.pathname.endsWith("/values:batchGet")) {
    return json({ valueRanges: u.searchParams.getAll("ranges").map((r) => ({ values: readRange(r) })) });
  }
  if (u.pathname.endsWith("/values:batchUpdate")) {
    for (const d of JSON.parse(init.body).data) writeRange(d.range, d.values);
    return json({});
  }
  if (u.pathname.endsWith("TESTSHEET:batchUpdate")) {
    for (const rq of JSON.parse(init.body).requests) if (rq.addSheet) wb.set(rq.addSheet.properties.title, []);
    return json({});
  }
  if (u.pathname.endsWith("TESTSHEET")) return json({ sheets: [...wb.keys()].map((title) => ({ properties: { title } })) });
  throw new Error("fetch? " + url);
};

// ---------- ทดสอบ ----------
let pass = 0, fail = 0;
const ok = (c: boolean, msg: string) => {
  if (c) pass++;
  else {
    fail++;
    console.log("  ✗ " + msg);
  }
};
const eqv = (a: unknown, b: unknown, msg: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ได้ ${JSON.stringify(a)} ควรเป็น ${JSON.stringify(b)}`);

async function main() {
  const repo = require("../src/lib/shift3/repo");
  const isoD = (n: number | null) => (n === null ? "" : require("../src/lib/sheets-date").isoFromSerial(n));
  const { computeMonth, colIndex } = require("../src/lib/shift3/engine");
  const { renderMonthHtml } = require("../src/lib/shift3/render");
  const { cellPerson, duplicateCols } = require("../src/lib/shift3/conflicts");

  console.log("1) โหลดข้อมูล/ตั้งค่า");
  const data = await repo.loadShift3();
  eqv(data.settings.persons.length, 14, "จำนวนรายชื่อ");
  ok(data.settings.persons[0].name !== "", "ชื่อคนที่ 1 อ่านได้");
  const names: string[] = data.settings.persons.map((p: any) => p.name);

  console.log("2) เดือนที่มีแท็บ (ม.ค.70) — ไม่มีช่องเลือกเองค้างจากสูตร");
  let st = await repo.loadMonthState(data, 2570, 1);
  eqv(st.source, "month-tab", "แหล่งช่องเลือกเอง");
  eqv(Object.keys(st.manual).length, 0, "ไม่มีช่องที่ต่างจากสูตร");

  console.log("3) กฎกันชื่อซ้ำในแถว");
  eqv(cellPerson("⚠ กนกดาว ลา"), null, "⚠ ไม่นับเป็นคน");
  eqv(cellPerson("→ ไปช่วยจุดอื่น"), null, "→ ไม่นับ");
  eqv(cellPerson("ฟ้า (แทน กนกดาว)"), "ฟ้า", "ผู้มาแทนนับเป็นคน");
  eqv(cellPerson("จนท."), null, "จนท. ไม่นับ");
  eqv([...duplicateCols(["1", "ก", "ข", "ก"])], [1, 3], "ตรวจพบซ้ำ");
  // ทุกเดือนใน fixture: ผลจากสูตรต้องไม่มีชื่อซ้ำในแถว
  let dupRows = 0;
  for (let ym = 0; ym < 12; ym++) {
    const yb = 2569 + Math.floor((11 + ym) / 12) + (ym === 0 ? 0 : 0);
    const month = ((11 + ym) % 12) + 1;
    const y = month === 12 && ym === 0 ? 2569 : 2570;
    const res = computeMonth(data.settings, data.leaves, {}, y, month);
    for (const s of res.sections) for (const r of s.rows) if (r.date !== null && duplicateCols(r.cells).size > 0) dupRows++;
    void yb;
  }
  eqv(dupRows, 0, "ผลจากสูตรทั้ง 12 เดือนไม่มีชื่อซ้ำในแถว");

  console.log("4) ผู้จัดเลือกชื่อ (ช่อง จนท.) — เขียนลงแท็บเดือน");
  const before = writes.length;
  await repo.saveManualMany(2570, 1, [{ key: "1:D:12", value: names[0] }]);
  const w = writes.slice(before);
  eqv(w.length, 1, "เขียน 1 ครั้ง");
  eqv(w[0].range, "'ม.ค.70'!D19", "ตำแหน่งเซลล์ในแท็บเดือน (แถว 8+วัน-1)");
  await repo.saveManualMany(2570, 1, [{ key: "1:D:12", value: null }]);
  ok(String(writes[writes.length - 1].values[0][0]).startsWith('=IF($AM19=1,"จนท."'), "คืนค่า = ใส่สูตรเดิมกลับ");
  wb.get("ม.ค.70")![18][3] = "จนท."; // จำลองชีตคำนวณสูตรกลับเป็นค่า

  console.log("5) ชื่อซ้ำในแถวเดียวกัน ต้องถูกกัน (เดือนที่ไม่มีแท็บ ธ.ค.70)");
  const res0 = computeMonth(data.settings, data.leaves, {}, 2570, 12);
  const row = res0.sections[0].rows.find((r: any) => r.workday === 1 && r.week !== null)!;
  const planCols = row.cells.map((v: string, c: number) => ({ v, c })).filter((x: any) => x.c > 0 && cellPerson(x.v));
  const takenName = planCols[0].v as string;
  const targetCol = planCols[1].c as number;
  const colL = require("../src/lib/shift3/engine").colLetter(targetCol);
  const msg = await repo.validateManual(2570, 12, `1:${colL}:${row.day}`, takenName);
  ok(typeof msg === "string" && msg.includes(takenName), "พิมพ์ชื่อที่มีในแถวแล้ว → ถูกกัน");
  eqv(await repo.validateManual(2570, 12, `1:${colL}:${row.day}`, "คนนอกรายชื่อ"), null, "ชื่อไม่ซ้ำ → ผ่าน");
  eqv(await repo.validateManual(2570, 12, `1:${colL}:${row.day}`, ""), null, "ล้างช่อง → ผ่าน");
  // ชื่อเดิมของช่องนั้นเอง ใส่ซ้ำช่องเดิม ไม่ถือว่าซ้ำ
  eqv(await repo.validateManual(2570, 12, `1:${colL}:${row.day}`, planCols[1].v), null, "ใส่ชื่อเดิมของช่องตัวเอง → ผ่าน");

  console.log("6) พิมพ์ทับช่องสูตร (เก็บในแท็บ WEB-ช่องเลือกเอง ไม่แตะแท็บเดือน)");
  const key = `1:${colL}:${row.day}`;
  await repo.saveManualMany(2570, 12, [{ key, value: "คนนอกรายชื่อ" }]);
  ok(wb.has("WEB-ช่องเลือกเอง"), "สร้างแท็บเก็บค่า");
  st = await repo.loadMonthState(data, 2570, 12);
  eqv(st.manual[key], "คนนอกรายชื่อ", "อ่านกลับได้");
  let res = computeMonth(data.settings, data.leaves, st.manual, 2570, 12);
  eqv(res.sections[0].rows[row.day - 1].cells[targetCol], "คนนอกรายชื่อ", "ตารางแสดงค่าที่พิมพ์ทับ");
  eqv(res.sections[0].rows[row.day - 1].cells[planCols[0].c], planCols[0].v, "ช่องอื่นในแถวไม่เปลี่ยน");
  // แท็บเดือนเดิมของ ม.ค.70 ต้องไม่ถูกเขียนเพิ่ม
  await repo.saveManualMany(2570, 1, [{ key: "1:G:12", value: "ทดสอบ" }]);
  ok(writes[writes.length - 1].range.startsWith("'WEB-ช่องเลือกเอง'"), "ช่องสูตรของเดือนที่มีแท็บ ก็ไปแท็บ WEB ไม่ทับสูตร");
  await repo.saveManualMany(2570, 1, [{ key: "1:G:12", value: null }]);
  st = await repo.loadMonthState(data, 2570, 1);
  eqv(st.manual["1:G:12"], undefined, "คืนค่าสูตรแล้วหายไป");

  console.log("7) ล้าง/คืนค่าหลายช่องพร้อมกัน (เรียก API น้อยครั้ง)");
  const keys = [3, 4, 5, 6, 7].map((c) => `2:${require("../src/lib/shift3/engine").colLetter(c)}:15`);
  const c0 = apiCalls;
  await repo.saveManualMany(2570, 12, keys.map((k) => ({ key: k, value: "" })));
  ok(apiCalls - c0 <= 4, `ล้าง 5 ช่อง ใช้ API ${apiCalls - c0} ครั้ง`);
  st = await repo.loadMonthState(data, 2570, 12);
  eqv(keys.every((k) => st.manual[k] === ""), true, "ช่องที่ล้างเป็นค่าว่าง");
  await repo.saveManualMany(2570, 12, keys.map((k) => ({ key: k, value: null })));
  st = await repo.loadMonthState(data, 2570, 12);
  eqv(keys.some((k) => k in st.manual), false, "คืนค่าสูตรทั้ง 5 ช่อง");

  console.log("8) สีพื้น/สีตัวอักษร รายช่อง และสีตามชื่อ");
  const sk = [`1:${colL}:${row.day}`, `1:${require("../src/lib/shift3/engine").colLetter(planCols[0].c)}:${row.day}`];
  await repo.saveStyles(2570, 12, sk, { bg: "#7F7F7F" });
  await repo.saveStyles(2570, 12, [sk[0]], { fg: "#C00000" });
  st = await repo.loadMonthState(data, 2570, 12);
  eqv(st.styles[sk[0]], { bg: "#7F7F7F", fg: "#C00000" }, "สีพื้น+สีตัวอักษร ช่องที่ 1");
  eqv(st.styles[sk[1]], { bg: "#7F7F7F" }, "สีพื้น ช่องที่ 2");
  await repo.savePersonColors({ [names[0]]: "#1F4E9E" });
  st = await repo.loadMonthState(data, 2570, 12);
  eqv(st.personColors[names[0]], "#1F4E9E", "สีตามชื่อ");
  res = computeMonth(data.settings, data.leaves, st.manual, 2570, 12);
  const html = renderMonthHtml(res, { editable: true, styles: st.styles, personColors: st.personColors })[0] as string;
  ok(html.includes("background:#7F7F7F"), "HTML มีสีเทาทึบ");
  ok(html.includes("color:#C00000"), "HTML มีสีตัวอักษรรายช่อง");
  ok(html.includes("color:#1F4E9E"), "HTML มีสีตามชื่อพนักงาน");
  ok(html.includes('class="dr"'), "แถวข้อมูลมี class dr (ใช้ปรับความสูงตอนพิมพ์)");
  await repo.saveStyles(2570, 12, sk, { clear: true });
  st = await repo.loadMonthState(data, 2570, 12);
  eqv(Object.keys(st.styles).length, 0, "ล้างสีแล้วไม่เหลือ");
  await repo.saveStyles(2570, 12, [sk[0]], { bg: "#FFFFFF" });
  await repo.saveStyles(2570, 12, [sk[0]], { bg: null });
  st = await repo.loadMonthState(data, 2570, 12);
  eqv(Object.keys(st.styles).length, 0, "ล้างเฉพาะสีพื้นที่เหลือแค่สีพื้น → ช่องหายไป");

  console.log("9) ไฮไลต์ชื่อซ้ำ (สร้างซ้ำโดยตรง ไม่ผ่านการกัน)");
  const dupHtml = renderMonthHtml(
    computeMonth(data.settings, data.leaves, { [key]: takenName }, 2570, 12),
    { editable: true },
  )[0] as string;
  ok(dupHtml.includes("td"), "render ได้");
  ok((dupHtml.match(/ dup"/g) ?? []).length >= 2, "ช่องที่ซ้ำถูกใส่ class dup อย่างน้อย 2 ช่อง");

  console.log("10) ตั้งค่า: บันทึกแล้วอ่านกลับต้องเท่าเดิม");
  const form = repo.toForm(data);
  form.signerName = "ผู้ทดสอบ";
  form.holidays = [...form.holidays, { date: "2027-12-31", name: "ทดสอบ" }];
  await repo.saveSettings(form);
  const d2 = await repo.loadShift3();
  eqv(d2.settings.signerName, "ผู้ทดสอบ", "ชื่อผู้ลงนาม");
  eqv(d2.settings.holidays.length, data.settings.holidays.length + 1, "วันหยุดเพิ่ม 1");
  eqv(d2.settings.persons.map((p: any) => p.name), data.settings.persons.map((p: any) => p.name), "รายชื่อไม่เปลี่ยน");
  eqv(d2.settings.startMonday, data.settings.startMonday, "วันเริ่มตาราง");
  ok(!writes.some((x) => /^'ตั้งค่า'!C26/.test(x.range) || /^'ตั้งค่า'!B7/.test(x.range) || /^'ตั้งค่า'!B9/.test(x.range)), "ไม่เขียนทับช่องสูตร B7/B9/C26");

  console.log("11) ลา-แลกเวร: บันทึกแล้วตารางต้องเปลี่ยนตาม และไม่ทับสูตร E/F");
  const target = res0.sections[0].rows.find((r: any) => r.workday === 1 && r.week !== null)!;
  const leaver = row.cells[planCols[0].c];
  const dateIso = (() => { const { isoFromSerial } = require("../src/lib/sheets-date"); return isoFromSerial(target.date); })();
  await repo.saveLeaves([{ date: dateIso, name: leaver, replacement: "", type: "ลาป่วย", note: "ทดสอบ" }]);
  ok(!writes.some((x) => /^'ลา-แลกเวร'!E/.test(x.range) || /^'ลา-แลกเวร'!F/.test(x.range)), "ไม่เขียนทับ E/F");
  const d3 = await repo.loadShift3();
  eqv(d3.leaves.length, 1, "อ่านรายการลากลับ 1 แถว");
  const afterLeave = computeMonth(d3.settings, d3.leaves, {}, 2570, 12);
  const lr = afterLeave.sections[0].rows[target.day - 1];
  ok(lr.cells.some((v: string) => v.startsWith("⚠") && v.includes(leaver)) || lr.cells.some((v: string) => v.includes("(แทน")), "ตารางแสดง ⚠ ลา");

  console.log("12) ใส่ชื่อเดียวกันลงตาราง 3 ช่วงเวลา (ตรวจชื่อซ้ำทั้งหมดในครั้งเดียว)");
  {
    const day = row.day;
    const ks = [1, 2, 3].map((sec) => `${sec}:I:${day}`);
    eqv(await repo.validateManualEntries(2570, 12, ks.map((key) => ({ key, value: "MT ทดสอบ" }))), [], "ชื่อใหม่ไม่ซ้ำทั้ง 3 ตาราง → ผ่าน");
    const fresh = computeMonth((await repo.loadShift3()).settings, [], (await repo.loadMonthState(data, 2570, 12)).manual, 2570, 12);
    const busy = cellPerson(fresh.sections[1].rows[day - 1].cells[colIndex("V")] ?? "") ?? cellPerson(fresh.sections[1].rows[day - 1].cells[colIndex("G")] ?? "");
    if (busy) {
      const bad = await repo.validateManualEntries(2570, 12, ks.map((key) => ({ key, value: busy })));
      ok(bad.some((b: any) => b.key === `2:I:${day}`), `"${busy}" อยู่จุดอื่นในตาราง 8.30-12.30 → ถูกกันช่อง 2:I`);
    }
    await repo.saveManualMany(2570, 12, ks.map((key) => ({ key, value: "MT ทดสอบ" })));
    let st2 = await repo.loadMonthState(data, 2570, 12);
    eqv(ks.map((k) => st2.manual[k]), ["MT ทดสอบ", "MT ทดสอบ", "MT ทดสอบ"], "บันทึกครบ 3 ตาราง");
    await repo.saveManualMany(2570, 12, ks.map((key) => ({ key, value: null })));
    st2 = await repo.loadMonthState(data, 2570, 12);
    eqv(ks.some((k) => k in st2.manual), false, "ย้อนกลับ (คืนค่าสูตร) ครบ 3 ตาราง");
  }

  console.log("13) ดึงการลาจากระบบลา (Approve · ลาป่วย/ลากิจ/ลาพักร้อน/ลาอื่นๆ · 1 แถวต่อวันทำการ)");
  {
    const H = ["Timestamp", "ชื่อ - นามสกุล", "ตำแหน่ง", "ประเภทการลา", "เริ่มต้น", "สิ้นสุด", "จำนวน", "สถานะ", "LeaveID"];
    const name0 = names[1]; // คนในตาราง
    wb.set("Leave", [
      H,
      ["", `${name0} ทองนวล`, "", "ลาพักร้อน", "11/11/2026", "13/11/2026", "3", "Approve", "L1"],
      ["", `${name0} ทองนวล`, "", "งดเวรนอกเวลา", "14/11/2026", "14/11/2026", "1", "Approve", "L2"],
      ["", `${names[2]} มีผิว`, "", "ลากิจ", "04/12/2026", "08/12/2026", "2", "Approve", "L3"],
      ["", `${names[3]} คำโคตร`, "", "ลาป่วย", "24/11/2026", "24/11/2026", "1", "Pending", "L4"],
      ["", "อัมพร นามสี", "", "ลาป่วย", "24/11/2026", "24/11/2026", "1", "Approve", "L5"],
      ["", `${names[4]} สิงห์ทอง`, "", "ลาป่วย", "05/01/2025", "05/01/2025", "1", "Approve", "L6"],
      ["", `${names[5]} ลาภโต`, "", "ลาอื่นๆ", "26/11/2026", "26/11/2026", "1", "Reject", "L7"],
    ]);
    wb.set("ลา-แลกเวร", [[], [], [], ["วันที่"]]);
    const r1a = await repo.syncLeaveSystem({ force: true, ym: "2569-11" });
    eqv([r1a.added, r1a.removed, r1a.error, r1a.ym], [3, 0, undefined, "2569-11"], "ดึงเฉพาะ พ.ย.69: 3 แถว (ไม่ดึงเดือนอื่น ไม่ดึงงดเวรนอกเวลา/Pending/Reject)");
    eqv((await repo.loadShift3()).leaves.length, 3, "หลังดึง พ.ย. ในชีตมีแค่ 3 แถว (ไม่มี ธ.ค.)");
    const r1 = await repo.syncLeaveSystem({ force: true, ym: "2569-12" });
    eqv([r1.added, r1.removed, r1.error], [2, 0, undefined], "ดึงเฉพาะ ธ.ค.69: 2 แถว (ข้ามเสาร์-อาทิตย์และวันหยุด 7 ธ.ค.)");
    ok(r1.skippedNames.includes("อัมพร นามสี"), "คนที่ไม่ใช่พนักงานตารางนี้ไม่ถูกดึง");
    let d = await repo.loadShift3();
    eqv(d.leaves.map((l: any) => `${isoD(l.date)}|${l.name}|${l.type}|${l.replacement}|${l.ref}`), [
      `2026-11-11|${name0}|ลาพักร้อน||L1|2026-11-11`, `2026-11-12|${name0}|ลาพักร้อน||L1|2026-11-12`, `2026-11-13|${name0}|ลาพักร้อน||L1|2026-11-13`,
      `2026-12-04|${names[2]}|ลากิจ||L3|2026-12-04`, `2026-12-08|${names[2]}|ลากิจ||L3|2026-12-08`,
    ], "แถวที่ดึงมา (คนแทน/หมายเหตุ ว่าง)");
    // ผู้จัดใส่คนแทน แล้วดึงซ้ำ → ไม่ซ้ำ ไม่ลบ คนแทนยังอยู่
    const form = d.leaves.map((l: any) => ({ date: isoD(l.date), name: l.name, replacement: l.ref.endsWith("11-12") ? names[9] : "", type: l.type, note: "", ref: l.ref }));
    await repo.saveLeaves(form);
    const r2 = await repo.syncLeaveSystem({ force: true, ym: "2569-11" });
    eqv([r2.added, r2.removed], [0, 0], "ดึงซ้ำ ไม่เพิ่ม/ไม่ลบ");
    d = await repo.loadShift3();
    eqv(d.leaves.find((l: any) => l.ref.endsWith("11-12"))?.replacement, names[9], "คนแทนที่ผู้จัดใส่ยังอยู่");
    // ยกเลิกการลาในระบบลา → แถวถูกนำออก
    wb.get("Leave")![1][7] = "Cancelled";
    const r3a = await repo.syncLeaveSystem({ force: true, ym: "2569-12" });
    eqv([r3a.added, r3a.removed], [0, 0], "ซิงก์เดือน ธ.ค. ไม่แตะแถวของ พ.ย.");
    const r3 = await repo.syncLeaveSystem({ force: true, ym: "2569-11" });
    eqv([r3.added, r3.removed], [0, 3], "ยกเลิกในระบบลา → นำออก 3 แถว (ในเดือนนั้น)");
    d = await repo.loadShift3();
    eqv(d.leaves.length, 2, "เหลือ 2 แถว");
    const m = computeMonth(d.settings, d.leaves, {}, 2569, 12);
    ok(m.sections[0].rows[3].cells.some((c: string) => c.includes(names[2]) && c.includes("ลา")), "ตารางวันที่ 4 ธ.ค. ขึ้น ⚠ ลา");
  }
  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail} · เรียก API จำลอง ${apiCalls} ครั้ง`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
