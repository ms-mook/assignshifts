// อ่านการลาจากระบบลา (ชีต Leave) — อ่านอย่างเดียว ไม่เขียนกลับ
import "server-only";
import { batchGet } from "./google";
import { SHEETS } from "./config";
import { serialFromYMD, toSerial, ymdFromSerial } from "./sheets-date";

export interface SystemLeave {
  leaveId: string;
  fullName: string;
  firstName: string;
  type: string;
  start: number;
  end: number;
}

/** ประเภทที่ดึงมา (งดเวรนอกเวลา ไม่ดึง) */
const TYPES = ["ลาป่วย", "ลากิจ", "ลาพักร้อน", "ลาอื่น"];
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** คอลัมน์: B ชื่อ-นามสกุล · D ประเภทการลา · E เริ่มต้น · F สิ้นสุด · H สถานะ · I LeaveID */
let memo: { at: number; p: Promise<SystemLeave[]> } | null = null;

/** ล้างผลที่จำไว้ (กดดึงข้อมูลล่าสุด = อ่านใหม่จริง) */
export function invalidateApprovedLeaves() {
  memo = null;
}

/** อ่านครั้งเดียวใช้ได้ทั้ง 4 ชีต (จำผลไว้ 15 วินาที) */
export function readApprovedLeaves(): Promise<SystemLeave[]> {
  if (memo && Date.now() - memo.at < 15_000) return memo.p;
  const p = readApprovedLeavesNow();
  memo = { at: Date.now(), p };
  p.catch(() => (memo = null));
  return p;
}

async function readApprovedLeavesNow(): Promise<SystemLeave[]> {
  const [g] = await batchGet(SHEETS.leaveSystem, ["'Leave'!A2:M10000"]);
  const out: SystemLeave[] = [];
  for (const r of g) {
    const status = str(r[7]).toLowerCase();
    if (status !== "approve" && status !== "approved") continue;
    const type = str(r[3]);
    if (!TYPES.some((t) => type.replace(/\s/g, "").startsWith(t))) continue;
    const fullName = str(r[1]).replace(/\s+/g, " ");
    const firstName = fullName.split(" ")[0] ?? "";
    let start = toSerial(r[4]);
    let end = toSerial(r[5]) ?? start;
    if (start === null || end === null || firstName === "") continue;
    // ปี พ.ศ. ที่หลุดมา → ค.ศ.
    const ce = (n: number) => {
      const d = ymdFromSerial(n);
      return d.y > 2400 ? serialFromYMD(d.y - 543, d.m, d.d) : n;
    };
    start = ce(start);
    end = ce(end);
    if (end < start) [start, end] = [end, start];
    out.push({ leaveId: str(r[8]) || `${fullName}|${start}|${type}`, fullName, firstName, type, start, end });
  }
  return out;
}
