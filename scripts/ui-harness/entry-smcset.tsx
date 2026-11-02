// harness หน้าตั้งค่า SMC (ใช้ค่าจาก fixtures)
import { createRoot } from "react-dom/client";
import SmcFormClient from "../../src/components/SmcFormClient";
import { ToastProvider } from "../../src/components/Toast";
import { smcToForm } from "../../src/lib/smc/repo";
import { smcSettings } from "../../fixtures/smc-fixture";
import "../../src/app/ui.css";
import "../../src/app/globals.css";
createRoot(document.getElementById("root")!).render(<ToastProvider><main><SmcFormClient initial={smcToForm(smcSettings as any)} part="settings" /></main></ToastProvider>);
