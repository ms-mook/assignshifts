import { NextResponse } from "next/server";
import { isLeaveTable, syncAllLeaves } from "@/lib/leave-sync";

/** ดึงการลาจากระบบลาอีกครั้งทันที เฉพาะเดือนที่ระบุ (ym = ปี พ.ศ.-เดือน เช่น 2569-12) */
export async function POST(req: Request, { params }: { params: { table: string } }) {
  if (!isLeaveTable(params.table)) return NextResponse.json({ error: "ไม่มีตารางนี้" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { ym?: string };
  // ดึงครั้งเดียว → เข้าแท็บ ลา-แลกเวร ครบทั้ง 4 ชีต · ตอบผลของตารางที่กดเป็นหลัก + ผลทุกชีต
  const all = await syncAllLeaves(typeof body.ym === "string" ? body.ym : undefined, true);
  const r = all[params.table];
  return NextResponse.json({ ...r, all }, { status: r.error ? 502 : 200 });
}
