import { isoFromSerial } from "@/lib/sheets-date";
import { loadOt } from "@/lib/ot/repo";
import OtLeavesClient from "@/components/OtLeavesClient";

export const dynamic = "force-dynamic";

export default async function OtLeavesPage() {
  const d = await loadOt();
  const rows = d.leaves.map((l) => ({ date: l.date === null ? "" : isoFromSerial(l.date), who: l.who, sub: l.sub, type: l.type }));
  // รายชื่อพนักงาน + ผู้มาแทน + รายชื่อ dropdown (ตั้งค่า O10:O55)
  const names = Array.from(new Set([...d.settings.staff.flatMap((s) => [s.name, s.rep]), ...d.settings.dropdown].filter((n) => n.trim() !== "")));
  return <OtLeavesClient initial={rows} settings={d.settings} names={names} />;
}
