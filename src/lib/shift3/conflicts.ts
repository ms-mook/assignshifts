// กันชื่อซ้ำในแถวเดียวกัน (พนักงานคนเดียวอยู่ได้ทีละจุด)
// ใช้ได้ทั้งฝั่ง server (ตรวจก่อนบันทึก) และตอนวาดตาราง (ไฮไลต์แดง)

import { colLetter } from "./engine";

const NOT_A_PERSON = new Set(["", "-", "จนท.", "chem", "molec"]);

/**
 * ชื่อคนที่อยู่ในช่อง (หรือ null ถ้าไม่ใช่ชื่อคน)
 *  "⚠ X ลา" / "→ ไปช่วยจุดอื่น" = ไม่นับ (ไม่ได้อยู่จุดนี้)
 *  "Y (แทน X)" = Y เป็นคนทำงาน
 */
export function cellPerson(v: string): string | null {
  const t = v.trim();
  if (t.includes("⚠") || t.includes("→")) return null;
  const i = t.indexOf("(แทน");
  const name = (i >= 0 ? t.slice(0, i) : t).trim();
  return NOT_A_PERSON.has(name.toLowerCase()) ? null : name;
}

/** ดัชนีคอลัมน์ (1..36) ที่มีชื่อซ้ำกับช่องอื่นในแถวเดียวกัน */
export function duplicateCols(cells: string[]): Set<number> {
  const seen = new Map<string, number[]>();
  for (let c = 1; c < cells.length; c++) {
    const p = cellPerson(cells[c]);
    if (p === null) continue;
    const k = p.toLowerCase();
    seen.set(k, [...(seen.get(k) ?? []), c]);
  }
  const out = new Set<number>();
  for (const cols of seen.values()) if (cols.length > 1) cols.forEach((c) => out.add(c));
  return out;
}

/** ถ้าใส่ name ที่ช่อง col แล้วซ้ำกับช่องอื่นในแถว คืนข้อความอธิบาย ไม่ซ้ำคืน null */
export function conflictMessage(cells: string[], col: number, name: string, day: number): string | null {
  const p = cellPerson(name);
  if (p === null) return null;
  for (let c = 1; c < cells.length; c++) {
    if (c === col) continue;
    const q = cellPerson(cells[c]);
    if (q !== null && q.toLowerCase() === p.toLowerCase()) {
      return `"${p}" อยู่ในช่อง ${colLetter(c)} ของวันที่ ${day} แล้ว (พนักงาน 1 คนอยู่ได้ทีละจุด) กรุณาเอาออกจากช่อง ${colLetter(c)} ก่อน`;
    }
  }
  return null;
}
