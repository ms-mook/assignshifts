// หน้าตาราง OT (จุดรับ-นำส่งสิ่งส่งตรวจ)
import { shiftYm, monthTabName } from "@/lib/config";
import { computeOtMonth } from "@/lib/ot/engine";
import { otDupCols, otPerson } from "@/lib/ot/conflicts";
import { OT_EDIT_COLS } from "@/lib/ot/engine";
import { summarizeShifts } from "@/lib/shift-summary";
import { loadOt, loadOtMonthState } from "@/lib/ot/repo";
import { OT_COL_W, OT_CSS, renderOtHtml } from "@/lib/ot/render";
import { SHEET_CSS } from "@/lib/shift3/render";
import type { TableDef } from "@/lib/tables";
import ScheduleView from "@/components/ScheduleView";

const todaySerial = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000); // เวลาไทย
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000) + 25569;
};

export default async function OtSchedule({ tdef, ym, yearBE, month }: { tdef: TableDef; ym: string; yearBE: number; month: number }) {
  const data = await loadOt();
  const st = await loadOtMonthState(data, yearBE, month);
  const res = computeOtMonth(data.settings, data.leaves, st.manual, yearBE, month);
  const html = `<style>${OT_CSS}</style>` + renderOtHtml(res, { editable: true, styles: st.styles, personColors: st.personColors, today: todaySerial() });
  const dupDays = res.rows.filter((r) => r.date !== null && otDupCols(r.cells).size > 0).map((r) => r.day);
  const names = Array.from(new Set([...data.settings.staff.map((s) => s.name), ...data.settings.dropdown].filter((n) => n.trim() !== "")));
  // สรุปเวร: นับทุกช่อง B..N (ไม่รวมหมายเหตุ O)
  const summary = summarizeShifts(
    res.rows.filter((r) => r.date !== null).flatMap((r) => OT_EDIT_COLS.filter((c) => c !== "O").map((c) => r.cells[c] ?? "")),
    otPerson,
    [
      { title: "พนักงาน", names: data.settings.staff.flatMap((s) => [s.name, s.rep]) },
      { title: "รายชื่อใน dropdown", names: data.settings.dropdown },
    ],
  );
  const beforeStart = res.rows.every((r) => r.P === 0 || r.Q === null);
  return (
    <ScheduleView
      table={tdef.id}
      tableTitle={tdef.title}
      ym={ym}
      prevYm={shiftYm(yearBE, month, -1)}
      nextYm={shiftYm(yearBE, month, 1)}
      label={res.subtitle}
      tabName={monthTabName(yearBE, month)}
      manualSource={st.hasTab ? "month-tab" : "web-tab"}
      sectionHtml={html}
      names={names}
      personColors={st.personColors}
      manual={Object.fromEntries(Object.entries(st.manual).map(([k, v]) => [`o:${k}`, v]))}
      cellStyles={st.styles}
      dupDays={dupDays}
      summary={summary}
      warning={beforeStart ? "เดือนนี้อยู่ก่อนวันเริ่มตาราง (ตั้งค่า B4) จึงยังไม่มีการจัดคน" : ""}
      api="/api/ot"
      dupNote="ตรวจว่าตั้งใจให้ควบ 2 จุด (เช่น 06.00-08.30 คู่กับช่วงทั้งวัน) — บันทึกได้ ระบบแค่เตือน"
      officerCols={[]}
      hint="ช่องที่แก้เอง/พิมพ์ทับเก็บในแท็บ WEB-ช่องเลือกเอง (ไม่แตะสูตรในแท็บเดือน) · ถ้าจะเปลี่ยนคนในช่องที่เป็นสูตร ให้ใช้หน้า ลา-แลกเวร (OT)"
      pdf={{ colA: OT_COL_W[0], colW: 185, keepCols: [14], sheetCss: SHEET_CSS + OT_CSS }}
    />
  );
}
