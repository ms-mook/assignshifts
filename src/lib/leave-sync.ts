// ตั้งค่าการลาของแต่ละชีต (ทั้ง 4 ชีตใช้แท็บ ลา-แลกเวร รูปแบบเดียวกัน) + ดึงการลาจากระบบลา
import "server-only";
import { SHEETS } from "./config";
import { invalidateApprovedLeaves } from "./leave-system";
import { readLeaveTab, rowsOfMonth, syncLeaveTab, type LeaveForm, type LeaveSyncResult } from "./leave-tab";
import { loadKey } from "./key/repo";
import { loadSmc } from "./smc/repo";
import { loadOt } from "./ot/repo";
import { syncLeaveSystem } from "./shift3/repo";

export type LeaveTable = "shift3" | "key" | "smc" | "ot";
export const LEAVE_TABLES: LeaveTable[] = ["shift3", "key", "smc", "ot"];
export const isLeaveTable = (t: string): t is LeaveTable => (LEAVE_TABLES as string[]).includes(t);

export const LEAVE_TABLE_TITLE: Record<LeaveTable, string> = {
  shift3: "ตาราง 3 ช่วงเวลา",
  key: "ตาราง Key",
  smc: "ตาราง SMC",
  ot: "ตาราง OT",
};

export function leaveSheetId(t: LeaveTable): string {
  return t === "shift3" ? SHEETS.shift3 : t === "key" ? SHEETS.key : t === "smc" ? SHEETS.smc : SHEETS.ot;
}

const uniq = (a: string[]) => Array.from(new Set(a.map((x) => x.trim()).filter((x) => x !== "")));

/**
 * รายชื่อที่จับคู่กับระบบลา (staff) และรายชื่อให้เลือกในหน้า (names) ของแต่ละชีต
 *  - Key: 4 คนในสายหมุนเวียน + Key4 (SMC) + หัวหน้าเวร (ชื่อกลุ่ม dropdown ไม่ดึง เพราะช่องหมายเหตุจะขึ้นทุกการลา)
 *  - SMC: ชื่อประจำจุด + รายชื่อ dropdown ทุกช่วงเวลา (การลาทำให้ชื่อหายจาก dropdown วันนั้น)
 *  - OT: พนักงาน 8 คน + ผู้มาแทน + รายชื่อ dropdown
 */
export async function leaveContext(t: Exclude<LeaveTable, "shift3">): Promise<{ staff: string[]; names: string[]; holidays: number[] }> {
  if (t === "key") {
    const s = await loadKey();
    const staff = uniq([...s.rot, s.key4Name, s.head, ...s.heads]);
    return { staff, names: uniq([...staff, ...s.dropdown]), holidays: s.holidays.map((h) => h.date) };
  }
  if (t === "smc") {
    const s = await loadSmc();
    const staff = uniq([s.q0700, s.q0830, s.q1230, s.key0700, s.key0830, ...s.listJ, ...s.listL, ...s.listN, ...s.listP, ...s.listT]);
    return { staff, names: staff, holidays: s.holidays.map((h) => h.date) };
  }
  const d = await loadOt();
  const staff = uniq([...d.settings.staff.flatMap((x) => [x.name, x.rep]), ...d.settings.dropdown]);
  return { staff, names: staff, holidays: d.settings.holidays.map((h) => h.date) };
}

/** ดึงการลาที่ Approve ของเดือนนั้นเข้าแท็บ ลา-แลกเวร ของชีตนั้น (ไม่ force = ดึงซ้ำไม่เกินนาทีละครั้ง) */
export async function syncLeaves(t: LeaveTable, ym: string | undefined, force = false, freshRead = force): Promise<LeaveSyncResult> {
  if (t === "shift3") return syncLeaveSystem({ ym, force, freshRead });
  try {
    const ctx = await leaveContext(t);
    return await syncLeaveTab({ table: t, sheetId: leaveSheetId(t), ym, force, freshRead, staff: ctx.staff, holidays: ctx.holidays });
  } catch (e) {
    return { added: 0, removed: 0, at: "", ym: ym ?? "", error: (e as Error).message, skippedNames: [] };
  }
}

/**
 * ดึงการลาของเดือนนั้นเข้าแท็บ ลา-แลกเวร ครบทั้ง 4 ชีตในครั้งเดียว (อ่านชีตระบบลาครั้งเดียว)
 * แต่ละชีตรับเฉพาะพนักงานของตารางตัวเอง · ชีตไหนผิดพลาดไม่กระทบชีตอื่น
 */
export async function syncAllLeaves(ym: string | undefined, force = false): Promise<Record<LeaveTable, LeaveSyncResult>> {
  if (force) invalidateApprovedLeaves(); // กดดึงข้อมูลล่าสุด → อ่านระบบลาใหม่ 1 ครั้ง ใช้ร่วมกันทั้ง 4 ชีต
  const res = await Promise.all(LEAVE_TABLES.map((t) => syncLeaves(t, ym, force, false)));
  return Object.fromEntries(LEAVE_TABLES.map((t, i) => [t, res[i]])) as Record<LeaveTable, LeaveSyncResult>;
}

export async function readLeaves(t: LeaveTable): Promise<LeaveForm[]> {
  return readLeaveTab(leaveSheetId(t));
}

/** ข้อมูลหน้า ลา-แลกเวร ของ Key / SMC / OT: ดึงจากระบบลาของเดือนนั้นก่อน แล้วอ่านแถวของเดือนนั้น */
export async function loadLeavePage(t: Exclude<LeaveTable, "shift3">, ym: string) {
  const syncAll = await syncAllLeaves(ym, true);
  const [all, ctx] = await Promise.all([readLeaves(t), leaveContext(t)]);
  return { sync: syncAll[t], syncAll, rows: rowsOfMonth(all, ym), names: ctx.names };
}
