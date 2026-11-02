import { keyToForm, loadKey } from "@/lib/key/repo";
import KeyFormClient from "@/components/KeyFormClient";

export const dynamic = "force-dynamic";

export default async function KeySettingsPage() {
  const s = await loadKey();
  return <KeyFormClient initial={keyToForm(s)} part="settings" settings={s} />;
}
