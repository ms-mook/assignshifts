import { NextResponse } from "next/server";
import { saveOtSettings, type OtSettingsForm } from "@/lib/ot/repo";

const DATE = /^(\d{4}-\d{2}-\d{2})?$/;

export async function POST(req: Request) {
  try {
    const f = (await req.json()) as OtSettingsForm;
    const dates = [f.startMonday, f.eightStart, f.smcOpen, ...f.staff.flatMap((s) => [s.start, s.last, s.repStart]), ...f.holidays.map((h) => h.date)];
    if (!dates.every((d) => typeof d === "string" && DATE.test(d))) return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    if (!f.startMonday || !f.eightStart || !f.smcOpen) return NextResponse.json({ error: "กรุณากรอกวันเริ่มตาราง วันเริ่มเวียน 8 จุด และวันเปิดบัตรคิว SMC" }, { status: 400 });
    await saveOtSettings(f);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
