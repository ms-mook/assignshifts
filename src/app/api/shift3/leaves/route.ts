import { NextResponse } from "next/server";
import { saveLeaves, type LeaveForm } from "@/lib/shift3/repo";

export async function POST(req: Request) {
  try {
    const { rows } = (await req.json()) as { rows: LeaveForm[] };
    await saveLeaves(rows);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
