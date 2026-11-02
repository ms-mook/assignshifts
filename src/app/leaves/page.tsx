import { cookies } from "next/headers";
import { parseYm, ymString } from "@/lib/config";
import { loadShift3, syncLeaveSystem } from "@/lib/shift3/repo";
import { dropdownNames } from "@/lib/shift3/parse";
import { isoFromSerial } from "@/lib/sheets-date";
import LeavesClient from "@/components/LeavesClient";

export const dynamic = "force-dynamic";

export default async function LeavesPage({ searchParams }: { searchParams: { ym?: string } }) {
  // เดือนที่กำลังจัดทำ: ?ym= → เดือนที่เปิดล่าสุดในตารางเวร (cookie) → เดือนปัจจุบัน
  const nowTH = new Date(Date.now() + 7 * 3600 * 1000);
  const pick = [searchParams.ym, cookies().get("shift-ym")?.value].find((v) => v && parseYm(v));
  const pm = (pick && parseYm(pick)) || { yearBE: nowTH.getUTCFullYear() + 543, month: nowTH.getUTCMonth() + 1 };
  const ym = ymString(pm.yearBE, pm.month);
  // ดึงการลาที่ Approve แล้วจากระบบลา เฉพาะเดือนนี้ ก่อนแสดงหน้า
  const sync = await syncLeaveSystem({ force: true, ym });
  const data = await loadShift3();
  const rows = data.leaves.map((l) => ({
    date: l.date === null ? "" : isoFromSerial(l.date),
    name: l.name,
    replacement: l.replacement,
    type: l.type,
    note: l.note,
    ref: l.ref ?? "",
  }));
  const staff = [...data.settings.persons.map((p) => p.name), data.settings.pairOddKw8, data.settings.pairOddOpd11].filter((n) => n);
  return <LeavesClient initial={rows} settings={data.settings} staff={staff} allNames={dropdownNames(data.settings, data.mtrn)} sync={sync} ym={ym} />;
}
