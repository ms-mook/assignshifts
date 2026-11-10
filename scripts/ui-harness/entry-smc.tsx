import { createRoot } from "react-dom/client";
import ScheduleView from "../../src/components/ScheduleView";
import { ToastProvider } from "../../src/components/Toast";
import { computeSmcMonth , SMC_BLOCKS } from "../../src/lib/smc/engine";
import { SMC_COL_W, SMC_CSS, renderSmcHtml } from "../../src/lib/smc/render";
import { SHEET_CSS } from "../../src/lib/shift3/render";
import { smcSettings } from "../../fixtures/smc-fixture";
import "../../src/app/ui.css";
import "../../src/app/globals.css";

const iso = (d: string) => Math.round(Date.parse(d + "T00:00:00Z") / 86400000) + 25569;
const s = { ...smcSettings, leaves: [{ name: "อัมพร", start: iso("2026-12-15"), end: iso("2026-12-16"), type: "ลาพักร้อน", sub: "สมพาน", note: "" }, { name: "อัมพร", start: iso("2026-12-22"), end: null, type: "ลากิจ", sub: "", note: "" }] };
const res = computeSmcMonth(s, { "G:2": "จุฑาพร", "O:2": "นิภาพร", "T:3": "ปวีณา", "H:4": "อัมพร" }, 2569, 12);
const html = `<style>${SMC_CSS}</style>` + renderSmcHtml(res, s, { editable: true });
createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <main>
      <ScheduleView table="smc" tableTitle="ตาราง SMC" ym="2569-12" prevYm="2569-11" nextYm="2570-01" label={res.subtitle}
        tabName="ธ.ค.69" manualSource="web-tab" sectionHtml={html} names={s.listL} personColors={{}} dupDays={[4]} warning=""
        summary={[{ title: "สรุปเวรเดือนนี้", rows: res.people.map((p) => ({ name: p.name, count: p.days })) }]}
        api="/api/smc" autoAssign rowGroups={SMC_BLOCKS} freeNames={["MT full-time", "Part-time"]} officerCols={[]} hint="ทดสอบ SMC" pdf={{ colA: SMC_COL_W[0], colW: 175, sheetCss: SHEET_CSS + SMC_CSS }} />
    </main>
  </ToastProvider>,
);
