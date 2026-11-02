import { PLAN_HEADERS_D_Q, PlanCalculator } from "@/lib/shift3/engine";
import { loadShift3 } from "@/lib/shift3/repo";
import { ymdFromSerial } from "@/lib/sheets-date";

export const dynamic = "force-dynamic";

const fmt = (serial: number) => {
  const d = ymdFromSerial(serial);
  return `${d.d}/${d.m}/${String(d.y + 543).slice(-2)}`;
};

export default async function PlanPage({ searchParams }: { searchParams: { weeks?: string } }) {
  const data = await loadShift3();
  const plan = new PlanCalculator(data.settings);
  const n = Math.min(Math.max(Number(searchParams.weeks) || 58, 4), 156);
  const weeks = Array.from({ length: n }, (_, i) => plan.week(i + 1));
  const bad = weeks.filter((w) => w.chkDup > 0 || w.chkBlank > 0 || w.chkSame > 0);
  return (
    <div>
      <div className="page-head">
        <h1>แผนรายสัปดาห์ (ใครอยู่จุดไหน)</h1>
        <span className="muted">
          ตารางรายเดือนทั้ง 3 ช่วงเวลาดึงข้อมูลจากแผนนี้ · เริ่มฝึกสัปดาห์ที่ {plan.B7} · หมุน 14 คนตั้งแต่สัปดาห์ที่ {plan.B9}
        </span>
      </div>
      <section className="card">
        <h2>ผลตรวจสอบ</h2>
        {bad.length === 0 ? (
          <p className="ok">ผ่านทั้งหมด — ไม่มีชื่อซ้ำกับสัปดาห์ก่อน ไม่มีชื่อซ้ำในสัปดาห์เดียวกัน และไม่มีจุดว่าง (สัปดาห์ที่ 1-{n})</p>
        ) : (
          <>
            <p className="warn">พบ {bad.length} สัปดาห์ที่ควรตรวจ (แถวที่ไฮไลต์ในตารางด้านล่าง)</p>
            <ul>
              {bad.map((w) => (
                <li key={w.week}>
                  สัปดาห์ที่ {w.week} ({fmt(w.monday)}): {w.chkDup > 0 && `ชื่อซ้ำในสัปดาห์เดียวกัน ${w.chkDup} จุด · `}
                  {w.chkBlank > 0 && `จุดว่าง ${w.chkBlank} จุด · `}
                  {w.chkSame > 0 && `ซ้ำกับสัปดาห์ก่อน ${w.chkSame} จุด`}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="muted">
          ตรวจ 3 อย่าง (เหมือนช่องตรวจสอบในชีต แผนรายสัปดาห์): ① ซ้ำกับสัปดาห์ก่อน = คนเดิมอยู่จุดเดิมติดกัน 2 สัปดาห์ ② ชื่อซ้ำในสัปดาห์เดียวกัน = คนเดียวอยู่ 2 จุด ③ จุดว่าง = จุดที่ไม่มีคน
          (สัปดาห์ก่อนวันเริ่มหรือคนลาออกไม่มีผู้แทน)
        </p>
      </section>
      <section className="card scroll-x">
        <table className="form plan">
          <thead>
            <tr>
              <th>สัปดาห์</th>
              <th>จันทร์ - ศุกร์</th>
              <th>หมุน</th>
              {PLAN_HEADERS_D_Q.map((h) => (
                <th key={h}>{h}</th>
              ))}
              <th>คู่สลับ กว.8</th>
              <th>คู่สลับ OPD11</th>
              <th>POCT สลับ</th>
              <th title="ซ้ำกับสัปดาห์ก่อน">ซ้ำสป.ก่อน</th>
              <th title="ชื่อซ้ำในสัปดาห์เดียวกัน">ซ้ำในสป.</th>
              <th title="จุดว่าง">จุดว่าง</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week} className={w.chkDup > 0 ? "rowbad" : w.chkBlank > 0 || w.chkSame > 0 ? "rowwarn" : ""}>
                <td>{w.week}</td>
                <td>
                  {fmt(w.monday)} - {fmt(w.friday)}
                </td>
                <td>{w.AL}</td>
                {w.s1.map((v, i) => (
                  <td key={i} className={v === "" ? "blank" : ""}>
                    {v}
                  </td>
                ))}
                <td>{w.R}</td>
                <td>{w.S}</td>
                <td>{w.BC}</td>
                <td className={w.chkSame > 0 ? "bad" : ""}>{w.chkSame}</td>
                <td className={w.chkDup > 0 ? "bad" : ""}>{w.chkDup}</td>
                <td className={w.chkBlank > 0 ? "bad" : ""}>{w.chkBlank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
