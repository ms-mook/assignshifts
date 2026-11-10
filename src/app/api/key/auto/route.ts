import { NextResponse } from "next/server";
import { parseYm } from "@/lib/config";
import { computeKeyMonth } from "@/lib/key/engine";
import { loadKey, loadKeyMonthState } from "@/lib/key/repo";
import { loadKeyBookingGuide } from "@/lib/key/booking";
import { planAuto } from "@/lib/smc/auto";
import { syncAllLeaves } from "@/lib/leave-sync";

/** ตัวอย่างการจัดเวรอัตโนมัติ ตาราง Key (ช่อง B = OPD Key1 · K = กว. Key2) — ไม่เขียนชีต; ยืนยันแล้วหน้าเว็บบันทึกผ่าน /manual */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { ym?: string };
    const p = parseYm(String(b.ym ?? ""));
    if (!p) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    await syncAllLeaves(b.ym as string);
    const s = await loadKey();
    const st = await loadKeyMonthState(s, p.yearBE, p.month);
    const res = computeKeyMonth(s, st.manual, p.yearBE, p.month);
    const g = await loadKeyBookingGuide(p.yearBE, p.month, [...s.dropdown, ...s.rot, ...s.heads, s.key4Name, s.head]);
    if (g.error) return NextResponse.json({ error: g.error }, { status: 502 });
    const booked: Record<number, { name: string; unlisted: boolean }[]> = {};
    for (const [d, list] of Object.entries(g.byDay)) booked[Number(d)] = list.map((x) => ({ name: x.name, unlisted: !!x.note }));
    const plan = planAuto({
      // ช่อง B..O เท่านั้น (P = หมายเหตุ ไม่ใช่ชื่อคน)
      rows: res.rows.map((r) => ({ day: r.day, date: r.date, V: r.Q, cells: Object.fromEntries(Object.entries(r.cells).filter(([c]) => c !== "P")) })),
      booked,
      onLeave: (n, d) => s.leaves.some((l) => l.date === d && l.who.trim().toLowerCase() === n.trim().toLowerCase()),
      freeNames: ["MT full-time", "ลา"],
      cols: ["B", "K"],
    });
    return NextResponse.json({ ok: true, plan, bookedDays: Object.keys(booked).length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
