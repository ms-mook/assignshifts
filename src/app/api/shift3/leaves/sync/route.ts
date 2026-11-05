import { NextResponse } from "next/server";
import { syncAllLeaves } from "@/lib/leave-sync";

/** ดึงการลาจากระบบลาอีกครั้งทันที เฉพาะเดือนที่ระบุ → เข้าแท็บ ลา-แลกเวร ครบทั้ง 4 ชีต */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { ym?: string };
  const all = await syncAllLeaves(typeof body.ym === "string" ? body.ym : undefined, true);
  const r = all.shift3;
  return NextResponse.json({ ...r, all }, { status: r.error ? 502 : 200 });
}
