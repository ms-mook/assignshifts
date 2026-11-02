// สรุปจำนวนวันทำงานของแต่ละคน รายปี (ชีต สรุป) + ความเป็นธรรมของการหมุนเวียน
import { computeKeyMonth } from "@/lib/key/engine";
import { loadKey, loadKeyManyMonths } from "@/lib/key/repo";
import { ymdFromSerial } from "@/lib/sheets-date";

export const dynamic = "force-dynamic";

export default async function KeyPlanPage() {
  const s = await loadKey();
  // ชีตเดิมนับ 12 แท็บ ธ.ค.69–พ.ย.70: เว็บนับ 12 เดือนเริ่มจากเดือนของสัปดาห์แรกในรอบเวียน (ตั้งค่า B3 + 6 วัน)
  const st = ymdFromSerial(s.rotStart + 6);
  const months = Array.from({ length: 12 }, (_, i) => {
    const k = st.y * 12 + st.m - 1 + i;
    return { y: Math.floor(k / 12) + 543, m: (k % 12) + 1 };
  });
  const manuals = await loadKeyManyMonths(s, months);
  const res = months.map(({ y, m }) => computeKeyMonth(s, manuals[`${y}-${String(m).padStart(2, "0")}`] ?? {}, y, m));
  const eqi = (a: string, b: string) => a !== "" && a.toLowerCase() === b.toLowerCase();
  const count = (name: string, cols: string[]) => res.reduce((n, mm) => n + mm.rows.reduce((k, r) => k + cols.filter((c) => eqi(r.cells[c] ?? "", name)).length, 0), 0);
  const names = Array.from({ length: 20 }, (_, i) => s.dropdown[i] ?? "").filter((n) => n !== "");
  const rows = names.map((name) => {
    const c = ["D", "E", "F", "L", "M"].map((col) => count(name, [col]));
    const H = count(name, ["B", "C", "D", "E", "F", "H", "I", "J", "K", "L", "M", "N", "O"]);
    return { name, c, G: H - c.reduce((a, b) => a + b, 0), H };
  });
  const rotTotals = s.rot.map((n) => rows.filter((r) => r.name === n).reduce((a, r) => a + r.H, 0));
  const mx = Math.max(...rotTotals), mn = Math.min(...rotTotals);
  const label = `${months[0].m}/${months[0].y} – ${months[11].m}/${months[11].y}`;
  return (
    <div>
      <div className="page-head">
        <h1>สรุปจำนวนวันทำงานของแต่ละคน — ตาราง Key</h1>
        <span className="muted">นับจากชื่อในตารางเดือนทั้ง 12 เดือน ({label}) รวมชื่อที่เลือกทับ · หน่วย = วัน</span>
      </div>
      <section className="card scroll-x">
        <table className="form plan">
          <thead><tr><th>พนักงาน</th><th>OPD Key3(E)</th><th>OPD Key4</th><th>OPD Key5</th><th>กว. Key3(E)</th><th>กว. Key4 (SMC)</th><th>Key1/Key2/จนท.แทน</th><th>รวมวัน</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}><td>{r.name}</td>{r.c.map((v, i) => <td key={i}>{v}</td>)}<td>{r.G}</td><td><b>{r.H}</b></td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted">{s.dropdown.filter((x) => x !== "").length > 20 ? "⚠ รายชื่อใน dropdown มีมากกว่า 20 คน ตารางสรุปแสดงได้ 20 คน" : "✓ ครอบคลุมรายชื่อทั้งหมด"}</p>
      </section>
      <section className="card">
        <h2>ความเป็นธรรมของการหมุนเวียน (เฉพาะคนในสายหมุนเวียน 4 คน)</h2>
        <div className="grid2">
          <label>วันทำงานสูงสุด</label><span>{mx}</span>
          <label>วันทำงานต่ำสุด</label><span>{mn}</span>
          <label>ส่วนต่าง (วัน)</label><span>{mx - mn}</span>
          <label>สถานะ</label><span className={mx - mn > s.threshold ? "error" : "ok"}>{mx - mn > s.threshold ? `⚠ เกินเกณฑ์ (${s.threshold} วัน)` : "✓ อยู่ในเกณฑ์"}</span>
        </div>
      </section>
    </div>
  );
}
