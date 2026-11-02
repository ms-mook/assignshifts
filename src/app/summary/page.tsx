// สรุปความเท่าเทียมของการเวียนจุด (นับเป็นสัปดาห์) — แปลจากแท็บ "สรุป" ในชีต 1:1
//   A6:A19  ='ตั้งค่า'!B13..B26
//   B..O    =COUNTIFS('แผนรายสัปดาห์'!D..Q, ชื่อ, 'แผนรายสัปดาห์'!B (วันจันทร์), ">="&B2, "<="&B3)
//   P = B..H + O (รวม OPD) · Q = I..L (รวม กว.) · R = M+N (รวม SMC) · S = SUM(B:O)
//   B22:B24 = SUM ช่องตรวจ DD/DE/DF ของแผน · B25 = MAX(S6:S18)-MIN(S6:S18)
import { PlanCalculator } from "@/lib/shift3/engine";
import { loadShift3, loadShift3SummaryRange } from "@/lib/shift3/repo";
import { isoFromSerial, ymdFromSerial } from "@/lib/sheets-date";
import OtSummaryRange from "@/components/OtSummaryRange";

export const dynamic = "force-dynamic";

const HEAD = ["OPD Key2", "OPD สว.6", "OPD สว.7", "OPD ทั่วไป12", "OPD เด็ก14", "OPD รถ15", "OPD รถ16", "กว. Key1", "กว. สว./ผส.7", "กว. เด็ก10", "กว. รถ11", "SMC KEY2", "SMC เจาะ1", "OPD ทั่วไป13"];
const ROOM = ["o", "o", "o", "o", "o", "o", "o", "k", "k", "k", "k", "s", "s", "o"];
const fmt = (n: number) => {
  const d = ymdFromSerial(n);
  return `${d.d}/${d.m}/${d.y + 543}`;
};

export default async function SummaryPage() {
  const [data, range] = await Promise.all([loadShift3(), loadShift3SummaryRange()]);
  const s = data.settings;
  const plan = new PlanCalculator(s);
  const from = range.from ?? s.startMonday;
  const to = range.to ?? s.startMonday + 7 * 52;
  // แผนในชีตมี 58 สัปดาห์ (แถว 5:62) — เว็บนับต่อให้ถ้าช่วงยาวกว่านั้น
  const lastWeek = Math.max(58, Math.floor((to - s.startMonday) / 7) + 1);
  const weeks = Array.from({ length: lastWeek }, (_, i) => plan.week(i + 1));
  const inRange = weeks.filter((w) => w.monday >= from && w.monday <= to);
  const eq = (a: string, b: string) => a !== "" && a.toLowerCase() === b.toLowerCase();
  const rows = s.persons.map((p) => {
    const name = p.name;
    const c = HEAD.map((_, k) => (name === "" ? 0 : inRange.filter((w) => eq(w.s1[k] ?? "", name)).length));
    const opd = c[0] + c[1] + c[2] + c[3] + c[4] + c[5] + c[6] + c[13];
    const kw = c[7] + c[8] + c[9] + c[10];
    const smc = c[11] + c[12];
    return { name, c, opd, kw, smc, total: c.reduce((a, b) => a + b, 0) };
  });
  const chkSame = weeks.reduce((a, w) => a + w.chkSame, 0);
  const chkDup = weeks.reduce((a, w) => a + w.chkDup, 0);
  const chkBlank = weeks.reduce((a, w) => a + w.chkBlank, 0);
  const t13 = rows.slice(0, 13).filter((r) => r.name !== "").map((r) => r.total);
  const spread = t13.length ? Math.max(...t13) - Math.min(...t13) : 0;
  // ไล่สีตามจำนวน (มากกว่าค่าเฉลี่ยของคอลัมน์ = เข้มขึ้น) เพื่อดูความเท่าเทียมง่ายขึ้น
  const colMax = HEAD.map((_, k) => Math.max(1, ...rows.map((r) => r.c[k])));
  const checks: [string, number][] = [
    ["อยู่จุดเดิมซ้ำ 2 สัปดาห์ติดกัน", chkSame],
    ["มีชื่อซ้ำในสัปดาห์เดียวกัน", chkDup],
    ["จุดที่ไม่มีคน (ช่วงเช้า)", chkBlank],
    ["ส่วนต่างมากสุด-น้อยสุด ของรวมสัปดาห์ (13 คน)", spread],
  ];
  return (
    <div>
      <div className="page-head">
        <h1>สรุปความเท่าเทียมของการเวียนจุด</h1>
        <span className="muted">นับเป็นสัปดาห์ จากแผนรายสัปดาห์ ช่วงเช้า · {inRange.length} สัปดาห์ ({fmt(from)} – {fmt(to)})</span>
      </div>
      <section className="card">
        <h2>ช่วงที่นับ <small>สรุป!B2:B3</small></h2>
        <OtSummaryRange from={isoFromSerial(from)} to={isoFromSerial(to)} api="/api/shift3/summary" />
      </section>
      <section className="card scroll-x">
        <h2>จำนวนสัปดาห์ที่แต่ละคนอยู่แต่ละจุด</h2>
        <table className="form plan sumtbl">
          <thead>
            <tr>
              <th>พนักงาน</th>
              {HEAD.map((h, k) => (
                <th key={h} className={`r-${ROOM[k]}`}>{h}</th>
              ))}
              <th className="tot">รวม OPD</th>
              <th className="tot">รวม กว.</th>
              <th className="tot">รวม SMC</th>
              <th className="tot">รวมสัปดาห์</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) =>
              r.name === "" ? null : (
                <tr key={i} className={i === 13 ? "newbie" : undefined}>
                  <td className="nm">{r.name}</td>
                  {r.c.map((v, k) => (
                    <td key={k} className="num" style={{ background: v === 0 ? "#fff" : `rgba(31, 58, 104, ${(0.06 + 0.3 * (v / colMax[k])).toFixed(3)})` }}>
                      {v}
                    </td>
                  ))}
                  <td className="num tot">{r.opd}</td>
                  <td className="num tot">{r.kw}</td>
                  <td className="num tot">{r.smc}</td>
                  <td className="num tot">{r.total}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        <p className="muted small">แถวพนักงานใหม่ (ตั้งค่า แถว 26) ไม่นับในส่วนต่างมากสุด-น้อยสุด ตามชีตเดิม</p>
      </section>
      <section className="card">
        <h2>ตรวจสอบการคำนวณ <small>ต้องเป็น 0 ทุกช่อง</small></h2>
        <div className="sum-checks">
          {checks.map(([label, v]) => (
            <div key={label} className={v === 0 ? "sum-check ok" : "sum-check bad"}>
              <span>{label}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
