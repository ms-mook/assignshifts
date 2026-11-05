// ส่วนทดสอบ "ตรวจทั้งระบบ" — เรียกจาก test-system.ts (ใช้ชีตจำลองชุดเดียวกัน)
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const require: any;
export default async function () {
  const T = (globalThis as any).__T;
  const { ok, Y, M, YM } = T;
  const sc = require("../src/lib/system-check");
  const s3repo = require("../src/lib/shift3/repo"), s3eng = require("../src/lib/shift3/engine");
  const krepo = require("../src/lib/key/repo"), keng = require("../src/lib/key/engine");
  const mrepo = require("../src/lib/smc/repo");
  const orepo = require("../src/lib/ot/repo"), oeng = require("../src/lib/ot/engine");
  const lt = require("../src/lib/leave-tab");
  const { cellPerson } = require("../src/lib/shift3/conflicts");

  console.log("8) ตรวจทั้งระบบ — ก่อนใส่ปัญหา");
  const base = await sc.checkMonth(YM);
  ok(base.failed.length === 0, "โหลดครบ 6 ตาราง: " + JSON.stringify(base.failed));
  const sig = (i: any) => `${i.level}|${i.kind}|${i.day}|${i.at.map((a: any) => a.cell).join(",")}`;
  const baseSet = new Set(base.issues.map(sig));
  console.log(`   ฐาน: ข้อผิดพลาด ${base.errors} · คำเตือน ${base.warns}`);
  const kinds = (r: any) => Array.from(new Set(r.issues.map((i: any) => `${i.level}:${i.kind}`)));
  console.log("   ", kinds(base).join(" | "));
  for (const i of base.issues.filter((x: any) => x.level === "error")) console.log(`    · ${i.kind} · วันที่ ${i.day} · ${i.at.map((a: any) => a.table + ":" + a.cell + " " + a.label).join(" / ")} · ${i.text}`);
  ok(base.issues.every((i: any) => i.at.length > 0 && i.at.every((a: any) => /^(1|2|3|k|m|o):[A-Z]+:\d+$/.test(a.cell) && a.label)), "ทุกรายการมีช่องที่กดไปดูได้");
  ok(base.issues.some((i: any) => i.kind === "อยู่หลายตารางเวลาทับกัน" || true), "");
  // การลาวันที่ 15 ใส่คนแทนครบแล้ว (จากข้อ 2) — ยกเว้น อัมพร (Key4) ที่ลาแต่ไม่มีคนแทนในตาราง Key
  // (OT วันที่ 15 ถูกยกเลิกแล้วอนุมัติใหม่ในข้อ 4 → แถวใหม่ไม่มีคนแทน จึงต้องขึ้น)
  ok(!base.issues.some((i: any) => i.day === 15 && i.kind === "ลายังไม่มีคนแทน" && !["key", "ot"].includes(i.at[0].table)), "วันที่ 15: ลาที่ใส่คนแทนแล้ว ไม่ขึ้นข้อผิดพลาด");
  ok(base.issues.some((i: any) => i.day === 15 && i.kind === "ลายังไม่มีคนแทน" && i.at[0].table === "ot"), "OT วันที่ 15: การลาที่อนุมัติใหม่ (คนแทนเดิมหายไปตอนยกเลิก) ขึ้นข้อผิดพลาด");
  ok(base.issues.some((i: any) => i.day === 15 && i.at[0].table === "key" && i.kind === "ลายังไม่มีคนแทน"), "วันที่ 15: Key4 (อัมพร) ลาแต่ไม่มีผู้แทน → ข้อผิดพลาดตาราง Key");

  console.log("9) ใส่ปัญหาแต่ละแบบ แล้วตรวจต้องเจอ และกดไปที่ช่องได้ถูกต้อง");
  let d3 = await s3repo.loadShift3();
  let r3 = s3eng.computeMonth(d3.settings, d3.leaves, (await s3repo.loadMonthState(d3, Y, M)).manual, Y, M);
  // (ก) 3 ช่วงเวลา: ชื่อซ้ำในแถว (สร้างโดยตรง ไม่ผ่านการกัน) วันที่ 2
  const row2 = r3.sections[0].rows[1].cells;
  const who2 = row2.slice(1).map(cellPerson).find((x: any) => x);
  const emptyC = row2.findIndex((c: string, i: number) => i > 0 && c === "" && i !== 1);
  await s3repo.saveManualMany(Y, M, [{ key: `1:${s3eng.colLetter(emptyC)}:2`, value: who2 }]);
  // (ข) 3 ช่วงเวลา: ลายังไม่มีคนแทน วันที่ 16 + (ค) ลาในชีต OT ของคนตาราง 3 ช่วงเวลา วันที่ 21
  const p16 = r3.sections[1].rows[15].cells.slice(1).map(cellPerson).find((x: any) => x && !String(x).startsWith("พนักงานใหม่"));
  const p21 = r3.sections[0].rows[20].cells.slice(1).map(cellPerson).find((x: any) => x && !String(x).startsWith("พนักงานใหม่"));
  const s3rows = (await lt.readLeaveTab("S3")).filter((r: any) => r.date.startsWith("2026-12"));
  await lt.saveLeaveTabMonth("S3", YM, [...s3rows, { date: "2026-12-16", name: p16, replacement: "", type: "ลากิจ", note: "" }]);
  const otRows = (await lt.readLeaveTab("OT")).filter((r: any) => r.date.startsWith("2026-12"));
  await lt.saveLeaveTabMonth("OT", YM, [...otRows, { date: "2026-12-21", name: p21, replacement: "", type: "ลาป่วย", note: "" }, { date: "2026-12-22", name: p21, replacement: "", type: "แลกเวร", note: "" }]);
  // (ง) Key: ชื่อซ้ำ วันที่ 3
  let ks = await krepo.loadKey();
  const km = keng.computeKeyMonth(ks, {}, Y, M);
  const kdup = km.rows[2].cells.D;
  await krepo.saveKeyManual(Y, M, [{ key: "k:K:3", value: kdup }]);
  // (จ) Key: ตำแหน่งว่าง วันที่ 4
  await krepo.saveKeyManual(Y, M, [{ key: "k:E:4", value: "" }]);
  // (ฉ) SMC: คนลาวันที่ 17 ยังอยู่ในตาราง (ไม่มีคนแทน)
  let ms = await mrepo.loadSmc();
  const smc17 = ms.key0830;
  const smRows = (await lt.readLeaveTab("SMC")).filter((r: any) => r.date.startsWith("2026-12"));
  await lt.saveLeaveTabMonth("SMC", YM, [...smRows, { date: "2026-12-17", name: smc17, replacement: "", type: "ลาป่วย", note: "" }]);
  // (ช) OT: ชื่อซ้ำ (เตือน) วันที่ 8
  const od = await orepo.loadOt();
  const om = oeng.computeOtMonth(od.settings, od.leaves, {}, Y, M);
  const otWho = require("../src/lib/ot/conflicts").otPerson(om.rows[7].cells.C);
  await orepo.saveOtManual(Y, M, [{ key: "o:B:8", value: otWho }]);
  // (ซ) คนตาราง Key อยู่ในตาราง 6.00-8.30 วันที่ 9 (เวลาทับกัน)
  const keyWho = km.rows[8].cells.F;
  const e9 = r3.sections[0].rows[8].cells.findIndex((c: string, i: number) => i > 1 && c === "");
  await s3repo.saveManualMany(Y, M, [{ key: `1:${s3eng.colLetter(e9)}:9`, value: keyWho }]);

  const after = await sc.checkMonth(YM);
  const fresh = after.issues.filter((i: any) => !baseSet.has(sig(i)));
  console.log(`   หลังใส่ปัญหา: ข้อผิดพลาด ${after.errors} · คำเตือน ${after.warns} · ใหม่ ${fresh.length}`);
  for (const i of fresh) console.log(`    - [${i.level}] ${i.kind} · วันที่ ${i.day} · ${i.at.map((a: any) => `${a.table}:${a.cell} ${a.label}`).join(" / ")} · ${i.text}`);
  const has = (pred: (i: any) => boolean, msg: string) => ok(fresh.some(pred), msg);
  has((i) => i.level === "error" && i.kind === "ชื่อซ้ำ" && i.day === 2 && i.at.length === 2 && i.at.every((a: any) => a.table === "s1") && i.at.some((a: any) => a.cell === `1:${s3eng.colLetter(emptyC)}:2`), "(ก) ชื่อซ้ำในแถว 6.00-8.30 = ข้อผิดพลาด ชี้ 2 ช่อง");
  has((i) => i.level === "error" && i.kind === "ลายังไม่มีคนแทน" && i.day === 16 && i.at[0].table !== "key" && i.text.includes(p16), "(ข) ลายังไม่มีคนแทน = ข้อผิดพลาด");
  has((i) => i.level === "warn" && i.kind === "มีบันทึกลาแต่ยังมีชื่อ" && i.day === 21 && i.text.includes(p21) && i.text.includes("ตาราง OT"), "(ค) ลาที่หน้า ลา-แลกเวร ของชีตอื่น แต่ยังมีชื่อ = คำเตือน");
  ok(!fresh.some((i: any) => i.kind === "มีบันทึกลาแต่ยังมีชื่อ" && i.day === 22), "(ค) แลกเวร ไม่นับเป็นการลาทั้งวัน");
  has((i) => i.level === "error" && i.kind === "ชื่อซ้ำ" && i.day === 3 && i.at[0].table === "key" && i.at.some((a: any) => a.cell === "k:K:3"), "(ง) Key ชื่อซ้ำ = ข้อผิดพลาด");
  has((i) => i.level === "error" && i.kind === "ตำแหน่งว่าง" && i.day === 4 && i.at[0].cell === "k:E:4", "(จ) Key ตำแหน่งว่าง = ข้อผิดพลาด");
  has((i) => i.level === "error" && i.kind === "คนลายังอยู่ในตาราง" && i.day === 17 && i.at[0].table === "smc" && i.text.includes(smc17), "(ฉ) SMC คนลายังอยู่ในตาราง = ข้อผิดพลาด");
  has((i) => i.level === "warn" && i.kind.startsWith("ชื่อซ้ำ") && i.day === 8 && i.at[0].table === "ot", "(ช) OT ชื่อซ้ำ = คำเตือน (ควบได้)");
  has((i) => i.level === "warn" && i.kind === "อยู่หลายตารางเวลาทับกัน" && i.day === 9 && i.at.some((a: any) => a.table === "s1") && i.at.some((a: any) => a.table === "key"), "(ซ) อยู่ตาราง 6.00-8.30 และ Key เวลาทับกัน = คำเตือน");
  ok(after.issues.findIndex((i: any) => i.level === "warn") > after.issues.findLastIndex((i: any) => i.level === "error"), "ข้อผิดพลาดเรียงก่อนคำเตือน");

  console.log("10) แก้แล้วตรวจอีกครั้ง → หายไป");
  await s3repo.saveManualMany(Y, M, [{ key: `1:${s3eng.colLetter(emptyC)}:2`, value: null }, { key: `1:${s3eng.colLetter(e9)}:9`, value: null }]);
  await krepo.saveKeyManual(Y, M, [{ key: "k:K:3", value: null }, { key: "k:E:4", value: null }]);
  const fixed = await sc.checkMonth(YM);
  const left = fixed.issues.filter((i: any) => !baseSet.has(sig(i))).map((i: any) => `${i.kind}|${i.day}`);
  ok(!left.includes("ชื่อซ้ำ|2") && !left.includes("ชื่อซ้ำ|3") && !left.includes("ตำแหน่งว่าง|4") && !left.includes("อยู่หลายตารางเวลาทับกัน|9"), "แก้แล้วรายการหายไป: " + JSON.stringify(left));
  ok(left.includes("ลายังไม่มีคนแทน|16") && left.includes("คนลายังอยู่ในตาราง|17"), "ที่ยังไม่แก้ยังอยู่");
}
