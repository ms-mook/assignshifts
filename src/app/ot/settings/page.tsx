import { loadOt, otToForm } from "@/lib/ot/repo";
import OtSettingsClient from "@/components/OtSettingsClient";

export const dynamic = "force-dynamic";

export default async function OtSettingsPage() {
  return <OtSettingsClient initial={otToForm(await loadOt())} />;
}
