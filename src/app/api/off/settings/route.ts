import { NextResponse } from "next/server";
import { saveOffSettings } from "@/lib/off/repo";
import { validateOffSettings, type OffSettingsForm } from "@/lib/off/settings";

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { form?: OffSettingsForm };
    const f = b.form;
    if (!f || !Array.isArray(f.staff) || !Array.isArray(f.spots) || !Array.isArray(f.holidays) || typeof f.lists !== "object" || f.lists === null)
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const err = validateOffSettings(f);
    if (err.length) return NextResponse.json({ error: err.join(" · "), errors: err }, { status: 400 });
    const r = await saveOffSettings(f);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
