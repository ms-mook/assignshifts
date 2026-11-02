import { loadSmc, smcToForm } from "@/lib/smc/repo";
import SmcFormClient from "@/components/SmcFormClient";

export const dynamic = "force-dynamic";

export default async function SmcLeavesPage() {
  return <SmcFormClient initial={smcToForm(await loadSmc())} part="leaves" />;
}
