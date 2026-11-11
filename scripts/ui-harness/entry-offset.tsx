import { createRoot } from "react-dom/client";
import OffSettingsClient from "../../src/components/OffSettingsClient";
import { ToastProvider } from "../../src/components/Toast";
import { parseOffSettings } from "../../src/lib/off/settings";
import real from "./off-settings-real.json";
import "../../src/app/ui.css";
import "../../src/app/globals.css";

const R = real as unknown as { v: unknown[][]; f: unknown[][] };
createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <main className="page">
      <OffSettingsClient initial={parseOffSettings(R.v, R.f)} />
    </main>
  </ToastProvider>,
);
