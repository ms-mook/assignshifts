import { notFound } from "next/navigation";
import { parseYm, shiftYm, monthTabName } from "@/lib/config";
import { computeMonth } from "@/lib/shift3/engine";
import { cellPerson, duplicateCols } from "@/lib/shift3/conflicts";
import { summarizeShifts } from "@/lib/shift-summary";
import { dropdownNames } from "@/lib/shift3/parse";
import { loadMonthState, loadShift3, syncLeaveSystem } from "@/lib/shift3/repo";
import { renderMonthHtml } from "@/lib/shift3/render";
import { crossInfo } from "@/lib/shift3/cross";
import { tableById } from "@/lib/tables";
import ScheduleView from "@/components/ScheduleView";
import OtSchedule from "./ot";
import KeySchedule from "./key";
import SmcSchedule from "./smc";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ params }: { params: { table: string; ym: string } }) {
  const tdef = tableById(params.table);
  const p = parseYm(params.ym);
  if (!tdef || !p) notFound();
  if (tdef.kind === "smc") return <SmcSchedule tdef={tdef} ym={params.ym} yearBE={p.yearBE} month={p.month} />;
  if (tdef.kind === "key") return <KeySchedule tdef={tdef} ym={params.ym} yearBE={p.yearBE} month={p.month} />;
  if (tdef.kind === "ot") return <OtSchedule tdef={tdef} ym={params.ym} yearBE={p.yearBE} month={p.month} />;
  await syncLeaveSystem({ ym: params.ym }); // การลาที่ Approve ในระบบลา เฉพาะเดือนนี้ (ดึงซ้ำไม่เกินนาทีละครั้ง)
  const data = await loadShift3();
  const st = await loadMonthState(data, p.yearBE, p.month);
  const res = computeMonth(data.settings, data.leaves, st.manual, p.yearBE, p.month);
  const html = renderMonthHtml(res, { editable: true, styles: st.styles, personColors: st.personColors });
  const sec = res.sections[tdef.section - 1];
  const beforeStart = res.sections[0].rows.every((r) => r.workday === 0 || r.week === null);
  const dupDays = sec.rows.filter((r) => r.date !== null && duplicateCols(r.cells).size > 0).map((r) => r.day);
  const names = dropdownNames(data.settings, data.mtrn);
  // สรุปเวรของตารางนี้ในเดือนนี้ (นับทุกช่องในแถววันที่)
  const summary = summarizeShifts(
    sec.rows.filter((r) => r.date !== null).flatMap((r) => r.cells.slice(1)),
    cellPerson,
    [
      { title: "พนักงานประจำ", names: [...data.settings.persons.map((x) => x.name), data.settings.pairOddKw8, data.settings.pairOddOpd11] },
      { title: "MT", names: data.mtrn.filter((m) => m.type === "MT").map((m) => m.name) },
      { title: "RN", names: data.mtrn.filter((m) => m.type === "RN").map((m) => m.name) },
    ],
  );
  return (
    <ScheduleView
      table={tdef.id}
      tableTitle={tdef.title}
      ym={params.ym}
      prevYm={shiftYm(p.yearBE, p.month, -1)}
      nextYm={shiftYm(p.yearBE, p.month, 1)}
      label={sec.subtitle}
      tabName={monthTabName(p.yearBE, p.month)}
      manualSource={st.source}
      sectionHtml={html[tdef.section - 1]}
      names={names}
      personColors={st.personColors}
      manual={st.manual}
      cellStyles={st.styles}
      cross={crossInfo(res, tdef.section)}
      dupDays={dupDays}
      summary={summary}
      warning={beforeStart ? "เดือนนี้อยู่ก่อนวันเริ่มตาราง (ตั้งค่า B3) จึงยังไม่มีการจัดคน" : ""}
    />
  );
}
