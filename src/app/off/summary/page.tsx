// สรุปจำนวนเวรสะสมรายปี ตารางเวรนอกเวลา (เหมือนแท็บ "สรุปจำนวนเวร") — คำนวณสดจากตารางเดือน + ค่าที่แก้บนเว็บ จึงเปลี่ยนตามผู้จัดเวรอัตโนมัติ
import { loadOffYear } from "@/lib/off/repo";
import { offYearSummary } from "@/lib/off/engine";
import { parseYm, MONTH_SHORT } from "@/lib/config";
import { ymdFromSerial } from "@/lib/sheets-date";
import { todaySerialTH } from "@/lib/today";
import { MonthsNav } from "@/components/PlanNav";

export const dynamic = "force-dynamic";

export default async function OffSummaryPage({ searchParams }: { searchParams: { from?: string } }) {
  const pick = parseYm(searchParams.from ?? "");
  const now = ymdFromSerial(todaySerialTH());
  const { months, labels, lists } = await loadOffYear(pick ? { y: pick.yearBE, m: pick.month } : null, now.y * 12 + now.m - 1);
  const blocks = offYearSummary(months, lists);
  const label = `${MONTH_SHORT[labels[0].m - 1]} ${labels[0].y} – ${MONTH_SHORT[labels[11].m - 1]} ${labels[11].y}`;
  const missing = labels.filter((_, i) => months[i] === null).map((l) => `${MONTH_SHORT[l.m - 1]} ${String(l.y % 100)}`);
  return (
    <div>
      <div className="page-head">
        <h1>สรุปจำนวนเวรสะสม — ตารางเวรนอกเวลา</h1>
        <span className="muted">นับจากชื่อในตารางเดือนทั้ง 12 เดือน ({label}) รวมช่องที่ผู้จัดเวรแก้บนเว็บ · หน่วย = เวร</span>
      </div>
      <MonthsNav base="/off/summary" from={{ y: labels[0].y, m: labels[0].m }} label={label} />
      {missing.length > 0 && <p className="muted small">ยังไม่มีแท็บเดือน: {missing.join(", ")} (นับเป็น 0)</p>}
      {blocks.map((b) => (
        <section className="card scroll-x" key={b.title}>
          <h2>{b.title}</h2>
          <table className="sum-table multi">
            <thead>
              <tr>
                <th>ชื่อเจ้าหน้าที่</th>
                {labels.map((l) => <th key={`${l.y}-${l.m}`}>{MONTH_SHORT[l.m - 1]} {String(l.y % 100)}</th>)}
                <th>{b.totalLabel}</th>
                {b.extraLabels.map((x) => <th key={x}>{x}</th>)}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  {r.months.map((v, i) => <td key={i}>{v || ""}</td>)}
                  <td><b>{r.total}</b></td>
                  {r.extras.map((v, i) => <td key={i}>{v}</td>)}
                </tr>
              ))}
              <tr className="tot">
                <td>รวม</td>
                {b.monthTotals.map((v, i) => <td key={i}>{v}</td>)}
                <td><b>{b.total}</b></td>
                {b.extraLabels.map((x, i) => <td key={x}>{b.rows.reduce((n, r) => n + r.extras[i], 0)}</td>)}
              </tr>
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
