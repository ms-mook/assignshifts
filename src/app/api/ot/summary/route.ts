import { NextResponse } from "next/server";
import { saveOtSummaryRange } from "@/lib/ot/repo";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { from: string; to: string };
    if (!DATE.test(b.from) || !DATE.test(b.to)) return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    await saveOtSummaryRange(b.from, b.to);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
