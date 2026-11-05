import { currentYm } from "@/lib/current-ym";
import { loadLeavePage } from "@/lib/leave-sync";
import { loadKey } from "@/lib/key/repo";
import TableLeavesClient from "@/components/TableLeavesClient";

export const dynamic = "force-dynamic";

export default async function KeyLeavesPage({ searchParams }: { searchParams: { ym?: string } }) {
  const ym = currentYm(searchParams.ym);
  const d = await loadLeavePage("key", ym);
  const s = await loadKey();
  return <TableLeavesClient table="key" title="ตาราง Key" ym={ym} initial={d.rows} names={d.names} sync={d.sync} keySettings={s} />;
}
