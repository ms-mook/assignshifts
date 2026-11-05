import { NextResponse } from "next/server";
import { checkMonth } from "@/lib/system-check";

export const dynamic = "force-dynamic";
// อ่าน 4 ชีตพร้อมกัน — เผื่อเวลาเกินค่าเริ่มต้น
export const maxDuration = 60;

/** ตรวจทั้งระบบ (6 ตาราง) ของเดือน ym (ปี พ.ศ.-เดือน เช่น 2569-11) */
export async function GET(req: Request) {
  const ym = new URL(req.url).searchParams.get("ym") ?? "";
  try {
    return NextResponse.json(await checkMonth(ym));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
