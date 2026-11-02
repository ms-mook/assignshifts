import { createRoot } from "react-dom/client";
import OtSettingsClient from "../../src/components/OtSettingsClient";
import { ToastProvider } from "../../src/components/Toast";
import NavLinks from "../../src/components/NavLinks";
import LogoutButton from "../../src/components/LogoutButton";
import Icon from "../../src/components/Icon";
import { otSettings as s } from "../../fixtures/ot-fixture";
import "../../src/app/ui.css";
import "../../src/app/globals.css";
const iso = (n: number | null) => (n === null ? "" : new Date((n - 25569) * 86400000).toISOString().slice(0, 10));
const f = { pattern: s.pattern, startMonday: iso(s.startMonday), eightStart: iso(s.eightStart), smcOpen: iso(s.smcOpen), signerName: s.signerName, signerTitle: s.signerTitle,
  staff: s.staff.map((p) => ({ name: p.name, start: iso(p.start), last: iso(p.last), rep: p.rep, repStart: iso(p.repStart) })), spotNames: s.spots.map((x) => x.name),
  holidays: s.holidays.slice(0, 4).map((h) => ({ date: iso(h.date), name: h.name })), dropdown: s.dropdown };
createRoot(document.getElementById("root")!).render(<ToastProvider><nav className="topnav no-print"><span className="brand"><span className="brand-mark"><Icon name="CalendarDays" size={20} /></span><span className="brand-text grad-text">ตารางเวร</span></span><NavLinks /><span className="spacer" /><LogoutButton /></nav><main><OtSettingsClient initial={f} /></main></ToastProvider>);
