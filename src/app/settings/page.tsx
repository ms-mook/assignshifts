import { loadShift3, settingsInfo, toForm } from "@/lib/shift3/repo";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = await loadShift3();
  return <SettingsClient initial={toForm(data)} info={settingsInfo(data)} />;
}
