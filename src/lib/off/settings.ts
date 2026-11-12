// ตั้งค่า ตารางเวรนอกเวลา — อ่าน/เขียนแท็บ "ตั้งค่า" ของสำเนาชีต (ส่วนฟังก์ชันล้วน: ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และชุดทดสอบ)
// หลักการ: เขียนเฉพาะช่องที่เป็น "ค่า" เท่านั้น ช่องที่เป็นสูตรแสดงอย่างเดียว (ตรวจซ้ำตอนบันทึกจากสูตรจริงในชีต)
import { isoFromSerial, toSerial } from "../sheets-date";

export const OFF_SET_RANGE = "'ตั้งค่า'!A1:AC110";
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const at = (g: unknown[][], r: number, c: string) => (g[r - 1] ?? [])[colIdx(c)];
export function colIdx(c: string): number {
  let n = 0;
  for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
const iso = (v: unknown) => {
  const n = toSerial(v);
  return n === null ? "" : isoFromSerial(n);
};

/** รายชื่อ (ช่วงในคอลัมน์เดียว) — f = ช่องนี้เป็นสูตร (แก้บนเว็บไม่ได้) */
export interface ListCell { v: string; f: boolean }
export const OFF_LISTS = {
  T: { col: "T", r1: 5, r2: 44, title: "รายชื่อสำหรับ Dropdown (ทั่วไป)", note: "ใช้กับ Key 1–5, ช่อง 7, ช่อง 9 วันอาทิตย์, 10–14,16, Key SMC, ช่อง 1 SMC, ช่อง 2 C/U และสรุปจำนวนเวร (สูงสุด 40 ชื่อรวมช่องสูตร) · ช่องสูตรดึงจากรายชื่อหมุนเวร / แผนเวร Key" },
  Y: { col: "Y", r1: 9, r2: 108, title: "รายชื่อ Dropdown ช่อง 9 (เฉพาะวันเสาร์ ผู้จัดเวรเลือกเอง)", note: "ใช้กับช่อง 9 วันเสาร์ · สูงสุด 100 ชื่อ" },
  XC: { col: "AC", r1: 5, r2: 104, title: "รายชื่อ Dropdown จุด เก็บ 1 / เก็บ 2 / บัตรคิว / เก็บ SMC", note: "สูงสุด 100 ชื่อ" },
  X6: { col: "X", r1: 44, r2: 49, title: "รายชื่อหมุนเวร ช่อง 6 (จ.-ศ.)", note: "สูงสุด 6 ชื่อ" },
  XK: { col: "X", r1: 52, r2: 59, title: "รายชื่อหมุนเวร Key ช่อง 2 (จ. อ. พฤ. ศ. ยกเว้นวันพุธ)", note: "สูงสุด 8 ชื่อ" },
  UW: { col: "U", r1: 44, r2: 51, title: "รายชื่อ Key ช่อง 2 เฉพาะวันพุธ", note: "สูงสุด 8 ชื่อ" },
} as const;
export type OffListKey = keyof typeof OFF_LISTS;

/**
 * ช่องในรายชื่อที่สูตรหมุนเวรอ้างอิงตามตำแหน่ง → แก้ชื่อได้ แต่ไม่เลื่อน/ไม่ลบ (ต้องมีชื่อเสมอ)
 * T10–T11 = คนหมุน ช่อง 6(E)/ช่อง 8 (ตั้งค่า!X5:X6) · T12–T13 = คนหมุน ช่อง 10 (เสาร์)/Key SMC(E) (ตั้งค่า!Y5:Y6)
 */
export const OFF_LIST_FIXED: Partial<Record<OffListKey, Record<number, string>>> = {
  T: { 10: "หมุนเวร ช่อง 6(E)/ช่อง 8 (X6)", 11: "หมุนเวร ช่อง 6(E)/ช่อง 8 (X5)", 12: "หมุนเวร ช่อง 10 เสาร์/Key SMC (Y6)", 13: "หมุนเวร ช่อง 10 เสาร์/Key SMC (Y5)" },
};

export interface OffStaffRow { row: number; name: string; last: string; rep: string; repStart: string; nameF: boolean }
export interface OffSpotRow { row: number; order: string; name: string; group: string; time: string; sat: string; sun: string; editable: boolean; satEd: boolean; sunEd: boolean }
export interface OffHoliday { date: string; name: string; type: string; wd: string; status: string }
/** ชื่อตาราง / หัวตาราง / ผู้ลงนาม (ตั้งค่า!B53:B56 → แท็บรายเดือน A1, A2, Q39, Q40) */
export interface OffDoc { title: string; monthPrefix: string; signerName: string; signerTitle: string }
export const OFF_DOC_ROWS = { title: 53, monthPrefix: 54, signerName: 55, signerTitle: 56 } as const;
export interface OffSettingsForm {
  doc: OffDoc;
  count: number;
  periodStart: string;
  periodEnd: string;
  staff: OffStaffRow[];
  spots: OffSpotRow[];
  holidays: OffHoliday[];
  lists: Record<OffListKey, ListCell[]>;
}

/** แถวค่าหมุนเวร (H5:I13) */
export const OFF_ROT_ROWS = [5, 6, 7, 8, 9, 10, 11, 12, 13];
/** ช่องค่าหมุนที่สูตรในแท็บ ตารางเวร ส-อา ใช้จริง (H6 ช่อง 9 เสาร์ = ผู้จัดเวรเลือกเอง · H7 ช่อง 10 เสาร์ = รายชื่อสลับ Y5:Y6 · I6 ช่อง 9 อาทิตย์ = หมุนเวร) */
export const OFF_ROT_USED = { H: [5, 8, 9, 10, 11, 12, 13], I: [5, 6, 7, 8, 9, 10, 11, 12, 13] };
export const OFF_HOLIDAY_ROWS = 40; // M5:M44
export const OFF_CLOSE_TYPES = ["", "ปิดทั้งหมด", "ปิดเฉพาะ SMC"];

/** v = ค่า (UNFORMATTED) · f = สูตร (FORMULA) ของ ตั้งค่า!A1:AB72 */
export function parseOffSettings(v: unknown[][], f: unknown[][]): OffSettingsForm {
  const isF = (r: number, c: string) => str(at(f, r, c)).startsWith("=");
  const staff: OffStaffRow[] = [];
  for (let r = 5; r <= 30; r++)
    staff.push({ row: r, name: str(at(v, r, "B")).trim(), last: iso(at(v, r, "Z")), rep: str(at(v, r, "AA")).trim(), repStart: iso(at(v, r, "AB")), nameF: isF(r, "B") });
  const spots: OffSpotRow[] = [];
  for (const r of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17])
    spots.push({
      row: r,
      order: str(at(v, r, "D")),
      name: str(at(v, r, "E")),
      group: str(at(v, r, "F")),
      time: str(at(v, r, "G")),
      sat: str(at(v, r, "H")),
      sun: str(at(v, r, "I")),
      editable: OFF_ROT_ROWS.includes(r) && !isF(r, "H") && !isF(r, "I"),
      satEd: OFF_ROT_USED.H.includes(r) && !isF(r, "H"),
      sunEd: OFF_ROT_USED.I.includes(r) && !isF(r, "I"),
    });
  const holidays: OffHoliday[] = [];
  for (let r = 5; r < 5 + OFF_HOLIDAY_ROWS; r++) {
    const date = iso(at(v, r, "M"));
    const name = str(at(v, r, "N"));
    const type = str(at(v, r, "S"));
    if (date === "" && name === "" && type === "") continue;
    holidays.push({ date, name, type, wd: str(at(v, r, "O")), status: str(at(v, r, "Q")) });
  }
  const lists = {} as Record<OffListKey, ListCell[]>;
  for (const [k, d] of Object.entries(OFF_LISTS) as [OffListKey, (typeof OFF_LISTS)[OffListKey]][]) {
    lists[k] = [];
    for (let r = d.r1; r <= d.r2; r++) lists[k].push({ v: str(at(v, r, d.col)).trim(), f: isF(r, d.col) });
  }
  const doc: OffDoc = {
    title: str(at(v, 53, "B")).trim(),
    monthPrefix: str(at(v, 54, "B")).trim(),
    signerName: str(at(v, 55, "B")).trim(),
    signerTitle: str(at(v, 56, "B")).trim(),
  };
  return {
    doc,
    count: Number(at(v, 2, "B")) || 0,
    periodStart: iso(at(v, 15, "E")),
    periodEnd: iso(at(v, 16, "E")),
    staff,
    spots,
    holidays,
    lists,
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** ตรวจฟอร์มก่อนบันทึก → ข้อความผิดพลาด (ว่าง = ผ่าน) */
export function validateOffSettings(f: OffSettingsForm): string[] {
  const err: string[] = [];
  if (!f.doc || f.doc.title.trim() === "") err.push("ชื่อตาราง (หัวตารางบรรทัดที่ 1) ต้องไม่ว่าง");
  if (!f.doc || f.doc.monthPrefix.trim() === "") err.push("คำนำหน้าเดือน (หัวตารางบรรทัดที่ 2) ต้องไม่ว่าง");
  if (!f.doc || f.doc.signerName.trim() === "") err.push("ชื่อผู้จัดทำ (ลายเซ็นท้ายตาราง) ต้องไม่ว่าง");
  const names = f.staff.map((s) => s.name.trim()).filter((n) => n !== "");
  const count = names.length;
  f.staff.forEach((s, i) => {
    const who = s.name.trim() || `แถว ${i + 1}`;
    for (const d of [s.last, s.repStart]) if (d !== "" && !DATE.test(d)) err.push(`${who}: รูปแบบวันที่ไม่ถูกต้อง`);
    if (s.name.trim() === "" && (s.last || s.rep.trim() || s.repStart)) err.push(`แถว ${i + 1}: ใส่วันลาออก/คนมาแทน แต่ไม่มีชื่อเจ้าหน้าที่`);
    if (s.rep.trim() !== "" && s.last === "") err.push(`${who}: ใส่ชื่อผู้มาแทนแล้ว ต้องใส่ "วันทำงานวันสุดท้าย" ของคนเดิมด้วย`);
    if (s.rep.trim() !== "" && s.repStart === "") err.push(`${who}: ใส่ชื่อผู้มาแทนแล้ว ต้องใส่ "วันเริ่มงานผู้มาแทน" ด้วย`);
    if (s.rep.trim() === "" && s.repStart !== "") err.push(`${who}: ใส่วันเริ่มงานผู้มาแทน แต่ไม่มีชื่อผู้มาแทน`);
    if (s.last !== "" && s.repStart !== "" && s.repStart <= s.last) err.push(`${who}: วันเริ่มงานผู้มาแทนต้องหลังวันทำงานวันสุดท้าย`);
    if (s.rep.trim() !== "" && s.rep.trim() === s.name.trim()) err.push(`${who}: ชื่อผู้มาแทนซ้ำกับชื่อเดิม`);
  });
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) err.push(`ชื่อในรอบหมุนเวรซ้ำ: ${Array.from(new Set(dup)).join(", ")}`);
  // ค่าหมุนเวร: จำนวนเต็ม 0..(จำนวนคน-1) และไม่ซ้ำกัน (หลักการในแท็บ ตั้งค่า A47)
  const vals: { v: number; where: string }[] = [];
  for (const s of f.spots) {
    if (!s.editable) continue;
    for (const [day, raw] of [["เสาร์", s.sat], ["อาทิตย์", s.sun]] as const) {
      const t = String(raw).trim();
      if (t === "") continue;
      const n = Number(t);
      if (!Number.isInteger(n) || n < 0 || n > count - 1) err.push(`ค่าหมุนเวร ${s.name} (${day}) ต้องเป็นเลข 0–${count - 1}`);
      else vals.push({ v: n, where: `${s.name} (${day})` });
    }
  }
  for (const x of vals) {
    const same = vals.filter((y) => y.v === x.v);
    if (same.length > 1 && same[0] === x) err.push(`ค่าหมุนเวร ${x.v} ซ้ำกัน: ${same.map((y) => y.where).join(", ")}`);
  }
  if (f.holidays.length > OFF_HOLIDAY_ROWS) err.push(`วันหยุดได้สูงสุด ${OFF_HOLIDAY_ROWS} รายการ`);
  f.holidays.forEach((h, i) => {
    if (h.date !== "" && !DATE.test(h.date)) err.push(`วันหยุดแถว ${i + 1}: รูปแบบวันที่ไม่ถูกต้อง`);
    if (h.date === "" && (h.name || h.type)) err.push(`วันหยุดแถว ${i + 1}: ยังไม่ใส่วันที่`);
    if (!OFF_CLOSE_TYPES.includes(h.type)) err.push(`วันหยุดแถว ${i + 1}: ประเภทการปิดไม่ถูกต้อง`);
  });
  for (const [k, d] of Object.entries(OFF_LISTS) as [OffListKey, (typeof OFF_LISTS)[OffListKey]][]) {
    const l = f.lists[k] ?? [];
    if (l.length !== d.r2 - d.r1 + 1) err.push(`${d.title}: จำนวนช่องไม่ถูกต้อง`);
    for (const r of Object.keys(OFF_LIST_FIXED[k] ?? {}).map(Number))
      if (!l[r - d.r1]?.f && (l[r - d.r1]?.v ?? "").trim() === "") err.push(`${d.col}${r} (${OFF_LIST_FIXED[k]![r]}) ต้องมีชื่อ`);
    const ns = l.map((x) => x.v.trim()).filter((x) => x !== "");
    const dupL = ns.filter((n, i) => ns.indexOf(n) !== i);
    if (dupL.length) err.push(`${d.title}: ชื่อซ้ำ ${Array.from(new Set(dupL)).join(", ")}`);
  }
  return err;
}

/**
 * สร้างรายการเขียน (เฉพาะช่องที่เปลี่ยน และไม่ใช่สูตรในชีตตอนนี้)
 *  cur = ฟอร์มที่อ่านจากชีตล่าสุด (มีธงสูตรจริง) · next = ฟอร์มที่ผู้ใช้ส่งมา
 *  คนมาแทนที่ยังไม่อยู่ในรายชื่อ Dropdown ทั่วไป (T) → เติมลงช่องว่างที่ไม่ใช่สูตร (เพื่อให้เลือกได้และอยู่ในสรุป)
 */
export function offSettingsWrites(cur: OffSettingsForm, next: OffSettingsForm): { writes: { range: string; values: unknown[][] }[]; addedToT: string[]; skipped: string[] } {
  const writes: { range: string; values: unknown[][] }[] = [];
  const skipped: string[] = [];
  const put = (c: string, r: number, val: string) => writes.push({ range: `'ตั้งค่า'!${c}${r}`, values: [[val]] });
  for (const k of ["title", "monthPrefix", "signerName", "signerTitle"] as const)
    if ((next.doc?.[k] ?? "").trim() !== (cur.doc?.[k] ?? "")) put("B", OFF_DOC_ROWS[k], next.doc[k].trim());
  next.staff.forEach((s, i) => {
    const c = cur.staff[i];
    if (!c) return;
    if (s.name.trim() !== c.name) {
      if (c.nameF) skipped.push(`B${c.row}`);
      else put("B", c.row, s.name.trim());
    }
    if (s.last !== c.last) put("Z", c.row, s.last);
    if (s.rep.trim() !== c.rep) put("AA", c.row, s.rep.trim());
    if (s.repStart !== c.repStart) put("AB", c.row, s.repStart);
  });
  next.spots.forEach((s) => {
    const c = cur.spots.find((x) => x.row === s.row);
    if (!c || !c.editable) return;
    if (c.satEd && String(s.sat).trim() !== c.sat) put("H", c.row, String(s.sat).trim());
    if (c.sunEd && String(s.sun).trim() !== c.sun) put("I", c.row, String(s.sun).trim());
  });
  // วันหยุด: เขียนทั้งบล็อก M/N และ S (O P Q R V เป็นสูตร ไม่แตะ)
  const hol = [...next.holidays, ...Array(Math.max(0, OFF_HOLIDAY_ROWS - next.holidays.length)).fill({ date: "", name: "", type: "" })].slice(0, OFF_HOLIDAY_ROWS);
  const curHol = [...cur.holidays, ...Array(Math.max(0, OFF_HOLIDAY_ROWS - cur.holidays.length)).fill({ date: "", name: "", type: "" })].slice(0, OFF_HOLIDAY_ROWS);
  if (JSON.stringify(hol.map((h) => [h.date, h.name, h.type])) !== JSON.stringify(curHol.map((h) => [h.date, h.name, h.type]))) {
    writes.push({ range: "'ตั้งค่า'!M5:N44", values: hol.map((h) => [h.date, h.name]) });
    writes.push({ range: "'ตั้งค่า'!S5:S44", values: hol.map((h) => [h.type]) });
  }
  const lists = { ...next.lists };
  // คนมาแทน → รายชื่อ Dropdown ทั่วไป (T)
  const addedToT: string[] = [];
  const t = (lists.T ?? []).map((x) => ({ ...x }));
  const inT = (n: string) => t.some((x) => x.v === n) || next.staff.some((s) => s.name.trim() === n);
  for (const s of next.staff) {
    const n = s.rep.trim();
    if (n === "" || inT(n)) continue;
    const slot = t.findIndex((x, i) => !cur.lists.T[i]?.f && !(OFF_LISTS.T.r1 + i in (OFF_LIST_FIXED.T ?? {})) && x.v === "");
    if (slot >= 0) {
      t[slot].v = n;
      addedToT.push(n);
    } else skipped.push(`T (ไม่มีช่องว่างสำหรับ ${n})`);
  }
  lists.T = t;
  for (const [k, d] of Object.entries(OFF_LISTS) as [OffListKey, (typeof OFF_LISTS)[OffListKey]][]) {
    (lists[k] ?? []).forEach((x, i) => {
      const c = cur.lists[k][i];
      if (!c || x.v.trim() === c.v) return;
      if (c.f) skipped.push(`${d.col}${d.r1 + i}`);
      else put(d.col, d.r1 + i, x.v.trim());
    });
  }
  return { writes, addedToT, skipped };
}
