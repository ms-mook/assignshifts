// แผนการเวียนรายสัปดาห์ + สรุปความเท่าเทียม (ชีต แผนรายสัปดาห์ / สรุป)
import { OtPlan, computeOtMonth, spotCol } from "@/lib/ot/engine";
import { loadOt, loadOtManyMonths } from "@/lib/ot/repo";
import { isoFromSerial, ymdFromSerial } from "@/lib/sheets-date";
import OtSummaryRange from "@/components/OtSummaryRange";
import { planWeeks } from "@/lib/today";
import { WeeksNav } from "@/components/PlanNav";

export const dynamic = "force-dynamic";

const fmt = (s: number) => {
  const { y, m, d } = ymdFromSerial(s);
  return `${d}/${m}/${(y + 543) % 100}`;
};

export default async function OtPlanPage({ searchParams }: { searchParams: { weeks?: string } }) {
  const data = await loadOt();
  const s = data.settings;
  const plan = new OtPlan(s);
  const { n: nWeeks, current } = planWeeks(s.startMonday, 61, searchParams.weeks);
  const weeks = Array.from({ length: nWeeks }, (_, i) => plan.week(i + 1));
  const heads = s.spots.map((x) => x.name);

  // ---------- สรุป ----------
  const from = data.summaryFrom ?? s.startMonday;
  const to = data.summaryTo ?? s.startMonday + 7 * 52;
  const inRange = (w: { B: number }) => w.B >= from && w.B <= to;
  // สัปดาห์ในช่วงสรุป (ชีตอ้างแถว 5:65 = 61 สัปดาห์; เว็บคำนวณให้ครบช่วง)
  const lastWeek = Math.max(1, Math.floor((to - s.startMonday) / 7) + 1);
  const all = Array.from({ length: Math.max(lastWeek, 1) }, (_, i) => plan.week(i + 1)).filter(inRange);
  // เดือนที่นับ "เลือกเอง" = เดือนของวันเริ่มช่วง ถึงเดือนของวันสิ้นสุดช่วง (ชีตเดิม: พ.ย.69–พ.ย.70)
  const months: { y: number; m: number }[] = [];
  {
    const a = ymdFromSerial(from), b = ymdFromSerial(to);
    for (let k = a.y * 12 + a.m - 1; k <= b.y * 12 + b.m - 1; k++) months.push({ y: Math.floor(k / 12) + 543, m: (k % 12) + 1 });
  }
  const manuals = await loadOtManyMonths(data, months);
  const manualCount = (name: string, col: string) => {
    let n = 0;
    for (const { y, m } of months) {
      const res = computeOtMonth(s, data.leaves, manuals[`${y}-${String(m).padStart(2, "0")}`] ?? {}, y, m);
      for (const r of res.rows) if (r.date !== null && (r.cells[col] ?? "") === name) n++;
    }
    return n;
  };
  const names = plan.summaryNames();
  const summary = names.map((name, j) => {
    if (name === "") return null;
    const c = Array.from({ length: 8 }, (_, k) => all.filter((w) => spotCol(w)[k] === name).length);
    const maxStreak = all.reduce((mx, w) => Math.max(mx, w.streak[j]), 0);
    const P = manualCount(name, "B"), Q = manualCount(name, "D"), R = manualCount(name, "J");
    return { name, c, J: c[0] + c[1] + c[2] + c[3], K: c[4] + c[5], L: c[6] + c[7], M: c[1] + c[2] + c[3], N: c.reduce((a, b) => a + b, 0), O: maxStreak, P, Q, R, S: P + Q + R };
  });

  const warnCls = (v: string) => (v.includes("⚠") ? "bad" : v === "ปิดจุด" ? "muted" : "");
  return (
    <div>
      <div className="page-head">
        <h1>แผนการเวียนรายสัปดาห์ — ตาราง OT</h1>
        <span className="muted">คำนวณอัตโนมัติจากหน้า ตั้งค่า (ห้ามแก้) · จุดหนัก = ตรวจสอบเอกสาร, นำส่ง OPD คนที่1-2 · ปิดจุด = บัตรคิว SMC ถูกย้ายไปแทนจุดที่ขาดคน · ⚠ ว่าง = ต้องหาคนเพิ่ม</span>
      </div>

      <section className="card scroll-x">
        <h2>สรุปความเท่าเทียมของการเวียนจุด (นับเป็นจำนวนสัปดาห์)</h2>
        <OtSummaryRange from={isoFromSerial(from)} to={isoFromSerial(to)} />
        <table className="form plan">
          <thead>
            <tr>
              <th>พนักงาน</th>
              {heads.map((h) => <th key={h}>{h}</th>)}
              <th>รวม OPD</th><th>รวม กว.</th><th>รวม SMC</th><th>จุดหนักรวม</th><th>รวมสัปดาห์</th><th>จุดหนักติดกันสูงสุด</th>
              <th>เลือกเอง: บัตรคิว OPD (วัน)</th><th>เลือกเอง: ตรวจเอกสาร/เก็บ3 (วัน)</th><th>เลือกเอง: เก็บนำส่ง กว. (วัน)</th><th>รวมเลือกเอง (วัน)</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((r, i) =>
              r === null ? null : (
                <tr key={i}>
                  <td>{r.name}</td>
                  {r.c.map((v, k) => <td key={k}>{v}</td>)}
                  <td>{r.J}</td><td>{r.K}</td><td>{r.L}</td><td>{r.M}</td><td>{r.N}</td>
                  <td className={r.O >= 2 ? "bad" : ""}>{r.O}</td>
                  <td>{r.P}</td><td>{r.Q}</td><td>{r.R}</td><td>{r.S}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        <p className="muted">การนับอิงแผนรายสัปดาห์ ไม่รวมการลารายวัน (ตามชีตเดิม) · &quot;เลือกเอง&quot; นับจากฟอร์มรายเดือนในช่วงที่เลือก</p>
      </section>

      <section className="card scroll-x">
        <h2>แผนรายสัปดาห์</h2>
        <WeeksNav base="/ot/plan" n={nWeeks} current={current} />
        <table className="form plan">
          <thead>
            <tr><th>สัปดาห์</th><th>วันจันทร์</th><th>วันศุกร์</th>{heads.map((h) => <th key={h}>{h}</th>)}<th>หมายเหตุ</th></tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.A} id={w.A === current ? "week-now" : undefined} className={w.A === current ? "now" : undefined}>
                <td>{w.A}</td><td>{fmt(w.B)}</td><td>{fmt(w.C)}</td>
                {spotCol(w).map((v, k) => <td key={k} className={warnCls(v)}>{v}</td>)}
                <td className={w.L.includes("⚠") ? "bad" : ""}>{w.L}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
