import { NextResponse } from "next/server";
import { parseYm } from "@/lib/config";
import { computeOtMonth } from "@/lib/ot/engine";
import { otPerson } from "@/lib/ot/conflicts";
import { loadOt, loadOtMonthState } from "@/lib/ot/repo";
import { loadOtBookingGuide } from "@/lib/ot/booking";
import { planAuto } from "@/lib/smc/auto";
import { syncAllLeaves } from "@/lib/leave-sync";

/** ตัวอย่างจัดเวรอัตโนมัติ ตาราง OT: B จุดบัตรคิว OPD → D จุดตรวจสอบเอกสาร/เก็บ 3 OPD → J จุดเก็บ รับ-นำส่ง กว. (06.00-08.30)
 *  ผู้จองน้อย → เติมตามลำดับ B, D, J · คนเดิมอยู่จุดเดิมซ้ำได้ · ไม่เขียนชีต (ยืนยันแล้วหน้าเว็บบันทึกผ่าน /manual) */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { ym?: string };
    const p = parseYm(String(b.ym ?? ""));
    if (!p) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    await syncAllLeaves(b.ym as string);
    const data = await loadOt();
    const st = await loadOtMonthState(data, p.yearBE, p.month);
    const res = computeOtMonth(data.settings, data.leaves, st.manual, p.yearBE, p.month);
    const names = Array.from(new Set([...data.settings.staff.map((s) => s.name), ...data.settings.dropdown].filter((n) => n.trim() !== "")));
    const g = await loadOtBookingGuide(p.yearBE, p.month, [...names, ...data.settings.staff.map((s) => s.rep)]);
    if (g.error) return NextResponse.json({ error: g.error }, { status: 502 });
    const booked: Record<number, { name: string; unlisted: boolean }[]> = {};
    for (const [d, list] of Object.entries(g.byDay)) booked[Number(d)] = list.map((x) => ({ name: x.name, unlisted: !!x.note }));
    const plan = planAuto({
      // ช่อง B..N (O = หมายเหตุ ไม่ใช่ชื่อคน)
      rows: res.rows.map((r) => ({ day: r.day, date: r.date, V: r.P, cells: Object.fromEntries(Object.entries(r.cells).filter(([c]) => c !== "O")) })),
      booked,
      onLeave: (n, d) => data.leaves.some((l) => l.date === d && l.who.trim().toLowerCase() === n.trim().toLowerCase()),
      freeNames: [],
      cols: ["B", "D", "J"],
      ordered: true,
      personOf: otPerson,
    });
    return NextResponse.json({ ok: true, plan, bookedDays: Object.keys(booked).length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
