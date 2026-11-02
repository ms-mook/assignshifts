// ชื่อซ้ำในแถวเดียวกัน (พนักงาน 1 คนอยู่ได้ทีละจุด)
// อิงเงื่อนไขสีส้มในชีต: B8<>"", ไม่ขึ้นต้น จนท/⚠/→, ไม่ใช่ "ปิดจุด", COUNTIF($B8:$N8,B8)>1
// เว็บตรวจเข้มกว่าเล็กน้อย: ตัด " (แทน ...)" ออกก่อนเทียบ เพื่อจับคนเดียวกันที่อยู่ 2 จุด
/**
 * ตาราง OT ไม่เตือน/ไม่กันชื่อซ้ำ (ผู้ใช้กำหนด 2 พ.ย. 2569):
 * คนเดียวกันควบ 2 จุดได้ เช่น ช่วง 06.00-08.30 คู่กับช่วงทั้งวัน (เช้าจนเลิกงาน) ไม่ผิดกฎ
 */
export const OT_CHECK_DUPLICATES = false;

export const OT_ROW_COLS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

export function otPerson(v: string): string | null {
  const t = (v ?? "").trim();
  if (t === "" || t === "-" || t.startsWith("จนท") || t.startsWith("⚠") || t.startsWith("→") || t === "ปิดจุด") return null;
  const i = t.indexOf(" (แทน");
  return i >= 0 ? t.slice(0, i).trim() : t;
}

export function otDupCols(cells: Record<string, string>): Set<string> {
  if (!OT_CHECK_DUPLICATES) return new Set();
  const seen = new Map<string, string[]>();
  for (const c of OT_ROW_COLS) {
    const p = otPerson(cells[c] ?? "");
    if (p === null) continue;
    seen.set(p, [...(seen.get(p) ?? []), c]);
  }
  const out = new Set<string>();
  for (const cols of seen.values()) if (cols.length > 1) cols.forEach((c) => out.add(c));
  return out;
}

export function otConflictMessage(cells: Record<string, string>, col: string, value: string, day: number): string | null {
  if (!OT_CHECK_DUPLICATES) return null;
  const p = otPerson(value);
  if (p === null) return null;
  for (const c of OT_ROW_COLS) {
    if (c === col) continue;
    if (otPerson(cells[c] ?? "") === p)
      return `"${p}" อยู่ในช่อง ${c} ของวันที่ ${day} แล้ว (พนักงาน 1 คนอยู่ได้ทีละจุด) กรุณาเอาออกจากช่อง ${c} ก่อน`;
  }
  return null;
}
