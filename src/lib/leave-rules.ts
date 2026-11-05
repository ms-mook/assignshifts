// กฎตรวจแถวการลา/แลกเวร (ใช้ทั้งหน้าเว็บและตอนบันทึก) — ทุกตารางใช้กฎเดียวกัน
export interface LeaveRowLike {
  date: string;
  name: string;
  replacement: string;
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * ปัญหาของแต่ละแถว (index → ข้อความ) ที่ห้ามบันทึก:
 *  - คนมาแทนเป็นคนเดียวกับคนลา
 *  - คนมาแทนลาในวันเดียวกัน (มีแถวลาของคนนั้นวันนั้น)
 */
export function leaveRowProblems(rows: LeaveRowLike[]): Map<number, string> {
  const out = new Map<number, string>();
  const onLeave = new Set(rows.filter((r) => r.date && r.name.trim()).map((r) => `${r.date}|${norm(r.name)}`));
  rows.forEach((r, i) => {
    const sub = r.replacement.trim();
    if (!sub) return;
    if (r.name.trim() && norm(sub) === norm(r.name)) out.set(i, `คนมาแทนต้องไม่ใช่ ${r.name.trim()} (คนลาเอง)`);
    else if (r.date && onLeave.has(`${r.date}|${norm(sub)}`)) out.set(i, `${sub} ลาวันที่ ${r.date} เอง จึงมาแทนไม่ได้`);
  });
  return out;
}

/** โยนข้อผิดพลาดถ้ามีแถวผิดกฎ (ฝั่งเซิร์ฟเวอร์) */
export function assertLeaveRows(rows: LeaveRowLike[]): void {
  const p = leaveRowProblems(rows);
  if (p.size === 0) return;
  const msgs = Array.from(p.entries()).slice(0, 5).map(([i, m]) => `${rows[i].date || "(ไม่มีวันที่)"} ${rows[i].name}: ${m}`);
  throw new Error(`บันทึกไม่ได้ — ${msgs.join(" · ")}${p.size > 5 ? ` · และอีก ${p.size - 5} แถว` : ""}`);
}
