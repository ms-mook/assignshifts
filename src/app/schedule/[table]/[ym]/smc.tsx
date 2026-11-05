// หน้าตาราง SMC
import { shiftYm, monthTabName } from "@/lib/config";
import { computeSmcMonth, smcDupCols, SMC_BLOCKS, SMC_EDIT_COLS } from "@/lib/smc/engine";
import { loadSmc, loadSmcMonthState } from "@/lib/smc/repo";
import { SMC_COL_W, SMC_CSS, renderSmcHtml } from "@/lib/smc/render";
import { SHEET_CSS } from "@/lib/shift3/render";
import type { TableDef } from "@/lib/tables";
import { SMC_COL_LABEL } from "@/lib/col-info";
import { syncAllLeaves, leaveContext } from "@/lib/leave-sync";
import { loadSmcBookingGuides } from "@/lib/smc/booking";
import ScheduleView from "@/components/ScheduleView";

const todaySerial = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000) + 25569;
};

export default async function SmcSchedule({ tdef, ym, yearBE, month }: { tdef: TableDef; ym: string; yearBE: number; month: number }) {
  await syncAllLeaves(ym); // การลาที่ Approve ในระบบลา เฉพาะเดือนนี้ → ทั้ง 4 ชีต (ดึงซ้ำไม่เกินนาทีละครั้ง)
  const s = await loadSmc();
  const st = await loadSmcMonthState(s, yearBE, month);
  const res = computeSmcMonth(s, st.manual, yearBE, month);
  const html = `<style>${SMC_CSS}</style>` + renderSmcHtml(res, s, { editable: true, styles: st.styles, personColors: st.personColors, today: todaySerial() });
  const dupDays = res.rows.filter((r) => r.date !== null && smcDupCols(s, r.cells).size > 0).map((r) => r.day);
  const names = Array.from(new Set([...s.listJ, ...s.listL, ...s.listN, ...s.listP, ...s.listT, s.mt, s.pt].filter((n) => n.trim() !== "")));
  // ไกด์ชื่อจากระบบจองเวร (ห้องเจาะเลือด SMC) — ช่อง3/4/5 และ ช่อง3,4/5
  const guide = await loadSmcBookingGuides(yearBE, month, [...names, ...(await leaveContext("smc")).staff]);
  // สรุปเวร: จำนวนเวร (ช่อง) ที่แต่ละคนได้ในเดือนนี้ ตามรายชื่อในสรุปของชีต (X8:X)
  const summary = [
    {
      title: `สรุปเวรเดือนนี้ (วันทำการ ${res.workdays} วัน)`,
      rows: res.people.map((p) => ({
        name: p.name,
        count: res.rows.reduce((n, r) => n + SMC_EDIT_COLS.filter((c) => (r.cells[c] ?? "").toLowerCase() === p.name.toLowerCase()).length, 0),
      })),
    },
  ];
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
      manual={Object.fromEntries(Object.entries(st.manual).map(([k, v]) => [`m:${k}`, v]))}
      cellStyles={st.styles}
      dupDays={dupDays}
      summary={summary}
      warning=""
      api="/api/smc"
      officerCols={[]}
      colLabels={SMC_COL_LABEL}
      rowGroups={SMC_BLOCKS}
      freeNames={[s.mt, s.pt].filter((x) => x.trim() !== "")}
      guide={guide}
      dupNote="พนักงาน 1 คนอยู่ได้ทีละจุดในช่วงเวลาเดียวกัน"
      hint="ช่องที่แก้เอง/พิมพ์ทับเก็บในแท็บ WEB-ช่องเลือกเอง (ไม่แตะสูตรในแท็บเดือน) · ชื่อที่ลาวันนั้นจะขึ้นสีส้มขีดฆ่า · บันทึกการลาที่หน้า ลา-แลกเวร (SMC)"
      pdf={{ colA: SMC_COL_W[0], colW: 175, sheetCss: SHEET_CSS + SMC_CSS }}
    />
  );
}
