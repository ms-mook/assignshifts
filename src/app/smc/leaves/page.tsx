import { currentYm } from "@/lib/current-ym";
import { loadLeavePage } from "@/lib/leave-sync";
import TableLeavesClient from "@/components/TableLeavesClient";

export const dynamic = "force-dynamic";

export default async function SmcLeavesPage({ searchParams }: { searchParams: { ym?: string } }) {
  const ym = currentYm(searchParams.ym);
  const d = await loadLeavePage("smc", ym);
  return <TableLeavesClient table="smc" title="ตาราง SMC" ym={ym} initial={d.rows} names={d.names} sync={d.sync} />;
}
