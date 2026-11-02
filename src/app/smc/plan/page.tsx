// สรุปจำนวนวันทำงานรายบุคคล ทั้งปี (ชีต สรุปรายปี)
import { computeSmcMonth } from "@/lib/smc/engine";
import { loadSmc, loadSmcManyMonths } from "@/lib/smc/repo";
import { MONTH_SHORT, parseYm } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function SmcPlanPage({ searchParams }: { searchParams: { from?: string } }) {
  const s = await loadSmc();
  // ชีตเดิม: 12 แท็บ ธ.ค.69–พ.ย.70 · เว็บ: เลือกเดือนเริ่มได้ (?from=2569-12) ค่าเริ่มต้น ธ.ค.69
  const p = parseYm(searchParams.from ?? "") ?? { yearBE: 2569, month: 12 };
  const months = Array.from({ length: 12 }, (_, i) => {
    const k = p.yearBE * 12 + p.month - 1 + i;
    return { y: Math.floor(k / 12), m: (k % 12) + 1 };
  });
  const manuals = await loadSmcManyMonths(s, months);
  const res = months.map(({ y, m }) => computeSmcMonth(s, manuals[`${y}-${String(m).padStart(2, "0")}`] ?? {}, y, m));
  const names = s.listL.filter((n) => n !== "");
  const work = res.map((r) => r.workdays);
  const rows = names.map((name) => {
    const v = res.map((r) => r.people.find((x) => x.name === name)?.days ?? 0);
    const t = v.reduce((a, b) => a + b, 0);
    return { name, v, t };
  });
  const head = months.map(({ y, m }) => `${MONTH_SHORT[m - 1]}${y % 100}`);
  const avg = (n: number) => (Math.round((n / 12) * 10) / 10).toFixed(1);
  return (
    <div>
      <div className="page-head">
        <h1>สรุปจำนวนวันทำงานรายบุคคล ทั้งปี — ตาราง SMC ({head[0]} – {head[11]})</h1>
        <span className="muted">นับ 1 วันต่อคน เมื่อมีชื่อในตารางเวรวันนั้น (แม้อยู่หลายช่อง) · รายชื่อมาจากตั้งค่า (คอลัมน์ L) · เปลี่ยนเดือนเริ่มได้ด้วย ?from=2570-12</span>
      </div>
      <section className="card scroll-x">
        <table className="form plan">
          <thead><tr><th>พนักงาน</th>{head.map((h) => <th key={h}>{h}</th>)}<th>รวมทั้งปี</th><th>เฉลี่ย/เดือน</th></tr></thead>
          <tbody>
            <tr><td><b>วันทำการ (ไม่รวมวันหยุด)</b></td>{work.map((w, i) => <td key={i}>{w}</td>)}<td>{work.reduce((a, b) => a + b, 0)}</td><td>{avg(work.reduce((a, b) => a + b, 0))}</td></tr>
            {rows.map((r) => (
              <tr key={r.name}><td>{r.name}</td>{r.v.map((x, i) => <td key={i}>{x}</td>)}<td><b>{r.t}</b></td><td>{avg(r.t)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
