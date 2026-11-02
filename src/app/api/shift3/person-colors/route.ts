import { NextResponse } from "next/server";
import { savePersonColors } from "@/lib/shift3/repo";

export async function POST(req: Request) {
  try {
    const { colors } = (await req.json()) as { colors: Record<string, string> };
    if (!colors || typeof colors !== "object") return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const clean: Record<string, string> = {};
    for (const [n, c] of Object.entries(colors)) {
      if (n.trim() === "" || !/^#[0-9a-fA-F]{6}$/.test(c)) continue;
      clean[n.trim()] = c;
    }
    await savePersonColors(clean);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
