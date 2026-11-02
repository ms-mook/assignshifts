import { NextResponse } from "next/server";
import { parseYm } from "@/lib/config";
import { isKeyKey, saveKeyStyles } from "@/lib/key/repo";

const COLOR = /^#[0-9a-fA-F]{6}$/;

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { ym: string; keys: string[]; bg?: string | null; fg?: string | null; clear?: boolean };
    const p = parseYm(b.ym);
    if (!p || !Array.isArray(b.keys) || b.keys.length === 0 || b.keys.length > 1200 || !b.keys.every(isKeyKey))
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    for (const c of [b.bg, b.fg]) if (c !== undefined && c !== null && !COLOR.test(c)) return NextResponse.json({ error: "รูปแบบสีไม่ถูกต้อง" }, { status: 400 });
    await saveKeyStyles(p.yearBE, p.month, b.keys, { bg: b.bg, fg: b.fg, clear: b.clear === true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
