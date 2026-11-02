import { NextResponse } from "next/server";
import { parseYm } from "@/lib/config";
import { isSmcKey, saveSmcManual, validateSmcManual } from "@/lib/smc/repo";

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { ym: string; key?: string; keys?: string[]; value: string | null };
    const p = parseYm(b.ym);
    const keys = Array.isArray(b.keys) ? b.keys : typeof b.key === "string" ? [b.key] : [];
    if (!p || keys.length === 0 || keys.length > 1200 || !keys.every(isSmcKey))
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const v = b.value === null ? null : String(b.value);
    if (keys.length > 1 && v !== null && v !== "")
      return NextResponse.json({ error: "การแก้หลายช่องพร้อมกันทำได้เฉพาะ ล้างให้ว่าง หรือ คืนค่าสูตร" }, { status: 400 });
    if (keys.length === 1) {
      const conflict = await validateSmcManual(p.yearBE, p.month, keys[0], v);
      if (conflict) return NextResponse.json({ error: conflict, conflict: true }, { status: 409 });
    }
    await saveSmcManual(p.yearBE, p.month, keys.map((key) => ({ key, value: v })));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
