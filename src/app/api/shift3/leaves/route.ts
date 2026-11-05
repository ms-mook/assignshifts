import { NextResponse } from "next/server";
import { saveLeaves, saveLeavesMonth, type LeaveForm } from "@/lib/shift3/repo";

export async function POST(req: Request) {
  try {
    const { rows, ym } = (await req.json()) as { rows: LeaveForm[]; ym?: string };
    // มี ym = แก้เฉพาะเดือนนั้น (เดือนอื่นคงไว้) · ไม่มี ym = เขียนทั้งตาราง (แบบเดิม)
    if (ym) await saveLeavesMonth(ym, rows);
    else await saveLeaves(rows);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
