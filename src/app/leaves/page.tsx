import { loadShift3, syncLeaveSystem } from "@/lib/shift3/repo";
import { dropdownNames } from "@/lib/shift3/parse";
import { isoFromSerial } from "@/lib/sheets-date";
import LeavesClient from "@/components/LeavesClient";

export const dynamic = "force-dynamic";

export default async function LeavesPage() {
  // ดึงการลาที่ Approve แล้วจากระบบลาก่อนแสดงหน้า
  const sync = await syncLeaveSystem({ force: true });
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
  return <LeavesClient initial={rows} settings={data.settings} staff={staff} allNames={dropdownNames(data.settings, data.mtrn)} sync={sync} />;
}
