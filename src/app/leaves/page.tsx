import { currentYm } from "@/lib/current-ym";
import { loadShift3, monthWindow } from "@/lib/shift3/repo";
import { syncAllLeaves } from "@/lib/leave-sync";
import { dropdownNames } from "@/lib/shift3/parse";
import { isoFromSerial } from "@/lib/sheets-date";
import LeavesClient from "@/components/LeavesClient";

export const dynamic = "force-dynamic";

export default async function LeavesPage({ searchParams }: { searchParams: { ym?: string } }) {
  // เดือนที่กำลังจัดทำ: ?ym= → เดือนที่เปิดล่าสุดในตารางเวร (cookie) → เดือนปัจจุบัน
  const ym = currentYm(searchParams.ym);
  // ดึงการลาที่ Approve แล้วจากระบบลา เฉพาะเดือนนี้ ก่อนแสดงหน้า
  const syncAll = await syncAllLeaves(ym, true); // ดึงครั้งเดียวเข้าครบทั้ง 4 ชีต
  const sync = syncAll.shift3;
  const data = await loadShift3();
  // แสดงเฉพาะแถวของเดือนนี้ (เดือนอื่นยังอยู่ในชีตครบ ไม่ถูกแตะ)
  const w = monthWindow(ym)!;
  const rows = data.leaves.filter((l) => l.date !== null && l.date >= w.start && l.date <= w.end).map((l) => ({
    date: l.date === null ? "" : isoFromSerial(l.date),
    name: l.name,
    replacement: l.replacement,
    type: l.type,
    note: l.note,
    ref: l.ref ?? "",
  }));
  const staff = [...data.settings.persons.map((p) => p.name), data.settings.pairOddKw8, data.settings.pairOddOpd11].filter((n) => n);
  return <LeavesClient initial={rows} settings={data.settings} staff={staff} allNames={dropdownNames(data.settings, data.mtrn)} sync={sync} syncAll={syncAll} ym={ym} />;
}
