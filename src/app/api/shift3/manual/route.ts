import { NextResponse } from "next/server";
import { parseYm } from "@/lib/config";
import { saveManualMany, validateManual } from "@/lib/shift3/repo";

const KEY = /^[123]:[A-Z]{1,2}:\d{1,2}$/;

/**
 * บันทึกช่องที่ผู้จัดแก้เอง
 *  - 1 ช่อง:  { ym, key, value }  (value = null คืนค่าสูตร) — ตรวจชื่อซ้ำในแถวก่อนบันทึก
 *  - หลายช่อง: { ym, keys, value } เฉพาะ value = null (คืนค่าสูตร) หรือ "" (ล้างให้ว่าง)
 */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { ym: string; key?: string; keys?: string[]; value: string | null };
    const p = parseYm(b.ym);
    const keys = Array.isArray(b.keys) ? b.keys : typeof b.key === "string" ? [b.key] : [];
    if (!p || keys.length === 0 || keys.length > 1200 || !keys.every((k) => KEY.test(k)))
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const v = b.value === null ? null : String(b.value);
    if (keys.length > 1 && v !== null && v !== "")
      return NextResponse.json({ error: "การแก้หลายช่องพร้อมกันทำได้เฉพาะ ล้างให้ว่าง หรือ คืนค่าสูตร" }, { status: 400 });
    if (keys.length === 1) {
      const conflict = await validateManual(p.yearBE, p.month, keys[0], v);
      if (conflict) return NextResponse.json({ error: conflict, conflict: true }, { status: 409 });
    }
    await saveManualMany(p.yearBE, p.month, keys.map((key) => ({ key, value: v })));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
