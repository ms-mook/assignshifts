import { NextResponse } from "next/server";
import { isLeaveTable, leaveSheetId } from "@/lib/leave-sync";
import { saveLeaveTabMonth, type LeaveForm } from "@/lib/leave-tab";

/** บันทึกการลาเฉพาะเดือน (แถวเดือนอื่นในแท็บ ลา-แลกเวร คงไว้) */
export async function POST(req: Request, { params }: { params: { table: string } }) {
  if (!isLeaveTable(params.table)) return NextResponse.json({ error: "ไม่มีตารางนี้" }, { status: 404 });
  try {
    const { rows, ym } = (await req.json()) as { rows: LeaveForm[]; ym: string };
    if (!Array.isArray(rows) || typeof ym !== "string") throw new Error("ข้อมูลไม่ครบ (rows, ym)");
    await saveLeaveTabMonth(leaveSheetId(params.table), ym, rows);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
