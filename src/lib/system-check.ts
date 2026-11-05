// ตรวจทั้งระบบ: โหลดข้อมูลเดือนเดียวของทั้ง 4 ชีต (6 ตาราง) แล้วตรวจด้วย system-check-core
import "server-only";
import { parseYm } from "./config";
import { isoFromSerial, serialFromYMD } from "./sheets-date";
import { computeMonth } from "./shift3/engine";
import { loadMonthState, loadShift3 } from "./shift3/repo";
import { computeKeyMonth } from "./key/engine";
import { loadKey, loadKeyMonthState } from "./key/repo";
import { computeSmcMonth } from "./smc/engine";
import { loadSmc, loadSmcMonthState } from "./smc/repo";
import { computeOtMonth } from "./ot/engine";
import { loadOt, loadOtMonthState } from "./ot/repo";
import { LEAVE_TABLES, readLeaves } from "./leave-sync";
import { CHECK_TABLE_TITLE, runChecks, type CheckInput, type CheckIssue, type CheckTable } from "./system-check-core";

export interface CheckResult {
  ym: string;
  /** เวลาที่ตรวจ (HH:MM ตามเวลาไทย) */
  at: string;
  issues: CheckIssue[];
  errors: number;
  warns: number;
  /** ตารางที่โหลด/ตรวจไม่ได้ */
  failed: { table: string; error: string }[];
}

export async function checkMonth(ym: string): Promise<CheckResult> {
  const p = parseYm(ym);
  if (!p) throw new Error(`เดือนไม่ถูกต้อง: ${ym}`);
  const { yearBE: Y, month: M } = p;
  const failed: { table: string; error: string }[] = [];
  const inp: CheckInput = { leaves: [] };
  const msg = (e: unknown) => (e as Error).message.slice(0, 200);
  await Promise.all([
    (async () => {
      try {
        const d = await loadShift3();
        const st = await loadMonthState(d, Y, M);
        inp.shift3 = computeMonth(d.settings, d.leaves, st.manual, Y, M);
      } catch (e) {
        failed.push({ table: "6.00-8.30 / 8.30-12.30 / 12.30-16.30", error: msg(e) });
      }
    })(),
    (async () => {
      try {
        const s = await loadKey();
        const st = await loadKeyMonthState(s, Y, M);
        inp.key = { s, m: computeKeyMonth(s, st.manual, Y, M) };
      } catch (e) {
        failed.push({ table: CHECK_TABLE_TITLE.key, error: msg(e) });
      }
    })(),
    (async () => {
      try {
        const s = await loadSmc();
        const st = await loadSmcMonthState(s, Y, M);
        inp.smc = { s, m: computeSmcMonth(s, st.manual, Y, M) };
      } catch (e) {
        failed.push({ table: CHECK_TABLE_TITLE.smc, error: msg(e) });
      }
    })(),
    (async () => {
      try {
        const d = await loadOt();
        const st = await loadOtMonthState(d, Y, M);
        inp.ot = computeOtMonth(d.settings, d.leaves, st.manual, Y, M);
      } catch (e) {
        failed.push({ table: CHECK_TABLE_TITLE.ot, error: msg(e) });
      }
    })(),
    ...LEAVE_TABLES.map(async (t) => {
      try {
        inp.leaves!.push({ table: t, rows: await readLeaves(t) });
      } catch {
        /* อ่านหน้า ลา-แลกเวร ไม่ได้ → ข้ามการตรวจ "มีบันทึกลาแต่ยังมีชื่อ" ของชีตนั้น */
      }
    }),
  ]);
  const iso = (day: number) => isoFromSerial(serialFromYMD(Y - 543, M, day));
  const issues = runChecks(inp, iso);
  const at = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16);
  return { ym, at, issues, errors: issues.filter((i) => i.level === "error").length, warns: issues.filter((i) => i.level === "warn").length, failed };
}

export type { CheckIssue, CheckTable };
