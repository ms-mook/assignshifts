import { NextResponse } from "next/server";
import { saveOtLeaves, type OtLeaveForm } from "@/lib/ot/repo";

const DATE = /^(\d{4}-\d{2}-\d{2})?$/;

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { rows: OtLeaveForm[] };
    const rows = (b.rows ?? []).filter((r) => r.date || r.who || r.sub || r.type);
    if (!rows.every((r) => DATE.test(r.date ?? ""))) return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    await saveOtLeaves(rows.map((r) => ({ date: r.date ?? "", who: r.who ?? "", sub: r.sub ?? "", type: r.type ?? "" })));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
