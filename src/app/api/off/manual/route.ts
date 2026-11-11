import { NextResponse } from "next/server";
import { parseYm } from "@/lib/config";
import { isOffKey, saveOffManual } from "@/lib/off/repo";

// ตารางเวรนอกเวลา: ชีตไม่มีกฎห้ามชื่อซ้ำ (มีแค่ไฮไลต์ชมพูเมื่อชื่อซ้ำในคอลัมน์) → บันทึกได้เลย ไม่ตรวจซ้ำ
function parseEntries(b: { entries?: unknown }): { key: string; value: string | null }[] | null {
  if (!Array.isArray(b.entries)) return null;
  const out: { key: string; value: string | null }[] = [];
  for (const e of b.entries as { key?: unknown; value?: unknown }[]) {
    if (!e || typeof e.key !== "string" || !isOffKey(e.key)) return [];
    out.push({ key: e.key, value: e.value === null || e.value === undefined ? null : String(e.value) });
  }
  return out.length > 0 && out.length <= 1200 ? out : [];
}

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { ym: string; key?: string; keys?: string[]; value: string | null; entries?: unknown };
    const p = parseYm(b.ym);
    const entries = parseEntries(b);
    if (entries !== null) {
      if (!p || entries.length === 0) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
      await saveOffManual(p.yearBE, p.month, entries);
      return NextResponse.json({ ok: true });
    }
    const keys = Array.isArray(b.keys) ? b.keys : typeof b.key === "string" ? [b.key] : [];
    if (!p || keys.length === 0 || keys.length > 1200 || !keys.every(isOffKey)) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const v = b.value === null || b.value === undefined ? null : String(b.value);
    if (keys.length > 1 && v !== null && v !== "")
      return NextResponse.json({ error: "การแก้หลายช่องพร้อมกันทำได้เฉพาะ ล้างให้ว่าง หรือ คืนค่าสูตร" }, { status: 400 });
    await saveOffManual(p.yearBE, p.month, keys.map((key) => ({ key, value: v })));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
