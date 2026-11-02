// harness หน้าเต็ม (เมนูบน + ตาราง) สำหรับตรวจหน้าตา UI
import { createRoot } from "react-dom/client";
import ScheduleView from "../../src/components/ScheduleView";
import { ToastProvider, useToast } from "../../src/components/Toast";
import NavLinks from "../../src/components/NavLinks";
import LogoutButton from "../../src/components/LogoutButton";
import Icon from "../../src/components/Icon";
import { computeMonth } from "../../src/lib/shift3/engine";
import { parseSettings, dropdownNames } from "../../src/lib/shift3/parse";
import { renderMonthHtml } from "../../src/lib/shift3/render";
import { duplicateCols } from "../../src/lib/shift3/conflicts";
import { crossInfo } from "../../src/lib/shift3/cross";
import book from "../../fixtures/shift3-sheet.json";
import "../../src/app/ui.css";
import "../../src/app/globals.css";
import { useEffect } from "react";

const g: any[][] = (book as any)["ตั้งค่า"].map((r: string[]) => [...r]);
const i = g.findIndex((r) => r[0] === "ชื่อผู้จัดทำ");
const tail = g.splice(i - 1, 3);
while (g.length < 87) g.push([]);
g.push(...tail);
const s = parseSettings(g);
const q = new URLSearchParams(location.search);
const sec = Number(q.get("sec") ?? "1");
const res = computeMonth(s, [], {}, 2570, 1);
const html = renderMonthHtml(res, { editable: true })[sec - 1];
const names = dropdownNames(s, []);
const dupDays = res.sections[sec - 1].rows.filter((r) => r.date !== null && duplicateCols(r.cells).size > 0).map((r) => r.day);
const summary = [{ title: "พนักงานประจำ", rows: names.slice(0, 8).map((n, k) => ({ name: n, count: 20 - k * 2 })) }, { title: "MT", rows: names.slice(8, 12).map((n, k) => ({ name: n, count: k + 1 })) }];

function Toasts() {
  const t = useToast();
  useEffect(() => {
    if (q.get("toast")) {
      t.success("บันทึกชื่อสำเร็จ");
      t.loading("กำลังบันทึกลง Google Sheet… (รอสักครู่)");
      t.info("ข้อมูลอัปเดตแล้ว");
    }
  }, []);
  return null;
}

const root = createRoot(document.getElementById("root")!);
const draw = (k: number) => root.render(
  <ToastProvider key={k}>
    <Toasts />
    <nav className="topnav no-print">
      <span className="brand">
        <span className="brand-mark"><Icon name="CalendarDays" size={20} /></span>
        <span className="brand-text grad-text">ตารางเวร</span>
      </span>
      <NavLinks />
      <span className="spacer" />
      <LogoutButton />
    </nav>
    <main>
      <ScheduleView
        table={`s${sec}`}
        tableTitle={["", "ตาราง 6.00-8.30", "ตาราง 8.30-12.30", "ตาราง 12.30-16.30"][sec]}
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
        summary={summary}
        manual={{}}
        cellStyles={{}}
        cross={crossInfo(res, sec as 1)}
        warning=""
      />
    </main>
  </ToastProvider>,
);
draw(0);
(window as any).__remount = (k: number) => draw(k);
