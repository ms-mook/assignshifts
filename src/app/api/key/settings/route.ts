import { NextResponse } from "next/server";
import { saveKeyForm, type KeyForm } from "@/lib/key/repo";

const DATE = /^(\d{4}-\d{2}-\d{2})?$/;

/** { form, part: "settings" | "leaves" } */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { form: KeyForm; part: "settings" | "leaves" };
    const f = b.form;
    if (b.part !== "settings" && b.part !== "leaves") return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const dates = [f.rotStart, ...f.holidays.map((h) => h.date), ...f.leaves.map((l) => l.date)];
    if (!dates.every((d) => typeof d === "string" && DATE.test(d))) return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    if (b.part === "settings" && !f.rotStart) return NextResponse.json({ error: "กรุณากรอกวันเริ่มรอบเวียน" }, { status: 400 });
    await saveKeyForm(f, b.part);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
