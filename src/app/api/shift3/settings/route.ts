import { NextResponse } from "next/server";
import { saveSettings, type Shift3SettingsForm } from "@/lib/shift3/repo";

export async function POST(req: Request) {
  try {
    const form = (await req.json()) as Shift3SettingsForm;
    await saveSettings(form);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
