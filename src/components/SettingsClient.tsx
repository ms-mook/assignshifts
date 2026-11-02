"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Shift3SettingsForm } from "@/lib/shift3/repo";
import type { Spot, TrainingStep } from "@/lib/shift3/types";

interface Info {
  B7: number;
  B9: number;
  spotFullNames: string[];
  spots: Spot[];
  training: TrainingStep[];
  names: string[];
}

type Tab = "common" | "shift3" | "others";

export default function SettingsClient({ initial, info }: { initial: Shift3SettingsForm; info: Info }) {
  const router = useRouter();
  const [f, setF] = useState<Shift3SettingsForm>(initial);
  const [tab, setTab] = useState<Tab>("shift3");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = useMemo(() => JSON.stringify(f) !== JSON.stringify(initial), [f, initial]);

  const set = <K extends keyof Shift3SettingsForm>(k: K, v: Shift3SettingsForm[K]) => setF((o) => ({ ...o, [k]: v }));
  const setPerson = (i: number, k: keyof Shift3SettingsForm["persons"][number], v: string) =>
    setF((o) => ({ ...o, persons: o.persons.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));

  // ตัวเลือกชื่อ: จนท. 14 คน + คู่สลับ (เหมือน dropdown ในชีต)
  const staffNames = [...f.persons.map((p) => p.name), f.pairOddKw8, f.pairOddOpd11].filter((n) => n !== "");
  const uniq = (a: string[]) => Array.from(new Set(a));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/shift3/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: (await r.json()).error ?? "บันทึกไม่สำเร็จ" });
    setMsg({ ok: true, text: "บันทึกลง Google Sheet แล้ว" });
    router.refresh();
  };

  const NameSelect = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) => (
    <select className="y" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">(ว่าง)</option>
      {uniq([value, ...options].filter((x) => x !== "")).map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <div className="page-head">
        <h1>ตั้งค่า</h1>
        <span className="muted">รวมการตั้งค่าของทุกตารางไว้ที่เดียว · ช่องสีเหลือง = แก้ได้ (เหมือนในชีต)</span>
      </div>
      <div className="tabs">
        <button className={tab === "shift3" ? "on" : ""} onClick={() => setTab("shift3")}>
          ตาราง 6.00-8.30 / 8.30-12.30 / 12.30-16.30
        </button>
        <button className={tab === "common" ? "on" : ""} onClick={() => setTab("common")}>
          วันหยุด · รายชื่อ MT-RN · ผู้ลงนาม
        </button>
        <button className={tab === "others" ? "on" : ""} onClick={() => setTab("others")}>
          Key · SMC · OT
        </button>
      </div>

      {tab === "shift3" && (
        <>
          <section className="card">
            <h2>
              รอบการเวียน <small>ตั้งค่า!B3:B9</small>
            </h2>
            <div className="grid2">
              <label>วันเริ่มตาราง (วันจันทร์) <span className="cellref">B3</span></label>
              <input className="y" type="date" value={f.startMonday} onChange={(e) => set("startMonday", e.target.value)} />
              <label>รูปแบบการเวียน (1-14) <span className="cellref">B4</span></label>
              <input className="y" type="number" min={1} max={14} value={f.rotationPattern} onChange={(e) => set("rotationPattern", Number(e.target.value))} />
              <label>วันเริ่มงานพนักงานใหม่ <span className="cellref">B5</span></label>
              <input className="y" type="date" value={f.newHireStart} onChange={(e) => set("newHireStart", e.target.value)} />
              <label>จำนวนเดือนที่ประจำ OPD ทั่วไป13 <span className="cellref">B6</span></label>
              <input className="y" type="number" min={0} value={f.newHireMonths} onChange={(e) => set("newHireMonths", Number(e.target.value))} />
              <label>สัปดาห์ที่เริ่มฝึกเวียนจุด <span className="cellref">B7</span></label>
              <span className="ro">{info.B7} (คำนวณอัตโนมัติ — ค่าที่บันทึกล่าสุด)</span>
              <label>จำนวนสัปดาห์ฝึกจุด <span className="cellref">B8</span></label>
              <input className="y" type="number" min={0} value={f.trainingWeeks} onChange={(e) => set("trainingWeeks", Number(e.target.value))} />
              <label>สัปดาห์ที่เข้ารอบ 14 คน <span className="cellref">B9</span></label>
              <span className="ro">{info.B9} (คำนวณอัตโนมัติ — ค่าที่บันทึกล่าสุด)</span>
            </div>
          </section>

          <section className="card">
            <h2>
              ผู้ปฏิบัติงานหมุนเวียน (MTF.) <small>ตั้งค่า!A13:F26 · ลาออก = ใส่ช่อง D · คนมาแทน = E-F</small>
            </h2>
            <div className="scroll-x">
              <table className="form">
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>ชื่อ</th>
                    <th>วันเริ่มงาน</th>
                    <th>วันทำงานวันสุดท้าย (ถ้าลาออก)</th>
                    <th>ชื่อผู้มาแทน</th>
                    <th>วันเริ่มงานผู้มาแทน</th>
                  </tr>
                </thead>
                <tbody>
                  {f.persons.map((p, i) => (
                    <tr key={i}>
                      <td>{p.no}</td>
                      <td><input className="y" value={p.name} onChange={(e) => setPerson(i, "name", e.target.value)} /></td>
                      <td>
                        {i === 13 ? (
                          <span className="ro" title="ตั้งค่า!C26 = $B$5">{f.newHireStart || "-"} (= B5)</span>
                        ) : (
                          <input className="y" type="date" value={p.start} onChange={(e) => setPerson(i, "start", e.target.value)} />
                        )}
                      </td>
                      <td><input className="y" type="date" value={p.lastDay} onChange={(e) => setPerson(i, "lastDay", e.target.value)} /></td>
                      <td><input className="y" value={p.replacement} onChange={(e) => setPerson(i, "replacement", e.target.value)} /></td>
                      <td><input className="y" type="date" value={p.replacementStart} onChange={(e) => setPerson(i, "replacementStart", e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>
              คู่สลับ กว.ทั่วไป8 / OPD ทั่วไป11 <small>ตั้งค่า!B29:B30 (สลับกันทุกสัปดาห์)</small>
            </h2>
            <div className="grid2">
              <label>สัปดาห์คี่ — คนที่เริ่มที่ กว.ทั่วไป8 <span className="cellref">B29</span></label>
              <input className="y" value={f.pairOddKw8} onChange={(e) => set("pairOddKw8", e.target.value)} />
              <label>สัปดาห์คี่ — คนที่เริ่มที่ OPD ทั่วไป11 <span className="cellref">B30</span></label>
              <input className="y" value={f.pairOddOpd11} onChange={(e) => set("pairOddOpd11", e.target.value)} />
            </div>
          </section>

          <section className="card">
            <h2>
              POCT ช่วงบ่าย (12.30-16.30) <small>ตั้งค่า!B33:B37</small>
            </h2>
            <div className="grid2">
              <label>ประจำทุกบ่าย — กว. POCT <span className="cellref">B33</span></label>
              <NameSelect value={f.poctKw} onChange={(v) => set("poctKw", v)} options={staffNames} />
              <label>ประจำทุกบ่าย — OPD POCT <span className="cellref">B34</span></label>
              <NameSelect value={f.poctOpd} onChange={(v) => set("poctOpd", v)} options={staffNames} />
              <label>สลับสัปดาห์ — คนที่ 1 <span className="cellref">B35</span></label>
              <NameSelect value={f.poctAlt1} onChange={(v) => set("poctAlt1", v)} options={staffNames} />
              <label>สลับสัปดาห์ — คนที่ 2 <span className="cellref">B36</span></label>
              <NameSelect value={f.poctAlt2} onChange={(v) => set("poctAlt2", v)} options={staffNames} />
              <label>ช่วงบ่าย {f.pairOddOpd11 || "B30"} อยู่ OPD Key1 ทุกวัน <span className="cellref">B37</span></label>
              <select className="y" value={f.b30AtKey1} onChange={(e) => set("b30AtKey1", e.target.value)}>
                <option value="ใช่">ใช่</option>
                <option value="ไม่">ไม่</option>
              </select>
            </div>
          </section>

          <section className="card">
            <h2>
              ลำดับเติมคนเมื่อจุดว่าง (ช่วงบ่าย / มีคนลา) <small>ตั้งค่า!B40:B42</small>
            </h2>
            <div className="grid2">
              {[0, 1, 2].map((i) => (
                <FillRow
                  key={i}
                  i={i}
                  value={f.fillFrom[i]}
                  options={info.spotFullNames}
                  onChange={(v) => {
                    const ff = [...f.fillFrom] as [string, string, string];
                    ff[i] = v;
                    set("fillFrom", ff);
                  }}
                />
              ))}
            </div>
          </section>

          <section className="card">
            <h2>
              ตารางจุดปฏิบัติงาน และลำดับฝึกจุดของพนักงานใหม่ <small>ห้ามแก้ (แสดงเพื่ออ้างอิง)</small>
            </h2>
            <div className="scroll-x">
              <table className="form">
                <thead>
                  <tr>
                    <th>รหัส</th><th>จุด</th><th>ห้อง</th><th>ตำแหน่งรอบ13</th><th>ตำแหน่งรอบ14</th><th>ลำดับเติม POCT</th><th>สัปดาห์ฝึก</th>
                  </tr>
                </thead>
                <tbody>
                  {info.spots.map((s) => {
                    const t = info.training.filter((x) => x.code === s.code).map((x) => x.week);
                    return (
                      <tr key={s.code} className="ro">
                        <td>{s.code}</td><td>{s.name}</td><td>{s.room}</td><td>{s.pos13}</td><td>{s.pos14}</td><td>{s.fillOrder}</td>
                        <td>{t.join(", ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === "common" && (
        <>
          <section className="card">
            <h2>
              วันหยุดนักขัตฤกษ์ / วันหยุดหน่วยงาน <small>ตั้งค่า!H46:I85 · สูงสุด 40 วัน · วันนั้นเป็นแถวสีเทาและไม่จัดคน</small>
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              ตอนนี้บันทึกลงชีตตาราง 3 ช่วงเวลา — เมื่อเชื่อมตาราง Key / SMC / OT แล้ว จะเลือกได้ว่าวันหยุดแต่ละวันใช้กับตารางไหน
              (วันหยุดในแต่ละชีตปัจจุบันไม่เหมือนกันทั้งหมด)
            </p>
            <table className="form">
              <thead>
                <tr><th style={{ width: 190 }}>วันที่หยุด</th><th>ชื่อวันหยุด (หมายเหตุ)</th><th style={{ width: 60 }}></th></tr>
              </thead>
              <tbody>
                {f.holidays.map((h, i) => (
                  <tr key={i}>
                    <td><input className="y" type="date" value={h.date} onChange={(e) => set("holidays", f.holidays.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} /></td>
                    <td><input className="y" value={h.name} onChange={(e) => set("holidays", f.holidays.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                    <td><button onClick={() => set("holidays", f.holidays.filter((_, j) => j !== i))}>ลบ</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              <button disabled={f.holidays.length >= 40} onClick={() => set("holidays", [...f.holidays, { date: "", name: "" }])}>+ เพิ่มวันหยุด</button>{" "}
              <button onClick={() => set("holidays", [...f.holidays].sort((a, b) => (a.date || "9").localeCompare(b.date || "9")))}>เรียงตามวันที่</button>
            </p>
          </section>

          <section className="card">
            <h2>
              รายชื่อ MT / RN <small>ชีต รายชื่อ MT-RN!A3:A200 · ใช้ใน dropdown ช่องชื่อ</small>
            </h2>
            <table className="form">
              <thead>
                <tr><th style={{ width: 60 }}>ลำดับ</th><th>ชื่อ</th><th>หมายเหตุ</th><th style={{ width: 60 }}></th></tr>
              </thead>
              <tbody>
                {f.mtrn.map((m, i) => (
                  <tr key={i}>
                    <td className="ro">{i + 1}</td>
                    <td><input className="y" value={m.name} onChange={(e) => set("mtrn", f.mtrn.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                    <td><input value={m.note} onChange={(e) => set("mtrn", f.mtrn.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} /></td>
                    <td><button onClick={() => set("mtrn", f.mtrn.filter((_, j) => j !== i))}>ลบ</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p><button onClick={() => set("mtrn", [...f.mtrn, { name: "", note: "" }])}>+ เพิ่มชื่อ</button></p>
          </section>

          <section className="card">
            <h2>
              ผู้จัดทำ / ผู้ลงนาม <small>ตั้งค่า!B89:B90 · แสดงมุมขวาล่างของตารางและ PDF</small>
            </h2>
            <div className="grid2">
              <label>ชื่อผู้จัดทำ (ไม่ต้องใส่วงเล็บ) <span className="cellref">B89</span></label>
              <input className="y" value={f.signerName} onChange={(e) => set("signerName", e.target.value)} />
              <label>ตำแหน่ง <span className="cellref">B90</span></label>
              <input className="y" value={f.signerTitle} onChange={(e) => set("signerTitle", e.target.value)} />
            </div>
          </section>
        </>
      )}

      {tab === "others" && (
        <section className="card">
          <h2>ตาราง Key · SMC · OT</h2>
          <p className="muted">จะรวมการตั้งค่าของ 3 ตารางนี้เข้ามาในหน้านี้ในขั้นถัดไป (ทีละตาราง) ตอนนี้ยังจัดการในแต่ละ Google Sheet ตามเดิม</p>
        </section>
      )}

      <div className="savebar">
        <button className="primary" disabled={busy || !dirty} onClick={save}>
          {busy ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
        </button>
        <button disabled={busy || !dirty} onClick={() => setF(initial)}>ยกเลิกการแก้ไข</button>
        {dirty && !msg && <span className="muted">มีการแก้ไขที่ยังไม่บันทึก</span>}
        {msg && <span className={msg.ok ? "ok" : "error"}>{msg.text}</span>}
      </div>
    </div>
  );
}

function FillRow({ i, value, options, onChange }: { i: number; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <>
      <label>
        คนที่ {i + 1} ใช้จากจุด <span className="cellref">B{40 + i}</span>
      </label>
      <select className="y" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">(ว่าง)</option>
        {Array.from(new Set([value, ...options].filter((x) => x !== ""))).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </>
  );
}
