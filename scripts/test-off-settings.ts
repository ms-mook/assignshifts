// ทดสอบหน้า ตั้งค่า ตารางเวรนอกเวลา ด้วยแท็บ ตั้งค่า จำลอง (มีทั้งช่องค่าและช่องสูตร)
// รัน: tsx scripts/test-off-settings.ts
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

const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
// ค่า (ที่สูตรคำนวณแล้ว) และสูตร แยกกัน
const vals = new Map<string, string>();
const forms = new Map<string, string>();
const setV = (a: string, v: string | number) => vals.set(a, String(v));
const setF = (a: string, f: string, v: string | number) => (forms.set(a, f), vals.set(a, String(v)));
const STAFF = ["เพชรชรินทร์", "ณัฐณิชา", "บัวปรีญา", "กนกดาว", "อาภาศิริ", "อรพรรณ", "นันธิชา", "วรินยุพา", "สาวิลักษณ์", "ภูมิโชค", "วิภาวดี", "จิตติมา", "ณีรนุช", "พนักงานใหม่"];
setF("B2", "=COUNTA($B$5:$B$30)", 14);
STAFF.forEach((n, i) => setV(`B${5 + i}`, n));
setV("B53", "ตารางเวรทดสอบ FM-XX"); setV("B54", "ประจำเดือน"); setV("B55", "นางสาว ทดสอบ ผู้จัดทำ"); setV("B56", "หัวหน้าหน่วยทดสอบ");
setF("E15", "=DATE(2026,12,1)", 46357);
setF("E16", "=DATE(2027,11,30)", 46721);
const spots: [number, string, string, string, number | "", number | ""][] = [
  [5, "ช่อง 7", "OPD", "เริ่ม 06.00 น.", 1, ""], [6, "ช่อง 9", "OPD", "เริ่ม 06.00 น.", 3, ""], [7, "ช่อง 10", "OPD", "เริ่ม 06.00 น.", "", 2],
  [8, "ช่อง 11", "OPD", "เริ่ม 06.00 น.", 7, ""], [9, "ช่อง 12", "OPD", "เริ่ม 06.00 น.", 6, ""], [10, "ช่อง 13", "OPD", "เริ่ม 06.00 น.", 13, ""],
  [11, "ช่อง 14,16", "OPD", "เริ่ม 06.00 น.", 5, 12], [12, "ช่อง 1 SMC", "SMC", "07.00-12.00 น.", 9, 0], [13, "ช่อง 2 C/U", "SMC", "07.00-12.00 น.", "", 4],
  [14, "Key SMC(E)", "SMC", "07.00-12.00 น.", "", ""], [17, "เก็บ SMC", "SMC", "07.00-12.00 น.", "", ""],
];
spots.forEach(([r, n, g, t, h, i], k) => { setV(`D${r}`, k + 1); setV(`E${r}`, n); setV(`F${r}`, g); setV(`G${r}`, t); if (h !== "") setV(`H${r}`, h); if (i !== "") setV(`I${r}`, i); });
// วันหยุด
setV("M5", 46361); setV("S5", "ปิดทั้งหมด"); setF("O5", "=…", "เสาร์"); setF("Q5", "=…", "งดบริการ ไม่จัดเวรวันนี้"); setF("R5", "=…", 1);
setV("M6", 46362); setV("S6", "ปิดเฉพาะ SMC"); setF("Q6", "=…", "ปิดเฉพาะ SMC/Check-up");
setV("M7", 46363); setV("N7", "ชดเชยวันพ่อแห่งชาติ (5 ธ.ค.)");
for (let r = 8; r <= 44; r++) { setF(`O${r}`, "=…", ""); setF(`Q${r}`, "=…", ""); setF(`R${r}`, "=…", 0); }
// T: 5–9 สูตร (แผนเวร Key) · 10–13 ค่า · 14–27 สูตร =B5.. · 28–32 ค่า (28–29 มีชื่อ)
["สมพาน", "จีรินันท์", "เดือน", "อัมพร", "ศศิประภา"].forEach((n, i) => setF(`T${5 + i}`, `='แผนเวร Key'!A${5 + i}`, n));
["กฤษฎา", "มุกดารัตน์", "ภัทรสุดา", "ชัชวิชญ์"].forEach((n, i) => setV(`T${10 + i}`, n));
for (let i = 0; i < 14; i++) setF(`T${14 + i}`, `=B${5 + i}`, STAFF[i]);
setV("T28", "ปณิชา"); setV("T29", "กฤษณา");
setF("X5", "=T11", "มุกดารัตน์"); setF("X6", "=T10", "กฤษฎา");
["สุพัตตรา", "ขวัญจิรา", "จำเลียง"].forEach((n, i) => setV(`AC${5 + i}`, n)); // ย้ายจาก X16:X41 → AC5:AC104
["กฤษฎา", "มุกดารัตน์", "ภัทรสุดา", "ชัชวิชญ์"].forEach((n, i) => (setV(`X${44 + i}`, n), setV(`U${44 + i}`, n)));
["เดือน", "อัมพร", "ศศิประภา"].forEach((n, i) => setV(`X${52 + i}`, n));
["กฤษฎา", "มุกดารัตน์"].forEach((n, i) => setV(`Y${9 + i}`, n));
const SNAP = JSON.stringify([...forms.entries()]);

const A1 = (c: number, r: number) => { let s = "", n = c; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s + r; };
function pr(r: string) {
  const m = /^'?([^'!]+)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(r);
  if (!m) throw new Error("range? " + r);
  return { tab: m[1], c1: colNum(m[2]), r1: +m[3], c2: m[4] ? colNum(m[4]) : colNum(m[2]), r2: m[5] ? +m[5] : +m[3] };
}
const writes: { range: string; values: unknown[][] }[] = [];
(globalThis as any).fetch = async (url: string, init?: any) => {
  const u = new URL(url);
  const json = (o: unknown) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
  if (u.pathname.endsWith("/values:batchGet")) {
    const fr = u.searchParams.get("valueRenderOption") === "FORMULA";
    return json({
      valueRanges: u.searchParams.getAll("ranges").map((r) => {
        const { tab, c1, r1, c2, r2 } = pr(r);
        if (tab !== "ตั้งค่า") throw new Error("tab " + tab);
        const out: string[][] = [];
        for (let y = r1; y <= r2; y++) { const row: string[] = []; for (let x = c1; x <= c2; x++) { const a = A1(x, y); row.push(fr && forms.has(a) ? forms.get(a)! : vals.get(a) ?? ""); } out.push(row); }
        return { values: out };
      }),
    });
  }
  if (u.pathname.endsWith("/values:batchUpdate")) {
    const b = JSON.parse(init.body);
    for (const d of b.data) {
      writes.push(d);
      const { tab, c1, r1 } = pr(d.range);
      if (tab !== "ตั้งค่า") throw new Error("write tab " + tab);
      d.values.forEach((row: unknown[], dy: number) => row.forEach((v, dx) => { const a = A1(c1 + dx, r1 + dy); if (forms.has(a)) throw new Error("เขียนทับสูตร " + a); vals.set(a, String(v ?? "")); }));
    }
    return json({});
  }
  throw new Error("API? " + url);
};

let pass = 0, fail = 0;
const ok = (c: boolean, msg: string) => { if (c) pass++; else { fail++; console.log("✗", msg); } };
const eq = (a: unknown, b: unknown, msg: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

(async () => {
  const repo = require("../src/lib/off/repo");
  const S = require("../src/lib/off/settings");
  const route = require("../src/app/api/off/settings/route");
  const call = (body: unknown) => route.POST({ json: async () => body });
  const clone = (x: any) => JSON.parse(JSON.stringify(x));

  console.log("1) อ่านแท็บ ตั้งค่า");
  const f0 = await repo.loadOffSettings();
  eq(f0.count, 14, "B2");
  eq([f0.periodStart, f0.periodEnd], ["2026-12-01", "2027-11-30"], "E15/E16");
  eq(f0.staff.length, 26, "26 แถว (B5:B30)");
  eq(f0.staff.filter((s: any) => s.name).map((s: any) => s.name), STAFF, "ชื่อ");
  ok(f0.staff.every((s: any) => !s.nameF && s.last === "" && s.rep === "" && s.repStart === ""), "ยังไม่มีลาออก");
  eq(f0.spots.filter((s: any) => s.editable).map((s: any) => s.row), [5, 6, 7, 8, 9, 10, 11, 12, 13], "แก้ค่าหมุนได้เฉพาะ H5:I13");
  eq(f0.spots.find((s: any) => s.row === 12).sun, "0", "ค่า 0 อ่านเป็น 0");
  eq(f0.spots.filter((s: any) => s.satEd).map((s: any) => s.row), [5, 8, 9, 10, 11, 12, 13], "แก้ได้เฉพาะช่อง H ที่สูตรใช้");
  eq(f0.spots.filter((s: any) => s.sunEd).map((s: any) => s.row), [5, 6, 7, 8, 9, 10, 11, 12, 13], "แก้ได้เฉพาะช่อง I ที่สูตรใช้ (รวม I6 ช่อง 9 อาทิตย์)");
  eq(f0.holidays.length, 3, "วันหยุด 3 รายการ");
  eq(f0.holidays[0], { date: "2026-12-05", name: "", type: "ปิดทั้งหมด", wd: "เสาร์", status: "งดบริการ ไม่จัดเวรวันนี้" }, "วันหยุดแถวแรก");
  eq(f0.lists.T.map((x: any) => x.f), [...Array(5).fill(true), ...Array(4).fill(false), ...Array(14).fill(true), ...Array(17).fill(false)], "ธงสูตรของ T5:T44");
  eq(f0.lists.Y.length, 100, "Y9:Y108");
  eq(f0.lists.XC.length, 100, "AC5:AC104");
  eq(f0.lists.XC.filter((x: any) => x.v).map((x: any) => x.v), ["สุพัตตรา", "ขวัญจิรา", "จำเลียง"], "อ่านรายชื่อ เก็บ/บัตรคิว จาก AC");
  eq(f0.doc, { title: "ตารางเวรทดสอบ FM-XX", monthPrefix: "ประจำเดือน", signerName: "นางสาว ทดสอบ ผู้จัดทำ", signerTitle: "หัวหน้าหน่วยทดสอบ" }, "อ่านชื่อตาราง/ผู้ลงนาม B53:B56");
  eq(S.validateOffSettings(f0), [], "ค่าปัจจุบันผ่านการตรวจ");
  {
    const f = clone(f0); f.doc.title = " "; f.doc.signerName = "";
    const e = S.validateOffSettings(f);
    ok(e.some((x: string) => /ชื่อตาราง/.test(x)) && e.some((x: string) => /ผู้จัดทำ/.test(x)), "ชื่อตาราง/ผู้จัดทำว่าง → ไม่ให้บันทึก");
  }
  {
    const f = clone(f0); f.doc.signerName = "นาย ใหม่ ทดสอบ"; f.doc.title = "ชื่อใหม่";
    const w = S.offSettingsWrites(f0, f).writes;
    eq(w.filter((x: any) => /!B5[3-6]$/.test(x.range)).map((x: any) => [x.range, x.values[0][0]]), [["'ตั้งค่า'!B53", "ชื่อใหม่"], ["'ตั้งค่า'!B55", "นาย ใหม่ ทดสอบ"]], "เขียนเฉพาะช่องที่เปลี่ยน (B53, B55)");
    eq(S.offSettingsWrites(f0, clone(f0)).writes, [], "ไม่เปลี่ยน = ไม่เขียน");
  }

  console.log("2) ตรวจฟอร์ม");
  const bad = (mut: (f: any) => void, re: RegExp, msg: string) => { const f = clone(f0); mut(f); const e = S.validateOffSettings(f); ok(e.some((x: string) => re.test(x)), msg + " → " + e.join(" | ")); };
  bad((f) => (f.staff[0].rep = "คนใหม่"), /วันทำงานวันสุดท้าย/, "มีคนมาแทนแต่ไม่มีวันสุดท้าย");
  bad((f) => { f.staff[0].rep = "คนใหม่"; f.staff[0].last = "2027-01-31"; }, /วันเริ่มงานผู้มาแทน/, "ไม่มีวันเริ่มงานผู้มาแทน");
  bad((f) => { f.staff[0].rep = "คนใหม่"; f.staff[0].last = "2027-01-31"; f.staff[0].repStart = "2027-01-31"; }, /ต้องหลัง/, "วันเริ่มไม่หลังวันสุดท้าย");
  bad((f) => (f.staff[0].repStart = "2027-02-01"), /ไม่มีชื่อผู้มาแทน/, "วันเริ่มแต่ไม่มีชื่อ");
  bad((f) => (f.staff[20].last = "2027-02-01"), /ไม่มีชื่อเจ้าหน้าที่/, "แถวว่างใส่วันลาออก");
  bad((f) => (f.staff[1].name = STAFF[0]), /ซ้ำ/, "ชื่อในรอบซ้ำ");
  bad((f) => (f.spots[0].sat = "3"), /ค่าหมุนเวร 3 ซ้ำ/, "ค่าหมุนซ้ำ");
  bad((f) => (f.spots[0].sat = "14"), /0–13/, "ค่าหมุนเกินจำนวนคน");
  bad((f) => (f.spots[0].sat = "1.5"), /0–13/, "ค่าหมุนไม่ใช่จำนวนเต็ม");
  bad((f) => (f.holidays[0].type = "อื่น ๆ"), /ประเภทการปิด/, "ประเภทการปิดผิด");
  bad((f) => f.holidays.push({ date: "", name: "x", type: "", wd: "", status: "" }), /ยังไม่ใส่วันที่/, "วันหยุดไม่มีวันที่");
  bad((f) => (f.staff[0].last = "31/01/2027"), /รูปแบบวันที่/, "รูปแบบวันที่");
  bad((f) => (f.lists.T[5].v = ""), /T10 .*ต้องมีชื่อ/, "T10 (คนหมุน ช่อง 6/8) ห้ามว่าง");
  bad((f) => (f.lists.XC[1].v = "สุพัตตรา"), /ชื่อซ้ำ สุพัตตรา/, "ชื่อซ้ำในรายชื่อ");
  let r = await call({ form: (() => { const f = clone(f0); f.spots[0].sat = "3"; return f; })() });
  eq(r.status, 400, "API ปฏิเสธฟอร์มผิด");
  ok(writes.length === 0, "ฟอร์มผิดไม่เขียนชีต");

  console.log("3) บันทึก: ลาออก + คนมาแทน");
  const f1 = clone(f0);
  f1.staff[0].last = "2027-01-31"; f1.staff[0].rep = "คนใหม่"; f1.staff[0].repStart = "2027-02-14";
  r = await call({ form: f1 });
  eq(r.status, 200, "บันทึกสำเร็จ " + JSON.stringify(r.body));
  eq(writes.map((w) => w.range).sort(), ["'ตั้งค่า'!AA5", "'ตั้งค่า'!AB5", "'ตั้งค่า'!T30", "'ตั้งค่า'!Z5"].sort(), "เขียนเฉพาะช่องที่เปลี่ยน + เติมคนมาแทนใน T30");
  eq(r.body.addedToT, ["คนใหม่"], "แจ้งว่าเติมชื่อใน Dropdown");
  eq([vals.get("Z5"), vals.get("AA5"), vals.get("AB5"), vals.get("T30")], ["2027-01-31", "คนใหม่", "2027-02-14", "คนใหม่"], "ค่าที่เขียน");
  eq(JSON.stringify([...forms.entries()]), SNAP, "ไม่แตะช่องสูตร");
  // ชีตแปลงวันที่เป็น serial เอง — จำลอง
  vals.set("Z5", "46418"); vals.set("AB5", "46432");
  const f2 = await repo.loadOffSettings();
  eq([f2.staff[0].last, f2.staff[0].rep, f2.staff[0].repStart], ["2027-01-31", "คนใหม่", "2027-02-14"], "อ่านกลับ");
  writes.length = 0;
  r = await call({ form: f2 });
  eq([r.status, writes.length], [200, 0], "บันทึกซ้ำโดยไม่แก้ → ไม่เขียน");

  console.log("4) บันทึก: ค่าหมุนเวร / วันหยุด / รายชื่อ / ช่องสูตร");
  const f3 = clone(f2);
  f3.spots[0].sat = "8"; // 1 → 8 (ไม่ซ้ำ)
  f3.spots.find((s: any) => s.row === 14).sat = "10"; // แถวที่แก้ไม่ได้ → ไม่เขียน
  f3.spots.find((s: any) => s.row === 6).sat = "11"; // H6 (ช่อง 9 เสาร์ เลือกเอง) สูตรไม่ใช้ → ไม่เขียน
  f3.holidays.splice(1, 1);
  f3.holidays.push({ date: "2027-04-13", name: "สงกรานต์", type: "ปิดทั้งหมด", wd: "", status: "" });
  f3.lists.XC[3].v = "ยอดชาย";
  f3.lists.T[0].v = "แก้สูตร"; // T5 เป็นสูตร → ข้าม
  f3.lists.Y[2].v = " ภัทรสุดา ";
  writes.length = 0;
  r = await call({ form: f3 });
  eq(r.status, 200, "บันทึกสำเร็จ");
  const rs = writes.map((w) => w.range);
  ok(rs.includes("'ตั้งค่า'!H5") && !rs.some((x) => /H14|I14|H6\b/.test(x)), "เขียน H5 ไม่เขียน H14 / H6");
  ok(rs.includes("'ตั้งค่า'!M5:N44") && rs.includes("'ตั้งค่า'!S5:S44"), "วันหยุดเขียน M:N และ S ทั้งบล็อก");
  ok(!rs.some((x) => /'!(O|P|Q|R|V)\d/.test(x)), "ไม่เขียนคอลัมน์สูตร O P Q R V");
  eq([vals.get("M6"), vals.get("N6"), vals.get("S6"), vals.get("M7"), vals.get("N7"), vals.get("S7"), vals.get("M8")], ["2026-12-07", "ชดเชยวันพ่อแห่งชาติ (5 ธ.ค.)", "", "2027-04-13", "สงกรานต์", "ปิดทั้งหมด", ""], "วันหยุดเลื่อนขึ้นและเพิ่มท้าย");
  eq([vals.get("AC8"), vals.get("Y11"), vals.get("H5")], ["ยอดชาย", "ภัทรสุดา", "8"], "รายชื่อ/ค่าหมุนที่เขียน");
  ok(r.body.skipped.includes("T5"), "แจ้งข้ามช่องสูตร T5");
  eq(JSON.stringify([...forms.entries()]), SNAP, "ไม่แตะช่องสูตร");

  console.log("4b) ลบชื่อกลางรายชื่อ (เลื่อนขึ้น) แล้วบันทึก — รายชื่อหมุน Key ช่อง 2 (COUNTA ต้องไม่มีช่องว่าง)");
  const g = await repo.loadOffSettings();
  g.lists.XK = [{ v: "เดือน", f: false }, { v: "ศศิประภา", f: false }, ...g.lists.XK.slice(2).map(() => ({ v: "", f: false }))]; // ลบ อัมพร (กลาง)
  writes.length = 0;
  r = await call({ form: g });
  eq(r.status, 200, "บันทึกสำเร็จ");
  eq([vals.get("X52"), vals.get("X53"), vals.get("X54")], ["เดือน", "ศศิประภา", ""], "เลื่อนขึ้น ไม่มีช่องว่างกลางรายการ");

  console.log("5) ชื่อในรอบหมุนเวร (เปลี่ยนชื่อ) / ช่องสูตรในชีตเปลี่ยนภายหลัง");
  const f4 = await repo.loadOffSettings();
  f4.staff[13].name = "ปณิชา";
  writes.length = 0;
  r = await call({ form: f4 });
  eq([r.status, writes.map((w) => w.range)], [200, ["'ตั้งค่า'!B18"]], "เปลี่ยนชื่อ B18");
  // ถ้าในชีตมีคนเปลี่ยนช่องค่าเป็นสูตรระหว่างนั้น → เว็บไม่เขียนทับ
  forms.set("AC9", "=T12"); vals.set("AC9", "ภัทรสุดา");
  const f5 = clone(f4); f5.lists.XC[4].v = "ทับสูตร";
  writes.length = 0;
  r = await call({ form: f5 });
  eq([r.status, writes.length, r.body.skipped.includes("AC9")], [200, 0, true], "อ่านธงสูตรจากชีตล่าสุดก่อนเขียน");

  console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
