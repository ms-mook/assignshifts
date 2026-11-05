import { createRoot } from "react-dom/client";
import ScheduleView from "../../src/components/ScheduleView";
import { ToastProvider } from "../../src/components/Toast";
import { computeKeyMonth } from "../../src/lib/key/engine";
import { KEY_COL_W, KEY_CSS, renderKeyHtml } from "../../src/lib/key/render";
import { SHEET_CSS } from "../../src/lib/shift3/render";
import { keySettings } from "../../fixtures/key-fixture";
import "../../src/app/ui.css";
import "../../src/app/globals.css";

const s = { ...keySettings, leaves: [{ date: keySettings.rotStart + 15, who: "สมพาน", sub: "ปณิชา", note: "" }, { date: keySettings.rotStart + 16, who: "เดือน", sub: "", note: "" }] };
const res = computeKeyMonth(s, { "H:2": "กฤษณา" }, 2569, 12);
const html = `<style>${KEY_CSS}</style>` + renderKeyHtml(res, s, { editable: true });
createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <main>
      <ScheduleView table="key" tableTitle="ตาราง Key" ym="2569-12" prevYm="2569-11" nextYm="2570-01" label={res.subtitle}
        tabName="ธ.ค.69" manualSource="web-tab" sectionHtml={html} names={s.dropdown} personColors={{}} dupDays={[]} warning={res.checks.status}
        summary={[{ title: "สรุปวันทำงานเดือนนี้", rows: res.dayCounts }]}
        api="/api/key" officerCols={[]} rowGroups={[["B", "C", "D", "E", "F", "H", "I", "J", "K", "L", "M", "N", "O"]]} freeNames={["MT full-time", "ลา"]}
        guide={{ cols: ["B", "C", "D", "E", "F", "J", "K", "L", "M"], title: "จองเวรไว้ · จุดลงทะเบียนรายการตรวจ (เช้า)", byDay: {
          2: [{ name: "น้ำทิพย์", booked: "น้ำทิพย์ จังพล", slot: "06:00-08:30" }, { name: "สุนิษา", booked: "สุนิษา จันทะดวง", slot: "06:00-08:30" }, { name: "สมพาน", booked: "สมพาน ทดสอบ", slot: "06:00-08:30" }, { name: "จีรินันท์", booked: "จีรินันท์ ทดสอบ", slot: "06:00-08:30" }, { name: "MT full-time", booked: "x", slot: "06:00-08:30" }],
          3: [{ name: "กฤษณา", booked: "กฤณา ฝาชัยภูมิ", slot: "06:00-08:30", note: 'ระบบจองสะกด "กฤณา"' }],
        } }} hint="ทดสอบ Key" pdf={{ colA: KEY_COL_W[0], colW: 125, keepCols: [15], sheetCss: SHEET_CSS + KEY_CSS }} />
    </main>
  </ToastProvider>,
);
