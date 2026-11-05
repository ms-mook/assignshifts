import { NextResponse } from "next/server";
import { isLeaveTable, syncLeaves } from "@/lib/leave-sync";

/** ดึงการลาจากระบบลาอีกครั้งทันที เฉพาะเดือนที่ระบุ (ym = ปี พ.ศ.-เดือน เช่น 2569-12) */
export async function POST(req: Request, { params }: { params: { table: string } }) {
  if (!isLeaveTable(params.table)) return NextResponse.json({ error: "ไม่มีตารางนี้" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { ym?: string };
  const r = await syncLeaves(params.table, typeof body.ym === "string" ? body.ym : undefined, true);
  return NextResponse.json(r, { status: r.error ? 502 : 200 });
}
