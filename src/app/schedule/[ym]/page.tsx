import { notFound } from "next/navigation";
import { parseYm, shiftYm, monthTabName } from "@/lib/config";
import { computeMonth } from "@/lib/shift3/engine";
import { dropdownNames } from "@/lib/shift3/parse";
import { loadManual, loadShift3 } from "@/lib/shift3/repo";
import { renderMonthHtml } from "@/lib/shift3/render";
import ScheduleView from "@/components/ScheduleView";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ params }: { params: { ym: string } }) {
  const p = parseYm(params.ym);
  if (!p) notFound();
  const data = await loadShift3();
  const { manual, source } = await loadManual(data, p.yearBE, p.month);
  const res = computeMonth(data.settings, data.leaves, manual, p.yearBE, p.month);
  const html = renderMonthHtml(res, { editable: true });
  const beforeStart = res.sections[0].rows.every((r) => r.workday === 0 || r.week === null);
  return (
    <ScheduleView
      ym={params.ym}
      prevYm={shiftYm(p.yearBE, p.month, -1)}
      nextYm={shiftYm(p.yearBE, p.month, 1)}
      label={res.sections[0].subtitle}
      tabName={monthTabName(p.yearBE, p.month)}
      manualSource={source}
      sectionsHtml={html}
      names={dropdownNames(data.settings, data.mtrn)}
      warning={beforeStart ? "เดือนนี้อยู่ก่อนวันเริ่มตาราง (ตั้งค่า B3) จึงยังไม่มีการจัดคน" : ""}
    />
  );
}
