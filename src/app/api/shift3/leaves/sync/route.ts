import { NextResponse } from "next/server";
import { syncLeaveSystem } from "@/lib/shift3/repo";

/** ดึงการลาจากระบบลาอีกครั้งทันที */
export async function POST() {
  const r = await syncLeaveSystem({ force: true });
  return NextResponse.json(r, { status: r.error ? 502 : 200 });
}
