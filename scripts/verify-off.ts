// เทียบผลของเว็บกับค่าที่สูตรในชีตคำนวณจริง (ทุกแท็บเดือน): สรุป AF–AM / AO–AR, จำนวนวัน, งดบริการ, รายชื่อ dropdown
// รัน: tsx scripts/verify-off.ts <real.json> (ค่า FORMATTED ของแท็บเดือน A1:AR40 + ตั้งค่า!T5:X59)
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const require: any;
declare const process: any;
const fs = require("fs");
const eng = require("../src/lib/off/engine");
const { parseOffLists } = eng;
const real = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const lists = parseOffLists(real["ตั้งค่า"]);
const MON: Record<string, number> = { "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6, "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12 };
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => (c ? pass++ : (fail++, console.log("✗", m)));
const col = (c: string) => eng.colIndex(c);
for (const [tab, g] of Object.entries<any>(real)) {
  if (tab === "ตั้งค่า") continue;
  const [ms, yy] = tab.split(" ");
  const m = MON[ms], y = 2500 + Number(yy);
  const mo = eng.buildOffMonth(g, {}, y, m);
  const nd = new Date(Date.UTC(y - 543, m, 0)).getUTCDate();
  ok(mo.rows.filter((r: any) => r.date !== null).length === nd, `${tab} จำนวนวัน ${nd}`);
  // วันที่/วัน ตรงกับปฏิทินจริง
  const WD = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  ok(mo.rows.every((r: any) => r.date === null || (WD[eng.weekday1(r.date) - 1] === r.B && Number(g[5 + r.day][col("AB")]) === r.date)), `${tab} วัน/serial ตรง AB`);
  const sum = eng.offSummary(mo, lists);
  // AF7:AM(แถวก่อน "รวมทั้งเดือน") — 28 แถวเดิม (ถึงแถว 34) หรือ 40 แถวหลังขยาย (ถึงแถว 46)
  const totRow = g.findIndex((r: any, i: number) => i >= 6 && (r?.[col("AF")] ?? "").trim() === "รวมทั้งเดือน");
  ok(totRow > 6, `${tab} พบแถวรวมทั้งเดือน`);
  const nRows = totRow - 6;
  for (let i = 0; i < nRows; i++) {
    const row = g[6 + i] ?? [];
    const name = (row[col("AF")] ?? "").trim();
    if (!name) continue;
    const w = sum[0].rows.find((r: any) => r.name === name);
    const sheet = ["AG", "AH", "AI", "AJ", "AK", "AL", "AM"].map((c) => Number(row[col(c)] ?? 0));
    ok(!!w && JSON.stringify(w.counts) === JSON.stringify(sheet), `${tab} ${name} ส-อา เว็บ ${JSON.stringify(w?.counts)} ชีต ${JSON.stringify(sheet)}`);
  }
  ok(sum[0].rows.length === g.slice(6, totRow).filter((r: any) => (r?.[col("AF")] ?? "").trim()).length, `${tab} จำนวนชื่อสรุป ส-อา`);
  const tot = ["AG", "AH", "AI", "AJ", "AK", "AL", "AM"].map((c) => Number(g[totRow]?.[col(c)] ?? 0));
  const wtot = sum[0].cols.map((_: any, i: number) => sum[0].rows.reduce((n: number, r: any) => n + r.counts[i], 0));
  ok(JSON.stringify(tot) === JSON.stringify(wtot), `${tab} รวม ส-อา เว็บ ${wtot} ชีต ${tot}`);
  for (let i = 0; i < 8; i++) {
    const row = g[6 + i] ?? [];
    const name = (row[col("AO")] ?? "").trim();
    if (!name || name === "รวมทั้งเดือน") continue;
    const w = sum[1].rows.find((r: any) => r.name === name);
    const sheet = ["AP", "AQ", "AR"].map((c) => Number(row[col(c)] ?? 0));
    ok(!!w && JSON.stringify(w.counts) === JSON.stringify(sheet), `${tab} ${name} จ-ศ เว็บ ${JSON.stringify(w?.counts)} ชีต ${JSON.stringify(sheet)}`);
  }
  const dd = eng.offDupDays(mo);
  if (dd.length) console.log(`  ⓘ ${tab} คนเดียวอยู่ 2 จุดในวันเดียวกัน (ข้อมูลในชีตตอนนี้): ` + dd.map((d: number) => `${d}[${[...eng.offRowDupCols(mo.rows[d - 1].cells)].map((c: string) => c + "=" + mo.rows[d - 1].cells[c]).join(",")}]`).join(" "));
  // ทุกชื่อในตารางอยู่ใน dropdown ของคอลัมน์ (แจ้งเท่านั้น)
  const byCol = eng.offNamesByCol(lists);
  const odd: string[] = [];
  for (const r of mo.rows) for (const c of eng.OFF_EDIT_COLS) { const v = (r.cells[c] ?? "").trim(); if (v && !(byCol[c] ?? []).includes(v)) odd.push(`${r.day}${c}:${v}`); }
  if (odd.length) console.log(`  ⓘ ${tab} ชื่อที่ไม่อยู่ใน dropdown ของคอลัมน์: ${odd.join(" ")}`);
}
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
