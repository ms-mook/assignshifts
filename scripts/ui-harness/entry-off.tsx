import { createRoot } from "react-dom/client";
import ScheduleView from "../../src/components/ScheduleView";
import { ToastProvider } from "../../src/components/Toast";
import { buildOffMonth, offNamesByCol, offSummary, parseOffLists } from "../../src/lib/off/engine";
import { OFF_COL_W, OFF_CSS, renderOffHtml } from "../../src/lib/off/render";
import { SHEET_CSS } from "../../src/lib/shift3/render";
import real from "./off-real.json";
import "../../src/app/ui.css";
import "../../src/app/globals.css";

const R = real as unknown as Record<string, string[][]>;
const lists = parseOffLists(R["ตั้งค่า"]);
const mo = buildOffMonth(R["ธ.ค. 69"], { "W:12": "นัฐ" }, 2569, 12);
const iso = (d: string) => Math.round(Date.parse(d + "T00:00:00Z") / 86400000) + 25569;
const leaves = [{ firstName: "กฤษฎา", start: iso("2026-12-12"), end: iso("2026-12-12") }];
const html = `<style>${OFF_CSS}</style>` + renderOffHtml(mo, { editable: true, leaves, styles: { "w:C:19": { bg: "#C6E0B4" } } });
const byCol = offNamesByCol(lists);
createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <main>
      <ScheduleView table="off" tableTitle="ตารางเวรนอกเวลา" ym="2569-12" prevYm="2569-11" nextYm="2570-01" label={mo.head.A2 ?? ""}
        tabName="ธ.ค. 69" manualSource="web-tab" sectionHtml={html} names={Array.from(new Set(Object.values(byCol).flat()))} namesByCol={byCol}
        personColors={{}} dupDays={[]} warning="งดเวรนอกเวลา (ระบบลา) แต่มีชื่อในตาราง 1 ช่อง — วันที่ 12 (ช่องสีส้มขีดฆ่า)"
        manual={{ "w:W:12": "นัฐ" }} summary={offSummary(mo, lists)} api="/api/off" officerCols={[]} hint="ทดสอบ นอกเวลา"
        pdf={{ colA: OFF_COL_W[0], colW: 110, keepCols: [1, 23], sheetCss: SHEET_CSS + OFF_CSS }} />
    </main>
  </ToastProvider>,
);
