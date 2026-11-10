import { NextResponse } from "next/server";
import { parseYm } from "@/lib/config";
import { computeSmcMonth, onLeave } from "@/lib/smc/engine";
import { loadSmc, loadSmcMonthState } from "@/lib/smc/repo";
import { loadSmcBookingGuides } from "@/lib/smc/booking";
import { planSmcAuto } from "@/lib/smc/auto";
import { syncAllLeaves, leaveContext } from "@/lib/leave-sync";

/** ตัวอย่างการจัดเวรอัตโนมัติ (ไม่เขียนชีต) — POST { ym } → แผน; ผู้ใช้ยืนยันแล้วหน้าเว็บจึงบันทึกผ่าน /manual */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { ym?: string };
    const p = parseYm(String(b.ym ?? ""));
    if (!p) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    await syncAllLeaves(b.ym as string);
    const s = await loadSmc();
    const st = await loadSmcMonthState(s, p.yearBE, p.month);
    const res = computeSmcMonth(s, st.manual, p.yearBE, p.month);
    const names = Array.from(new Set([...s.listJ, ...s.listL, ...s.listN, ...s.listP, ...s.listT, s.mt, s.pt].filter((n) => n.trim() !== "")));
    const guides = await loadSmcBookingGuides(p.yearBE, p.month, [...names, ...(await leaveContext("smc")).staff]);
    const g = guides[0];
    if (g.error) return NextResponse.json({ error: g.error }, { status: 502 });
    const booked: Record<number, { name: string; unlisted: boolean }[]> = {};
    for (const [d, list] of Object.entries(g.byDay)) booked[Number(d)] = list.map((x) => ({ name: x.name, unlisted: !!x.note }));
    const plan = planSmcAuto({
      rows: res.rows,
      booked,
      onLeave: (n, d) => onLeave(s, n, d),
      freeNames: [s.mt, s.pt].filter((x) => x.trim() !== ""),
    });
    return NextResponse.json({ ok: true, plan, bookedDays: Object.keys(booked).length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
