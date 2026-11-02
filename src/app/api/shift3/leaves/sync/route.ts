import { NextResponse } from "next/server";
import { syncLeaveSystem } from "@/lib/shift3/repo";

/** ดึงการลาจากระบบลาอีกครั้งทันที เฉพาะเดือนที่ระบุ (ym = ปี พ.ศ.-เดือน เช่น 2569-12) */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { ym?: string };
  const r = await syncLeaveSystem({ force: true, ym: typeof body.ym === "string" ? body.ym : undefined });
  return NextResponse.json(r, { status: r.error ? 502 : 200 });
}
