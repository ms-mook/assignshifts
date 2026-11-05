// harness สำหรับทดสอบหน้าตารางจริง (ScheduleView) ในเบราว์เซอร์ โดยไม่ต้องมี Next/Google
import { createRoot } from "react-dom/client";
import ScheduleView from "../../src/components/ScheduleView";
import { ToastProvider } from "../../src/components/Toast";
import { computeMonth } from "../../src/lib/shift3/engine";
import { parseSettings } from "../../src/lib/shift3/parse";
import { renderMonthHtml } from "../../src/lib/shift3/render";
import { duplicateCols } from "../../src/lib/shift3/conflicts";
import { dropdownNames } from "../../src/lib/shift3/parse";
import { crossInfo } from "../../src/lib/shift3/cross";
import book from "../../fixtures/shift3-sheet.json";
import "../../src/app/ui.css";
import "../../src/app/globals.css";

const g: any[][] = (book as any)["ตั้งค่า"].map((r: string[]) => [...r]);
const i = g.findIndex((r) => r[0] === "ชื่อผู้จัดทำ");
const tail = g.splice(i - 1, 3);
while (g.length < 87) g.push([]);
g.push(...tail);
const s = parseSettings(g);
const sec = Number(new URLSearchParams(location.search).get("sec") ?? "1");
const res = computeMonth(s, [], {}, 2570, 1);
const html = renderMonthHtml(res, { editable: true })[sec - 1];
const names = dropdownNames(s, []);
const dupDays = res.sections[sec - 1].rows.filter((r) => r.date !== null && duplicateCols(r.cells).size > 0).map((r) => r.day);
createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <main>
      <ScheduleView
        table={`s${sec}`}
        tableTitle="ตารางทดสอบ"
        ym="2570-01"
        prevYm="2569-12"
        nextYm="2570-02"
        label={res.sections[0].subtitle}
        tabName="ม.ค.70"
        manualSource="month-tab"
        sectionHtml={html}
        names={names}
        personColors={{}}
        dupDays={dupDays}
        warning=""
        cross={crossInfo(res, sec as 1 | 2 | 3)}
        guide={{ cols: ["*"], sec: String(sec), onlyEmpty: true, title: "จองเวรไว้ · จุดเจาะเลือด (เช้า 06:00-08:30)", byDay: {
          2: [
            { name: "ธัญญาธร", booked: "ธัญญาธร นนท์ขุนทด", slot: "06:00-08:30 · ห้อง OPD · จองช่วง 08:30-12:30, 12:30-16:30 ด้วย", secs: ["1", "2", "3"] },
            { name: "ปรางทิพย์", booked: "ปรางทิพย์ ชาญพานิชย์", slot: "06:00-08:30 · ห้อง SMC", note: "ไม่มีในรายชื่อตาราง", secs: ["1"] },
          ],
        } }}
      />
    </main>
  </ToastProvider>,
);
