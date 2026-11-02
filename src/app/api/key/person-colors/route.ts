import { NextResponse } from "next/server";
import { saveKeyPersonColors } from "@/lib/key/repo";

const COLOR = /^#[0-9a-fA-F]{6}$/;

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { colors: Record<string, string> };
    const colors: Record<string, string> = {};
    for (const [n, c] of Object.entries(b.colors ?? {})) {
      if (typeof c !== "string" || !COLOR.test(c)) return NextResponse.json({ error: `สีของ ${n} ไม่ถูกต้อง` }, { status: 400 });
      if (n.trim() !== "") colors[n.trim()] = c;
    }
    await saveKeyPersonColors(colors);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
