// แท็บ "ลา-แลกเวร" รูปแบบเดียวกันทั้ง 4 ชีต (3 ช่วงเวลา / Key / SMC / OT)
//   A วันที่ · B ชื่อคนลา · C ชื่อคนมาแทน · D ประเภท · E-F สูตรอัตโนมัติ (เว็บไม่เขียนทับ) · G หมายเหตุ · H รหัสจากระบบลา
//   1 แถวต่อ 1 คน 1 วัน · แถว 5..5004 (สูตรในแท็บเดือนอ่าน A5:A5004)
import "server-only";
import { batchGet, batchUpdate } from "./google";
import { parseYm, ymString } from "./config";
import { isoFromSerial, serialFromYMD, toSerial } from "./sheets-date";
import { invalidateApprovedLeaves, readApprovedLeaves } from "./leave-system";
import { assertLeaveRows } from "./leave-rules";

export const LEAVE_TAB = "ลา-แลกเวร";
export const LEAVE_ROWS = 5000;
export const LEAVE_TAB_RANGE = `'${LEAVE_TAB}'!A5:H${LEAVE_ROWS + 4}`;

export interface LeaveForm {
  date: string; // yyyy-mm-dd ("" = ยังไม่กรอก)
  name: string;
  replacement: string;
  type: string;
  note: string;
  /** รหัสจากระบบลา (`LeaveID|yyyy-mm-dd`) — ว่าง = กรอกเอง */
  ref?: string;
}

export interface LeaveSyncResult {
  added: number;
  removed: number;
  at: string;
  /** เดือนที่ดึง (ปี พ.ศ.-เดือน) */
  ym: string;
  error?: string;
  /** ชื่อในระบบลาที่จับคู่กับพนักงานในตารางนี้ไม่ได้ (ไม่ได้ดึงมา) */
  skippedNames: string[];
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** แถวจากช่วง A5:H (ค่าดิบ) → ฟอร์ม · ตัดแถวว่าง */
export function parseLeaveTab(g: unknown[][]): LeaveForm[] {
  return g
    .map((r) => {
      const d = toSerial(r?.[0]);
      return {
        date: d === null ? str(r?.[0]).trim() : isoFromSerial(d),
        name: str(r?.[1]).trim(),
        replacement: str(r?.[2]).trim(),
        type: str(r?.[3]).trim(),
        note: str(r?.[6]),
        ref: str(r?.[7]),
      };
    })
    .filter((l) => l.date !== "" || l.name !== "" || l.replacement !== "");
}

export async function readLeaveTab(sheetId: string): Promise<LeaveForm[]> {
  const [g] = await batchGet(sheetId, [LEAVE_TAB_RANGE]);
  return parseLeaveTab(g);
}

function checkDate(v: string, label: string): string {
  if (v === "") return "";
  if (toSerial(v) === null) throw new Error(`${label}: วันที่ไม่ถูกต้อง (${v})`);
  return v;
}

/** เขียนทั้งตาราง (A:D และ G:H) — ช่อง E:F เป็นสูตร ไม่เขียนทับ */
export async function writeLeaveTab(sheetId: string, rows: LeaveForm[]): Promise<void> {
  if (rows.length > LEAVE_ROWS) throw new Error(`บันทึกได้สูงสุด ${LEAVE_ROWS} แถว (A5:A${LEAVE_ROWS + 4})`);
  const pad = <T,>(arr: T[], empty: T) => Array.from({ length: LEAVE_ROWS }, (_, i) => arr[i] ?? empty);
  const ad = pad(
    rows.map((r, i) => [checkDate(r.date, `A${5 + i}`), r.name, r.replacement, r.type]),
    ["", "", "", ""],
  );
  const g = pad(rows.map((r) => [r.note, r.ref ?? ""]), ["", ""]);
  await batchUpdate(sheetId, [
    { range: `'${LEAVE_TAB}'!A5:D${LEAVE_ROWS + 4}`, values: ad },
    { range: `'${LEAVE_TAB}'!G5:H${LEAVE_ROWS + 4}`, values: g },
  ]);
}

/** ช่วงวันที่ของเดือน (ym = ปี พ.ศ.-เดือน) เป็น serial */
export function monthWindow(ym: string): { start: number; end: number } | null {
  const p = parseYm(ym);
  if (!p) return null;
  return { start: serialFromYMD(p.yearBE - 543, p.month, 1), end: serialFromYMD(p.yearBE - 543, p.month + 1, 0) };
}

/** เดือนที่กำลังจัดทำ: ym ที่ส่งมา (ถ้าถูกต้อง) หรือเดือนปัจจุบันตามเวลาไทย */
export function resolveYm(ym?: string | null): string {
  if (ym && parseYm(ym)) return ym;
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return ymString(now.getUTCFullYear() + 543, now.getUTCMonth() + 1);
}

const inMonth = (r: LeaveForm, w: { start: number; end: number }) => {
  const d = toSerial(r.date);
  return d !== null && d >= w.start && d <= w.end;
};

/** แถวของเดือนนั้น (เรียงตามวันที่) */
export function rowsOfMonth(rows: LeaveForm[], ym: string): LeaveForm[] {
  const w = monthWindow(ym);
  return w ? rows.filter((r) => inMonth(r, w)) : [];
}

const byDate = (a: LeaveForm, b: LeaveForm) => (toSerial(a.date) ?? 9e9) - (toSerial(b.date) ?? 9e9) || a.name.localeCompare(b.name);

/**
 * บันทึกเฉพาะเดือนเดียว: แทนที่เฉพาะแถวที่วันที่อยู่ในเดือนนั้น
 * แถวของเดือนอื่น (ประวัติ) คงไว้ตามเดิมทุกแถว · เรียงทั้งตารางตามวันที่
 */
export async function saveLeaveTabMonth(sheetId: string, ym: string, rows: LeaveForm[], current?: LeaveForm[]): Promise<void> {
  const w = monthWindow(ym);
  if (!w) throw new Error(`เดือนไม่ถูกต้อง: ${ym}`);
  const cur = current ?? (await readLeaveTab(sheetId));
  const others = cur.filter((r) => !inMonth(r, w));
  const mine = rows.filter((r) => r.date !== "" || r.name !== "" || r.replacement !== "");
  // ห้ามคนมาแทนเป็นคนลาเอง / คนที่ลาวันเดียวกัน (ตรวจรวมแถวเดือนอื่นด้วย กันกรณีวันที่หลุดเดือน)
  assertLeaveRows([...others, ...mine].map((r, i) => (i < others.length ? { ...r, replacement: "" } : r)));
  await writeLeaveTab(sheetId, [...others, ...mine].sort(byDate));
}

// ---------- ดึงการลาจากระบบลา (Approve แล้ว) ----------

const syncState = new Map<string, { at: number; result: LeaveSyncResult }>();
const syncing = new Map<string, Promise<LeaveSyncResult>>();

export interface SyncOptions {
  /** ชื่อตาราง (ใช้แยกแคช) */
  table: string;
  sheetId: string;
  ym?: string;
  force?: boolean;
  /** รายชื่อพนักงานของตารางนี้ (จับคู่กับชื่อหน้าในระบบลา) */
  staff: string[];
  /** วันหยุด (serial) — ไม่สร้างแถวในวันหยุด */
  holidays: number[];
  /** อ่านชีตระบบลาใหม่ (ไม่ใช้ผลที่จำไว้) — ค่าเริ่มต้น = force · ดึงทั้ง 4 ชีตจะล้างครั้งเดียวแล้วส่ง false */
  freshRead?: boolean;
  /** แถวปัจจุบันในแท็บ (ถ้ามีอยู่แล้ว ไม่ต้องอ่านซ้ำ) */
  current?: LeaveForm[];
}

/**
 * เทียบรายการลาที่ Approve (ลาป่วย/ลากิจ/ลาพักร้อน/ลาอื่นๆ) กับแถวในแท็บ ลา-แลกเวร ของชีตนั้น
 *  - 1 แถวต่อ 1 คน 1 วันทำการ (ข้ามเสาร์-อาทิตย์และวันหยุด) เฉพาะเดือนที่กำลังจัดทำ
 *  - ใส่ วันที่ / ชื่อ / ประเภท / รหัส (H) · คนแทน และหมายเหตุ เว้นว่างให้ผู้จัดกรอกเอง
 *  - ถ้าการลาถูกยกเลิกภายหลัง แถวที่ดึงมาของเดือนนั้นจะถูกนำออก · แถวเดือนอื่นไม่ถูกแตะ
 */
export async function syncLeaveTab(o: SyncOptions): Promise<LeaveSyncResult> {
  const ym = resolveYm(o.ym);
  const key = `${o.table}|${ym}`;
  const last = syncState.get(key);
  if (!o.force && last && Date.now() - last.at < 60_000) return last.result;
  const running = syncing.get(key);
  if (running) return running;
  if (o.freshRead ?? o.force) invalidateApprovedLeaves();
  const job = (async () => {
    const at = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16);
    let result: LeaveSyncResult;
    try {
      const w = monthWindow(ym)!;
      const staff = Array.from(new Set(o.staff.map((x) => x.trim()).filter((x) => x !== "")));
      const holidays = new Set(o.holidays);
      const sys = await readApprovedLeaves();
      const skipped = new Set<string>();
      const want = new Map<string, LeaveForm>();
      for (const l of sys) {
        if (l.end < w.start || l.start > w.end) continue;
        const name = staff.find((n) => n.toLowerCase() === l.firstName.toLowerCase());
        if (!name) {
          skipped.add(l.fullName);
          continue;
        }
        for (let d = Math.max(l.start, w.start); d <= Math.min(l.end, w.end); d++) {
          const wd = new Date((d - 25569) * 86400000).getUTCDay();
          if (wd === 0 || wd === 6 || holidays.has(d)) continue;
          const ref = `${l.leaveId}|${isoFromSerial(d)}`;
          want.set(ref, { date: isoFromSerial(d), name, replacement: "", type: l.type, note: "", ref });
        }
      }
      const cur = o.current ?? (await readLeaveTab(o.sheetId));
      const seen = new Set<string>();
      let removed = 0;
      const keep = cur.filter((r) => {
        if (!r.ref) return true;
        if (seen.has(r.ref)) return (removed++, false); // แถวซ้ำ
        seen.add(r.ref);
        if (want.has(r.ref) || !inMonth(r, w)) return true; // นอกเดือนนี้ ไม่แตะ
        removed++;
        return false;
      });
      const add = Array.from(want.values()).filter((r) => !seen.has(r.ref!)).sort(byDate);
      if (add.length > 0 || removed > 0) await writeLeaveTab(o.sheetId, [...keep, ...add].sort(byDate));
      result = { added: add.length, removed, at, ym, skippedNames: Array.from(skipped) };
    } catch (e) {
      const msg = (e as Error).message;
      const error = /\b(403|404)\b|PERMISSION|not found/i.test(msg)
        ? "อ่านชีตระบบลาไม่ได้ — ต้องแชร์ชีตระบบลาให้บัญชีของเว็บ (assignshifts@assignshifts.iam.gserviceaccount.com) สิทธิ์ผู้อ่าน"
        : `ดึงข้อมูลระบบลาไม่สำเร็จ: ${msg.slice(0, 200)}`;
      result = { added: 0, removed: 0, at, ym, error, skippedNames: [] };
    }
    syncState.set(key, { at: Date.now(), result });
    return result;
  })();
  syncing.set(key, job);
  try {
    return await job;
  } finally {
    syncing.delete(key);
  }
}
