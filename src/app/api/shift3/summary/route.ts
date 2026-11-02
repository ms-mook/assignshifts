import { NextResponse } from "next/server";
import { saveShift3SummaryRange } from "@/lib/shift3/repo";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** บันทึกช่วงของหน้าสรุป (สรุป!B2:B3) */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { from: string; to: string };
    if (!DATE.test(b.from) || !DATE.test(b.to)) return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    if (b.from > b.to) return NextResponse.json({ error: "วันเริ่มต้องไม่เกินวันสิ้นสุด" }, { status: 400 });
    await saveShift3SummaryRange(b.from, b.to);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
