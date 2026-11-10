// จัดเวรอัตโนมัติ (SMC: ช่อง3 G · ช่อง4 H · ช่อง5 I ช่วง 07.00-08.30 · Key: B, K) จากรายชื่อผู้จองเวร
// ฟังก์ชันล้วน (ไม่เขียนชีต) — คืนแผนให้แสดงตัวอย่างก่อน แล้วผู้ใช้กดยืนยันจึงบันทึก
// กติกา
//  - เติมเฉพาะช่องที่ว่าง · เฉพาะวันทำการ · เฉพาะคนที่จองไว้ (ชื่อตรงกับรายชื่อตาราง)
//  - ชื่อต้องไม่ซ้ำกับช่องอื่นในตาราง SMC วันเดียวกัน (ทุกช่วงเวลา) และต้องไม่ลาในวันนั้น
//  - ยอดรวมใน 3 ช่องนี้ของแต่ละคนทั้งเดือนให้ใกล้เคียงกัน (ให้คนที่ได้น้อยกว่าก่อน)
//  - หลีกเลี่ยงการอยู่จุดเดิมติดกัน/บ่อย (นับจำนวนครั้งต่อจุด)
//  - ไม่มีคนจอง/จองไม่ครบ → เว้นว่างไว้

/** ช่องเริ่มต้น (SMC: ช่อง3 G · ช่อง4 H · ช่อง5 I) — ตารางอื่น (เช่น Key: B, K) ส่งผ่าน AutoInput.cols */
export const AUTO_COLS = ["G", "H", "I"];
export type AutoCol = string;

export interface AutoRow {
  day: number;
  date: number | null;
  V: number;
  cells: Record<string, string>;
}
export interface AutoBooked {
  name: string;
  /** true = ชื่อในระบบจองไม่ตรงกับรายชื่อในตาราง (ไม่เดา → ไม่ใส่ให้) */
  unlisted?: boolean;
}
export interface AutoInput {
  rows: AutoRow[];
  /** วันที่ (1–31) → ผู้จอง */
  booked: Record<number, AutoBooked[]>;
  onLeave: (name: string, date: number) => boolean;
  /** ข้อความช่องประจำ (เช่น MT / Part-time) — ไม่ใช่ชื่อคน */
  freeNames: string[];
  /** ช่องที่จะเติม (ไม่ระบุ = G,H,I ของ SMC) */
  cols?: string[];
}
export interface AutoAssign { day: number; col: AutoCol; name: string }
export interface AutoSkip { day: number; name: string; reason: string }
export interface AutoUnfilled { day: number; col: AutoCol; why: string }
export interface AutoPerson { name: string; before: number; after: number; spots: Record<string, number> }
export interface AutoPlan {
  /** ช่องที่จัดให้ (ตามลำดับ) */
  cols: string[];
  assigns: AutoAssign[];
  skips: AutoSkip[];
  unfilled: AutoUnfilled[];
  people: AutoPerson[];
  /** วันทำการที่ไม่มีช่องว่างให้เติม */
  fullDays: number;
}

const lc = (s: string) => s.trim().toLowerCase();

/** ทุกวิธีวางคน (ตามลำดับ) ลงช่องว่างที่ต่างกัน */
function placements(n: number, cols: AutoCol[]): AutoCol[][] {
  const out: AutoCol[][] = [];
  const rec = (i: number, used: AutoCol[]) => {
    if (i === n) {
      out.push([...used]);
      return;
    }
    for (const c of cols) if (!used.includes(c)) rec(i + 1, [...used, c]);
  };
  rec(0, []);
  return out;
}

export function planAuto(inp: AutoInput): AutoPlan {
  const COLS: string[] = inp.cols ?? AUTO_COLS;
  const free = new Set(inp.freeNames.map(lc).filter((x) => x !== ""));
  const spots = new Map<string, Record<string, number>>();
  const display = new Map<string, string>();
  const ensure = (name: string) => {
    const k = lc(name);
    if (!spots.has(k)) {
      spots.set(k, Object.fromEntries(COLS.map((c) => [c, 0])));
      display.set(k, name.trim());
    }
    return spots.get(k)!;
  };
  const before = new Map<string, number>();
  // ยอดตั้งต้น = ชื่อที่มีอยู่แล้วในช่อง G/H/I ของเดือนนี้ (ทุกวัน)
  for (const r of inp.rows) {
    if (r.date === null) continue;
    for (const c of COLS) {
      const v = (r.cells[c] ?? "").trim();
      if (v === "" || free.has(lc(v))) continue;
      ensure(v)[c]++;
      before.set(lc(v), (before.get(lc(v)) ?? 0) + 1);
    }
  }
  const total = (k: string) => {
    const s = spots.get(k);
    return s ? COLS.reduce((n, c) => n + s[c], 0) : 0;
  };

  // จำนวนวันที่แต่ละคนยังจองอยู่ในวันถัดไป (ให้คนที่มีโอกาสน้อยได้ก่อนเมื่อยอดเท่ากัน)
  const workRows = inp.rows.filter((r) => r.date !== null && r.V === 1);
  const remainOf = (k: string, fromDay: number) =>
    workRows.filter((r) => r.day > fromDay && (inp.booked[r.day] ?? []).some((b) => lc(b.name) === k)).length;

  const last = new Map<string, AutoCol>();
  const plan: AutoPlan = { cols: COLS, assigns: [], skips: [], unfilled: [], people: [], fullDays: 0 };

  for (const r of workRows) {
    const date = r.date as number;
    const empty = COLS.filter((c) => (r.cells[c] ?? "").trim() === "");
    if (empty.length === 0) {
      plan.fullDays++;
      continue;
    }
    const inCells = new Map<string, string>(); // ชื่อ → ช่องที่อยู่แล้ววันนี้
    for (const [col, v] of Object.entries(r.cells)) {
      const t = (v ?? "").trim();
      if (t !== "" && !free.has(lc(t))) inCells.set(lc(t), col);
    }
    const seen = new Set<string>();
    const cands: { k: string; name: string }[] = [];
    for (const b of inp.booked[r.day] ?? []) {
      const k = lc(b.name);
      if (k === "" || seen.has(k)) continue;
      seen.add(k);
      if (b.unlisted) {
        plan.skips.push({ day: r.day, name: b.name, reason: "ชื่อไม่ตรงรายชื่อในตาราง" });
        continue;
      }
      if (free.has(k)) continue;
      if (inp.onLeave(b.name, date)) {
        plan.skips.push({ day: r.day, name: b.name, reason: "ลาในวันนี้" });
        continue;
      }
      const at = inCells.get(k);
      if (at) {
        plan.skips.push({ day: r.day, name: b.name, reason: `อยู่ช่อง ${at} ในวันเดียวกันแล้ว` });
        continue;
      }
      cands.push({ k, name: b.name.trim() });
    }
    cands.sort((a, b) => total(a.k) - total(b.k) || remainOf(a.k, r.day) - remainOf(b.k, r.day) || a.name.localeCompare(b.name, "th"));
    const picks = cands.slice(0, empty.length);
    for (const c of cands.slice(empty.length)) plan.skips.push({ day: r.day, name: c.name, reason: "ช่องเต็ม (คนอื่นได้เวรน้อยกว่า)" });

    if (picks.length > 0) {
      let best: AutoCol[] | null = null;
      let bestCost = Infinity;
      for (const pl of placements(picks.length, empty)) {
        let cost = 0;
        pl.forEach((col, i) => {
          const s = ensure(picks[i].name);
          cost += s[col] * 10 + (last.get(picks[i].k) === col ? 5 : 0);
        });
        if (cost < bestCost) {
          bestCost = cost;
          best = pl;
        }
      }
      best!.forEach((col, i) => {
        const p = picks[i];
        ensure(p.name)[col]++;
        last.set(p.k, col);
        plan.assigns.push({ day: r.day, col, name: display.get(p.k) ?? p.name });
      });
    }
    const used = new Set(plan.assigns.filter((a) => a.day === r.day).map((a) => a.col));
    for (const c of empty)
      if (!used.has(c)) plan.unfilled.push({ day: r.day, col: c, why: (inp.booked[r.day] ?? []).length === 0 ? "ไม่มีผู้จอง" : "จองไม่ครบ" });
  }

  for (const [k, s] of spots) {
    const b = before.get(k) ?? 0;
    const after = COLS.reduce((n, c) => n + s[c], 0);
    if (after > 0 || b > 0) plan.people.push({ name: display.get(k) ?? k, before: b, after, spots: { ...s } });
  }
  plan.people.sort((a, b) => b.after - a.after || a.name.localeCompare(b.name, "th"));
  return plan;
}

/** SMC (ช่อง3/4/5) */
export const planSmcAuto = planAuto;
