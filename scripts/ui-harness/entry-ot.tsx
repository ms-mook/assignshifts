import { createRoot } from "react-dom/client";
import ScheduleView from "../../src/components/ScheduleView";
import { ToastProvider } from "../../src/components/Toast";
import { computeOtMonth } from "../../src/lib/ot/engine";
import { otDupCols, otPerson } from "../../src/lib/ot/conflicts";
import { OT_EDIT_COLS } from "../../src/lib/ot/engine";
import { summarizeShifts } from "../../src/lib/shift-summary";
import { OT_COL_W, OT_CSS, renderOtHtml } from "../../src/lib/ot/render";
import { SHEET_CSS } from "../../src/lib/shift3/render";
import { otSettings, otLeaves } from "../../fixtures/ot-fixture";
import "../../src/app/ui.css";
import "../../src/app/globals.css";

const res = computeOtMonth(otSettings, otLeaves, { "B:2": "จิรายุทธ", "B:3": "กิตติยาภา" }, 2569, 11);
const html = `<style>${OT_CSS}</style>` + renderOtHtml(res, { editable: true });
const dupDays = res.rows.filter((r) => r.date !== null && otDupCols(r.cells).size > 0).map((r) => r.day);
const summary = summarizeShifts(res.rows.filter((r) => r.date !== null).flatMap((r) => OT_EDIT_COLS.filter((c) => c !== "O").map((c) => r.cells[c] ?? "")), otPerson, [{ title: "พนักงาน", names: otSettings.staff.flatMap((s) => [s.name, s.rep]) }, { title: "รายชื่อใน dropdown", names: otSettings.dropdown }]);
createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <main>
      <ScheduleView table="ot" tableTitle="ตารางจุดรับ-นำส่งสิ่งส่งตรวจ" ym="2569-11" prevYm="2569-10" nextYm="2569-12" label={res.subtitle}
        tabName="พ.ย.69" manualSource="web-tab" sectionHtml={html} names={otSettings.dropdown} personColors={{}} dupDays={dupDays} summary={summary} warning=""
        api="/api/ot" officerCols={[]} hint="ทดสอบ OT" pdf={{ colA: OT_COL_W[0], colW: 185, keepCols: [14], sheetCss: SHEET_CSS + OT_CSS }} />
    </main>
  </ToastProvider>,
);
