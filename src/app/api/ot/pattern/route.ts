import { NextResponse } from "next/server";
import { stepOtPattern } from "@/lib/ot/repo";

/** เหมือนเมนู Apps Script "สลับเวียน → รูปแบบถัดไป / ← รูปแบบก่อนหน้า" */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { dir: 1 | -1 };
    if (b.dir !== 1 && b.dir !== -1) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const pattern = await stepOtPattern(b.dir);
    return NextResponse.json({ ok: true, pattern });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
