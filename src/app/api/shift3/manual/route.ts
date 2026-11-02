import { NextResponse } from "next/server";
import { parseYm } from "@/lib/config";
import { saveManual } from "@/lib/shift3/repo";

export async function POST(req: Request) {
  try {
    const { ym, key, value } = (await req.json()) as { ym: string; key: string; value: string | null };
    const p = parseYm(ym);
    if (!p || typeof key !== "string") return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    await saveManual(p.yearBE, p.month, key, value === null ? null : String(value));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
