"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import Icon from "./Icon";
import { OFF_CLOSE_TYPES, OFF_HOLIDAY_ROWS, OFF_LISTS, validateOffSettings, type OffListKey, type OffSettingsForm } from "@/lib/off/settings";

const fmt = (iso: string) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${y + 543}`;
};

export default function OffSettingsClient({ initial }: { initial: OffSettingsForm }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<OffSettingsForm>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const errs = dirty ? validateOffSettings(f) : [];
  const set = <K extends keyof OffSettingsForm>(k: K, v: OffSettingsForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const setStaff = (i: number, k: "name" | "last" | "rep" | "repStart", v: string) => set("staff", f.staff.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setSpot = (row: number, k: "sat" | "sun", v: string) => set("spots", f.spots.map((x) => (x.row === row ? { ...x, [k]: v } : x)));
  const setHol = (i: number, k: "date" | "name" | "type", v: string) => set("holidays", f.holidays.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setList = (k: OffListKey, i: number, v: string) => set("lists", { ...f.lists, [k]: f.lists[k].map((x, j) => (j === i ? { ...x, v } : x)) });
  const countNow = f.staff.filter((s) => s.name.trim() !== "").length;

  const save = async () => {
    if (errs.length) return void toast.error(errs[0]);
    if (countNow !== initial.count && !window.confirm(`จำนวนเจ้าหน้าที่ในรอบหมุนเวรจะเปลี่ยนจาก ${initial.count} เป็น ${countNow} คน — การหมุนเวรทั้งปีจะเลื่อนใหม่ทั้งหมด\n(ถ้ามีคนลาออก ให้ใส่วันทำงานวันสุดท้าย/คนมาแทนแทนการลบชื่อ)\n\nบันทึกต่อหรือไม่?`)) return;
    setBusy(true);
    const t = toast.loading("กำลังบันทึกตั้งค่า (ตารางเวรนอกเวลา)…");
    try {
      const res = await fetch("/api/off/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form: f }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string; addedToT?: string[]; skipped?: string[]; changed?: number };
      if (!res.ok) return void t.error(j.error ?? `บันทึกไม่สำเร็จ (${res.status})`);
      const extra = [
        j.addedToT?.length ? `เพิ่ม ${j.addedToT.join(", ")} ในรายชื่อ Dropdown แล้ว` : "",
        j.skipped?.length ? `ข้ามช่องสูตร ${j.skipped.join(", ")}` : "",
      ].filter(Boolean);
      t.success(`บันทึกตั้งค่าสำเร็จ (${j.changed ?? 0} ช่อง) ตารางทุกเดือนอัปเดตตาม${extra.length ? " · " + extra.join(" · ") : ""}`);
      router.refresh();
    } catch {
      t.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>ตั้งค่า — ตารางเวรนอกเวลา</h1>
        <span className="muted">อ่าน/บันทึกแท็บ ตั้งค่า ในชีตโดยตรง · ช่องสีเหลือง = แก้ได้ · ช่องที่เป็นสูตรแสดงอย่างเดียว</span>
      </div>

      <section className="card">
        <h2>รอบตารางเวร</h2>
        <div className="grid2">
          <label>วันแรกของรอบตารางเวร <span className="cellref">E15</span></label>
          <span className="ro">{fmt(f.periodStart)} (สูตรในชีต)</span>
          <label>วันสุดท้ายของรอบตารางเวร <span className="cellref">E16</span></label>
          <span className="ro">{fmt(f.periodEnd)} (สูตรในชีต)</span>
          <label>จำนวนเจ้าหน้าที่ในรอบหมุนเวร <span className="cellref">B2</span></label>
          <span className={countNow !== initial.count ? "badge badge-warning" : "ro"}>{countNow} คน{countNow !== initial.count ? ` (เดิม ${initial.count} — การหมุนทั้งปีจะเลื่อน)` : ""}</span>
        </div>
      </section>

      <section className="card scroll-x">
        <h2>
          เจ้าหน้าที่ในรอบหมุนเวร <small>ตั้งค่า!B5:B30 · ลาออก/คนมาแทน = Z:AB</small>
        </h2>
        <p className="muted">
          ลาออก: <b>อย่าลบชื่อ</b> ให้ใส่ &apos;วันทำงานวันสุดท้าย&apos; — ลำดับหมุนเวรคงเดิม ไม่เพี้ยน · มีคนมาแทน: ใส่ชื่อผู้มาแทน + วันเริ่มงานผู้มาแทน แถวเดียวกัน (คนใหม่รับคิวต่อจากคนเดิม) · ระหว่างวันสุดท้ายถึงวันเริ่มงานผู้มาแทน จุดนั้นจะว่าง ·
          ใช้กับช่อง 7, 9–14,16 (วันอาทิตย์ช่อง 10), ช่อง 1 SMC, ช่อง 2 C/U
        </p>
        <table className="form">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>ชื่อเจ้าหน้าที่</th>
              <th>วันทำงานวันสุดท้าย (ถ้าลาออก)</th>
              <th>ชื่อผู้มาแทน</th>
              <th>วันเริ่มงานผู้มาแทน</th>
            </tr>
          </thead>
          <tbody>
            {f.staff.map((p, i) => (
              <tr key={p.row}>
                <td>{i + 1}</td>
                <td>{p.nameF ? <span className="ro">{p.name} (สูตร)</span> : <input className="y" value={p.name} onChange={(e) => setStaff(i, "name", e.target.value)} />}</td>
                <td><input className="y" type="date" value={p.last} disabled={!p.name.trim()} onChange={(e) => setStaff(i, "last", e.target.value)} /></td>
                <td><input className="y" value={p.rep} disabled={!p.name.trim()} onChange={(e) => setStaff(i, "rep", e.target.value)} /></td>
                <td><input className="y" type="date" value={p.repStart} disabled={!p.name.trim()} onChange={(e) => setStaff(i, "repStart", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card scroll-x">
        <h2>
          จุดปฏิบัติงาน และค่าหมุนเวร <small>ตั้งค่า!D5:I17 · แก้ได้เฉพาะค่าหมุนเวร H5:I13</small>
        </h2>
        <p className="muted">
          ค่าหมุนเวรต้องเป็นเลข 0–{Math.max(0, countNow - 1)} และไม่ซ้ำกัน · ช่องว่าง = ไม่เปิดวันนั้น · จุดเดียวกันของเสาร์-อาทิตย์ควรห่างกันไม่น้อยกว่า 5 (ตามหลักการในชีต)
        </p>
        <table className="form">
          <thead>
            <tr><th>ลำดับจุด</th><th>จุดปฏิบัติงาน</th><th>กลุ่มงาน</th><th>เวลาปฏิบัติงาน</th><th>ค่าหมุนเวร (เสาร์)</th><th>ค่าหมุนเวร (อาทิตย์)</th></tr>
          </thead>
          <tbody>
            {f.spots.map((s) => (
              <tr key={s.row}>
                <td>{s.order}</td>
                <td>{s.name}</td>
                <td>{s.group}</td>
                <td>{s.time}</td>
                {s.editable ? (
                  <>
                    <td>
                      {s.satEd ? (
                        <input className="y" inputMode="numeric" style={{ width: 80 }} value={s.sat} onChange={(e) => setSpot(s.row, "sat", e.target.value)} />
                      ) : (
                        <span className="ro small" title="สูตรไม่ได้ใช้ค่านี้">{s.sat || "—"} · {s.row === 7 ? "ใช้รายชื่อสลับ Y5:Y6" : "ผู้จัดเวรเลือกเอง"}</span>
                      )}
                    </td>
                    <td>
                      {s.sunEd ? (
                        <input className="y" inputMode="numeric" style={{ width: 80 }} value={s.sun} onChange={(e) => setSpot(s.row, "sun", e.target.value)} />
                      ) : (
                        <span className="ro small" title="สูตรไม่ได้ใช้ค่านี้">{s.sun || "—"} · ผู้จัดเวรเลือกเอง</span>
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={2} className="ro">ใช้รายชื่อสลับ (ไม่ใช้ค่าหมุน)</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card scroll-x">
        <h2>
          วันหยุดที่งดบริการ <small>ตั้งค่า!M5:N44 · ประเภทการปิด S5:S44</small>
        </h2>
        <p className="muted">ปิดทั้งหมด = วันนั้นไม่มีเวรทุกจุด (สีเทา วันที่สีแดง) · ปิดเฉพาะ SMC = ปิดเฉพาะจุด SMC/Check-up · สูงสุด {OFF_HOLIDAY_ROWS} รายการ</p>
        <table className="form">
          <thead><tr><th style={{ width: 170 }}>วันที่</th><th>ชื่อวันหยุด / หมายเหตุ</th><th>ประเภทการปิด</th><th>สถานะ (สูตรในชีต)</th><th></th></tr></thead>
          <tbody>
            {f.holidays.map((h, i) => (
              <tr key={i}>
                <td><input className="y" type="date" value={h.date} onChange={(e) => setHol(i, "date", e.target.value)} /></td>
                <td><input className="y" value={h.name} onChange={(e) => setHol(i, "name", e.target.value)} /></td>
                <td>
                  <select className="y" value={h.type} onChange={(e) => setHol(i, "type", e.target.value)}>
                    {OFF_CLOSE_TYPES.map((t) => <option key={t} value={t}>{t === "" ? "(ว่าง = ปิดทั้งหมด)" : t}</option>)}
                  </select>
                </td>
                <td className="ro small">{h.wd ? `${h.wd} · ` : ""}{h.status}</td>
                <td><button className="btn btn-xs btn-ghost" onClick={() => set("holidays", f.holidays.filter((_, j) => j !== i))}>ลบ</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          <button className="btn btn-sm" disabled={f.holidays.length >= OFF_HOLIDAY_ROWS} onClick={() => set("holidays", [...f.holidays, { date: "", name: "", type: "ปิดทั้งหมด", wd: "", status: "" }])}>
            <Icon name="Plus" size={14} /> เพิ่มวันหยุด
          </button>
        </p>
      </section>

      {(Object.keys(OFF_LISTS) as OffListKey[]).map((k) => {
        const d = OFF_LISTS[k];
        return (
          <section className="card" key={k}>
            <h2>
              {d.title} <small>ตั้งค่า!{d.col}{d.r1}:{d.col}{d.r2}</small>
            </h2>
            <p className="muted">{d.note}</p>
            <div className="list-grid">
              {f.lists[k].map((x, i) =>
                x.f ? (
                  <span key={i} className="ro list-ro" title={`${d.col}${d.r1 + i} เป็นสูตร`}>{x.v || "—"}</span>
                ) : (
                  <input key={i} className="y" value={x.v} placeholder={`${d.col}${d.r1 + i}`} onChange={(e) => setList(k, i, e.target.value)} />
                ),
              )}
            </div>
          </section>
        );
      })}

      {errs.length > 0 && (
        <div className="alert alert-warning" role="alert">
          <Icon name="TriangleAlert" size={16} />
          <span>{errs.join(" · ")}</span>
        </div>
      )}
      <div className="savebar">
        <button className="btn btn-primary" disabled={busy || !dirty || errs.length > 0} onClick={save}>
          {busy ? <span className="loading loading-spinner loading-xs" /> : <Icon name="Save" size={16} />}
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button className="btn btn-ghost" disabled={busy || !dirty} onClick={() => setF(initial)}>
          <Icon name="Undo2" size={16} />
          ยกเลิกการแก้ไข
        </button>
      </div>
    </div>
  );
}
