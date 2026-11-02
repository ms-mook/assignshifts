import { NextResponse } from "next/server";
import { saveSmcForm, type SmcForm } from "@/lib/smc/repo";

const DATE = /^(\d{4}-\d{2}-\d{2})?$/;

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { form: SmcForm; part: "settings" | "leaves" };
    const f = b.form;
    if (b.part !== "settings" && b.part !== "leaves") return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const dates = [...f.holidays.map((h) => h.date), ...f.leaves.flatMap((l) => [l.start, l.end])];
    if (!dates.every((d) => typeof d === "string" && DATE.test(d))) return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    if (b.part === "leaves" && f.leaves.some((l) => l.end && l.start && l.end < l.start))
      return NextResponse.json({ error: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม" }, { status: 400 });
    await saveSmcForm(f, b.part);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
