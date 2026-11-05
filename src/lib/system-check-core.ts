// ตรวจทั้งระบบ (6 ตาราง: 6.00-8.30 / 8.30-12.30 / 12.30-16.30 / Key / SMC / OT) เฉพาะเดือนเดียว
// ส่วนนี้เป็นตรรกะล้วน (ไม่อ่านชีต) — ตัวโหลดข้อมูลอยู่ที่ system-check.ts
//
// ข้อผิดพลาด (error) = ต้องแก้: ตรงกับที่ชีตเองทำเครื่องหมายเป็นปัญหา
//   - ชื่อซ้ำในแถว/ช่วงเวลาเดียวกัน (3 ช่วงเวลา · Key · SMC) — กฎเดียวกับที่ไฮไลต์ในตาราง
//   - คนลายังไม่มีคนแทน (3 ช่วงเวลา/OT: "⚠ ชื่อ ลา" · Key: "ลา" เกินจำนวนคนในช่อง จนท.แทน)
//   - Key: ตำแหน่งประจำว่างในวันทำการ
//   - SMC: ชื่อที่ลาวันนั้นยังอยู่ในตาราง (สีส้มขีดฆ่า)
// คำเตือน (warn) = ตรวจดูแล้วปล่อยผ่านได้ถ้าถูกต้อง
//   - OT: ชื่อซ้ำในแถว (OT ให้ควบ 2 จุดได้)
//   - คนเดียวกันอยู่หลายตารางในเวลาที่ทับกัน (เช่น 6.00-8.30 กับ Key)
//   - มีบันทึกการลา (หน้า ลา-แลกเวร ของชีตใดก็ได้) แต่ยังมีชื่อในตารางอื่นวันนั้น
//   - มีชื่อในวันหยุด · Key: ชื่อไม่อยู่ในรายชื่อ
import { colLetter } from "./shift3/engine";
import { cellPerson, duplicateCols } from "./shift3/conflicts";
import { pointLabel } from "./shift3/cross";
import { keyDupCols } from "./key/render";
import { onLeave, smcDupCols, SMC_BLOCKS, type SmcMonth, type SmcSettings } from "./smc/engine";
import { otDupCols, otPerson } from "./ot/conflicts";
import { KEY_COL_LABEL, KEY_WIN, OT_COL_LABEL, SHIFT3_WIN, SMC_COL_LABEL, otWin, overlap, smcWin, winText, type Win } from "./col-info";
import type { MonthResult, SectionNo } from "./shift3/types";
import type { KeyMonth, KeySettings } from "./key/engine";
import type { OtMonth } from "./ot/engine";

export type CheckTable = "s1" | "s2" | "s3" | "key" | "smc" | "ot";
export const CHECK_TABLES: CheckTable[] = ["s1", "s2", "s3", "key", "smc", "ot"];
export const CHECK_TABLE_TITLE: Record<CheckTable, string> = {
  s1: "6.00-8.30", s2: "8.30-12.30", s3: "12.30-16.30", key: "Key", smc: "SMC", ot: "OT",
};

export interface CheckPlace {
  table: CheckTable;
  /** key ของช่อง (data-k ในตาราง) */
  cell: string;
  /** ชื่อจุด */
  label: string;
}
export interface CheckIssue {
  level: "error" | "warn";
  /** ประเภท (ใช้จัดกลุ่ม) */
  kind: string;
  day: number;
  text: string;
  /** ช่องที่เกี่ยวข้อง (ตัวแรก = ตารางหลักของรายการนี้) */
  at: CheckPlace[];
}

export interface LeaveLike { date: string; name: string; type: string; replacement: string }

export interface CheckInput {
  shift3?: MonthResult;
  key?: { s: KeySettings; m: KeyMonth };
  smc?: { s: SmcSettings; m: SmcMonth };
  ot?: OtMonth;
  /** แถวการลาของแต่ละชีต (หน้า ลา-แลกเวร) */
  leaves?: { table: string; rows: LeaveLike[] }[];
}

const low = (s: string) => s.trim().toLowerCase();
/** ค่าที่ไม่ใช่ชื่อคน (ใส่ซ้ำได้) */
const GENERIC = new Set(["mt full-time", "part-time", "ลา", "-", "จนท.", "จนท", "chem", "molec", "ปิดจุด"]);
const isGeneric = (v: string) => GENERIC.has(low(v)) || low(v).startsWith("จนท");

interface Slot { place: CheckPlace; person: string; win: Win; day: number }

export function runChecks(inp: CheckInput, iso: (day: number) => string): CheckIssue[] {
  const out: CheckIssue[] = [];
  const slots: Slot[] = [];
  const add = (i: CheckIssue) => out.push(i);

  // ---------- 3 ช่วงเวลา ----------
  if (inp.shift3) {
    for (const sec of [1, 2, 3] as SectionNo[]) {
      const table = `s${sec}` as CheckTable;
      for (const row of inp.shift3.sections[sec - 1].rows) {
        if (row.date === null) continue;
        const place = (c: number): CheckPlace => ({ table, cell: `${sec}:${colLetter(c)}:${row.day}`, label: pointLabel(sec, c) || `ช่อง ${colLetter(c)}` });
        const dups = duplicateCols(row.cells);
        const byName = new Map<string, number[]>();
        for (const c of dups) {
          const p = cellPerson(row.cells[c])!;
          byName.set(low(p), [...(byName.get(low(p)) ?? []), c]);
        }
        for (const cols of byName.values())
          add({ level: "error", kind: "ชื่อซ้ำ", day: row.day, text: `“${cellPerson(row.cells[cols[0]])}” อยู่ ${cols.length} จุดในช่วงเวลาเดียวกัน`, at: cols.map(place) });
        for (let c = 1; c < row.cells.length; c++) {
          const v = row.cells[c] ?? "";
          if (v.includes("⚠")) add({ level: "error", kind: "ลายังไม่มีคนแทน", day: row.day, text: `${v.replace("⚠", "").trim()} — ยังไม่มีคนแทน (ใส่คนแทนที่หน้า ลา-แลกเวร หรือเลือกชื่อในช่องนี้)`, at: [place(c)] });
          const p = cellPerson(v);
          if (!p || isGeneric(p)) continue;
          if (row.workday === 0) add({ level: "warn", kind: "มีชื่อในวันหยุด", day: row.day, text: `“${p}” อยู่ในวันหยุด/วันที่ไม่ได้ทำงาน`, at: [place(c)] });
          slots.push({ place: place(c), person: p, win: SHIFT3_WIN[sec], day: row.day });
        }
      }
    }
  }

  // ---------- Key ----------
  if (inp.key) {
    const { s, m } = inp.key;
    const REQ = ["D", "E", "F", "G", "L", "M"], SUBS = ["H", "I", "N", "O"], NAMES = ["B", "C", "D", "E", "F", "H", "I", "J", "K", "L", "M", "N", "O"];
    const inList = (v: string, list: string[]) => list.some((x) => x !== "" && low(x) === low(v));
    for (const r of m.rows) {
      if (r.date === null) continue;
      const place = (c: string): CheckPlace => ({ table: "key", cell: `k:${c}:${r.day}`, label: KEY_COL_LABEL[c] ?? `ช่อง ${c}` });
      const dups = keyDupCols(r.cells);
      const byName = new Map<string, string[]>();
      for (const c of dups) byName.set(low(r.cells[c]), [...(byName.get(low(r.cells[c])) ?? []), c]);
      for (const cols of byName.values())
        add({ level: "error", kind: "ชื่อซ้ำ", day: r.day, text: `“${r.cells[cols[0]]}” อยู่ ${cols.length} จุดในวันเดียวกัน`, at: cols.map(place) });
      if (r.Q === 1) {
        const la = REQ.filter((c) => r.cells[c] === "ลา");
        const filled = SUBS.filter((c) => (r.cells[c] ?? "") !== "").length;
        if (la.length > filled)
          for (const c of la.slice(filled))
            add({ level: "error", kind: "ลายังไม่มีคนแทน", day: r.day, text: `ช่อง ${KEY_COL_LABEL[c]} เป็น “ลา” — ยังไม่มีผู้แทน (ใส่คนแทนที่หน้า ลา-แลกเวร หรือใส่คนในช่อง จนท.แทน)`, at: [place(c)] });
        for (const c of REQ) if ((r.cells[c] ?? "") === "") add({ level: "error", kind: "ตำแหน่งว่าง", day: r.day, text: `ตำแหน่ง ${KEY_COL_LABEL[c]} ว่างในวันทำการ`, at: [place(c)] });
      }
      for (const c of [...NAMES, "G"]) {
        const v = (r.cells[c] ?? "").trim();
        if (v === "" || isGeneric(v)) continue;
        if (r.Q === 0) add({ level: "warn", kind: "มีชื่อในวันหยุด", day: r.day, text: `“${v}” อยู่ในวันหยุด`, at: [place(c)] });
        else if (c === "G" ? !inList(v, s.heads) && !inList(v, s.dropdown) : !inList(v, s.dropdown))
          add({ level: "warn", kind: "ชื่อไม่อยู่ในรายชื่อ", day: r.day, text: `“${v}” ไม่อยู่ในรายชื่อของตาราง Key (ตั้งค่า)`, at: [place(c)] });
        slots.push({ place: place(c), person: v, win: KEY_WIN, day: r.day });
      }
    }
  }

  // ---------- SMC ----------
  if (inp.smc) {
    const { s, m } = inp.smc;
    for (const r of m.rows) {
      if (r.date === null) continue;
      const place = (c: string): CheckPlace => ({ table: "smc", cell: `m:${c}:${r.day}`, label: SMC_COL_LABEL[c] ?? `ช่อง ${c}` });
      const dups = smcDupCols(s, r.cells);
      for (const block of SMC_BLOCKS) {
        const byName = new Map<string, string[]>();
        for (const c of block) if (dups.has(c)) byName.set(low(r.cells[c]), [...(byName.get(low(r.cells[c])) ?? []), c]);
        for (const cols of byName.values())
          add({ level: "error", kind: "ชื่อซ้ำ", day: r.day, text: `“${r.cells[cols[0]]}” อยู่ ${cols.length} จุดในช่วงเวลาเดียวกัน`, at: cols.map(place) });
      }
      for (const block of SMC_BLOCKS)
        for (const c of block) {
          const v = (r.cells[c] ?? "").trim();
          if (v === "" || isGeneric(v) || low(v) === low(s.mt) || low(v) === low(s.pt)) continue;
          if (onLeave(s, v, r.date)) add({ level: "error", kind: "คนลายังอยู่ในตาราง", day: r.day, text: `“${v}” ลาวันนี้ แต่ยังอยู่ในตาราง (ใส่คนแทนที่หน้า ลา-แลกเวร หรือเปลี่ยนชื่อในช่องนี้)`, at: [place(c)] });
          if (r.V === 0) add({ level: "warn", kind: "มีชื่อในวันหยุด", day: r.day, text: `“${v}” อยู่ในวันหยุด`, at: [place(c)] });
          slots.push({ place: place(c), person: v, win: smcWin(c), day: r.day });
        }
    }
  }

  // ---------- OT ----------
  if (inp.ot) {
    for (const r of inp.ot.rows) {
      if (r.date === null) continue;
      const place = (c: string): CheckPlace => ({ table: "ot", cell: `o:${c}:${r.day}`, label: OT_COL_LABEL[c] ?? `ช่อง ${c}` });
      const dups = otDupCols(r.cells);
      const byName = new Map<string, string[]>();
      for (const c of dups) {
        const p = otPerson(r.cells[c] ?? "")!;
        byName.set(low(p), [...(byName.get(low(p)) ?? []), c]);
      }
      for (const cols of byName.values())
        add({ level: "warn", kind: "ชื่อซ้ำ (OT ควบได้)", day: r.day, text: `“${otPerson(r.cells[cols[0]])}” อยู่ ${cols.length} จุด — OT ควบ 2 จุดได้ ตรวจว่าถูกต้อง`, at: cols.map(place) });
      for (const c of Object.keys(r.cells)) {
        const v = r.cells[c] ?? "";
        if (c === "O") continue;
        if (v.includes("⚠")) add({ level: "error", kind: "ลายังไม่มีคนแทน", day: r.day, text: `${v.replace("⚠", "").trim()} — ยังไม่มีคนแทน (ใส่คนแทนที่หน้า ลา-แลกเวร หรือเลือกชื่อในช่องนี้)`, at: [place(c)] });
        const p = otPerson(v);
        const w = otWin(c);
        if (!p || isGeneric(p) || !w) continue;
        if (r.P === 0) add({ level: "warn", kind: "มีชื่อในวันหยุด", day: r.day, text: `“${p}” อยู่ในวันหยุด`, at: [place(c)] });
        slots.push({ place: place(c), person: p, win: w, day: r.day });
      }
    }
  }

  // ---------- คนเดียวกันหลายตาราง เวลาทับกัน ----------
  const byPersonDay = new Map<string, Slot[]>();
  for (const sl of slots) {
    const k = `${sl.day}|${low(sl.person)}`;
    byPersonDay.set(k, [...(byPersonDay.get(k) ?? []), sl]);
  }
  for (const list of byPersonDay.values()) {
    if (new Set(list.map((x) => x.place.table)).size < 2) continue;
    const seen = new Set<string>();
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.place.table === b.place.table || !overlap(a.win, b.win)) continue;
        const pair = [a.place.table, b.place.table].sort().join("|");
        if (seen.has(pair)) continue;
        seen.add(pair);
        add({
          level: "warn",
          kind: "อยู่หลายตารางเวลาทับกัน",
          day: a.day,
          text: `“${a.person}” อยู่ตาราง ${CHECK_TABLE_TITLE[a.place.table]} (${winText(a.win)}) และ ${CHECK_TABLE_TITLE[b.place.table]} (${winText(b.win)}) — เวลาทับกัน`,
          at: [a.place, b.place],
        });
      }
  }

  // ---------- มีบันทึกการลา แต่ยังมีชื่อในตาราง ----------
  const leaveBy = new Map<string, { table: string; type: string }[]>();
  for (const src of inp.leaves ?? [])
    for (const r of src.rows) {
      if (!r.date || !r.name.trim() || r.type.includes("แลก")) continue; // แลกเวร = สลับจุด ไม่ใช่หยุดงานทั้งวัน
      const k = `${r.date}|${low(r.name)}`;
      leaveBy.set(k, [...(leaveBy.get(k) ?? []), { table: src.table, type: r.type }]);
    }
  const reported = new Set<string>();
  for (const sl of slots) {
    const lv = leaveBy.get(`${iso(sl.day)}|${low(sl.person)}`);
    if (!lv) continue;
    if (sl.place.table === "smc" && lv.some((x) => x.table === "smc")) continue; // รายงานเป็นข้อผิดพลาดของ SMC แล้ว
    const k = `${sl.day}|${low(sl.person)}|${sl.place.table}|${sl.place.cell}`;
    if (reported.has(k)) continue;
    reported.add(k);
    const from = Array.from(new Set(lv.map((x) => `${LEAVE_SHEET_TITLE[x.table] ?? x.table}${x.type ? ` (${x.type})` : ""}`))).join(", ");
    add({ level: "warn", kind: "มีบันทึกลาแต่ยังมีชื่อ", day: sl.day, text: `“${sl.person}” มีบันทึกลาวันนี้ ที่หน้า ลา-แลกเวร ของ ${from} แต่ยังมีชื่อในตาราง ${CHECK_TABLE_TITLE[sl.place.table]}`, at: [sl.place] });
  }

  const order = (i: CheckIssue) => (i.level === "error" ? 0 : 1) * 1e6 + CHECK_TABLES.indexOf(i.at[0].table) * 1e3 + i.day;
  return out.sort((a, b) => order(a) - order(b));
}

export const LEAVE_SHEET_TITLE: Record<string, string> = { shift3: "ตาราง 3 ช่วงเวลา", key: "ตาราง Key", smc: "ตาราง SMC", ot: "ตาราง OT" };
