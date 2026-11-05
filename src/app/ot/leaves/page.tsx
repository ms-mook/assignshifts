import { currentYm } from "@/lib/current-ym";
import { loadLeavePage } from "@/lib/leave-sync";
import { loadOt } from "@/lib/ot/repo";
import TableLeavesClient from "@/components/TableLeavesClient";

export const dynamic = "force-dynamic";

export default async function OtLeavesPage({ searchParams }: { searchParams: { ym?: string } }) {
  const ym = currentYm(searchParams.ym);
  const d = await loadLeavePage("ot", ym);
  const o = await loadOt();
  return <TableLeavesClient table="ot" title="ตาราง OT" ym={ym} initial={d.rows} names={d.names} sync={d.sync} syncAll={d.syncAll} otSettings={o.settings} />;
}
