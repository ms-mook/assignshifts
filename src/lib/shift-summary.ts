// สรุปจำนวนเวรที่แต่ละคนได้รับในเดือน (นับ 1 ช่อง = 1 เวร ไม่คิดเป็นชั่วโมง)
export interface SummaryGroup {
  title: string;
  rows: { name: string; count: number; counts?: number[] }[];
  /** ตารางหลายคอลัมน์ (เช่น ตารางเวรนอกเวลา: OPD / SMC / รวม / Key 1 …) — ค่าอยู่ใน rows[].counts */
  cols?: string[];
}

/**
 * groups: กลุ่มรายชื่อที่ต้องแสดง (แสดงครบแม้ได้ 0 เวร)
 * ชื่อที่พบในตารางแต่ไม่อยู่ในกลุ่มใด → กลุ่ม "อื่น ๆ"
 */
export function summarizeShifts(
  cellValues: string[],
  person: (v: string) => string | null,
  groups: { title: string; names: string[] }[],
): SummaryGroup[] {
  const count = new Map<string, number>();
  for (const v of cellValues) {
    const p = person(v ?? "");
    if (p) count.set(p, (count.get(p) ?? 0) + 1);
  }
  const seen = new Set<string>();
  const out: SummaryGroup[] = groups.map((g) => {
    const names = Array.from(new Set(g.names.map((n) => n.trim()).filter((n) => n !== "" && !seen.has(n))));
    names.forEach((n) => seen.add(n));
    return { title: g.title, rows: names.map((name) => ({ name, count: count.get(name) ?? 0 })) };
  });
  const others = [...count.entries()].filter(([n]) => !seen.has(n)).map(([name, c]) => ({ name, count: c }));
  if (others.length) out.push({ title: "อื่น ๆ", rows: others });
  return out.filter((g) => g.rows.length > 0);
}
