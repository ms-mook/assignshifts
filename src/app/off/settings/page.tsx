import { loadOffSettings } from "@/lib/off/repo";
import OffSettingsClient from "@/components/OffSettingsClient";

export const dynamic = "force-dynamic";

export default async function OffSettingsPage() {
  return <OffSettingsClient initial={await loadOffSettings()} />;
}
