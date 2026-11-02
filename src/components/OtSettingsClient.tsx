"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import type { OtSettingsForm } from "@/lib/ot/repo";

export default function OtSettingsClient({ initial }: { initial: OtSettingsForm }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<OtSettingsForm>(initial);
  const [busy, setBusy] = useState(false);
  const [dropText, setDropText] = useState(initial.dropdown.join("\n"));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof OtSettingsForm>(k: K, v: OtSettingsForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const post = async (url: string, body: unknown, loading: string, ok: string) => {
    setBusy(true);
    const t = toast.loading(loading);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        t.error(j.error ?? `บันทึกไม่สำเร็จ (${res.status})`);
        return null;
      }
      t.success(ok);
      router.refresh();
      return j;
    } catch {
      t.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const save = () => post("/api/ot/settings", f, "กำลังบันทึกตั้งค่า (OT)… (รอสักครู่)", "บันทึกตั้งค่าสำเร็จ ตารางทุกเดือนอัปเดตตาม");
  const step = async (dir: 1 | -1) => {
    if (dirty && !window.confirm("มีการแก้ไขที่ยังไม่บันทึก — สลับรูปแบบตอนนี้จะไม่บันทึกการแก้ไขอื่น ทำต่อหรือไม่?")) return;
    const j = await post("/api/ot/pattern", { dir }, "กำลังสลับรูปแบบการเวียน…", "สลับรูปแบบการเวียนแล้ว");
    if (j?.pattern) setF((x) => ({ ...initial, pattern: j.pattern }));
  };

  return (
    <div>
      <div className="page-head">
        <h1>ตั้งค่า — ตาราง OT</h1>
        <span className="muted">ช่องสีเหลือง = แก้ได้ (เหมือนในชีต) · เปลี่ยนแล้วตารางทุกเดือนอัปเดตเอง</span>
      </div>

      <section className="card">
        <h2>การเวียน</h2>
        <div className="grid2">
          <label>รูปแบบการเวียน (1-7) <span className="cellref">B3</span></label>
          <span>
            <button disabled={busy} onClick={() => step(-1)} title="เมนู: สลับเวียน ← รูปแบบก่อนหน้า">◀ รูปแบบก่อนหน้า</button>{" "}
            <input className="y" type="number" min={1} max={7} style={{ width: 70 }} value={f.pattern} onChange={(e) => set("pattern", Number(e.target.value))} />{" "}
            <button disabled={busy} onClick={() => step(1)} title="เมนู: สลับเวียน → รูปแบบถัดไป">รูปแบบถัดไป ▶</button>
          </span>
          <label>วันเริ่มตาราง (วันจันทร์) <span className="cellref">B4</span></label>
          <input className="y" type="date" value={f.startMonday} onChange={(e) => set("startMonday", e.target.value)} />
          <label>วันเริ่มเวียนครบ 8 จุด (วันจันทร์) <span className="cellref">B5</span></label>
          <input className="y" type="date" value={f.eightStart} onChange={(e) => set("eightStart", e.target.value)} />
          <label>วันเปิดจุดบัตรคิว SMC <span className="cellref">B6</span></label>
          <input className="y" type="date" value={f.smcOpen} onChange={(e) => set("smcOpen", e.target.value)} />
          <label>ชื่อผู้ลงนาม (ท้ายตาราง) <span className="cellref">G4</span></label>
          <input className="y" value={f.signerName} onChange={(e) => set("signerName", e.target.value)} />
          <label>ตำแหน่งผู้ลงนาม <span className="cellref">G5</span></label>
          <input className="y" value={f.signerTitle} onChange={(e) => set("signerTitle", e.target.value)} />
        </div>
      </section>

      <section className="card scroll-x">
        <h2>รายชื่อพนักงาน (สูงสุด 8 ตำแหน่ง = จำนวนจุด) <span className="cellref">B10:F17</span></h2>
        <p className="muted">ลาออก: ใส่ &apos;วันทำงานวันสุดท้าย&apos; · มีคนมาแทน: ใส่ชื่อผู้มาแทน + วันเริ่มงานผู้มาแทน แถวเดียวกัน (คนใหม่รับคิวต่อจากคนเดิม)</p>
        <table className="form">
          <thead>
            <tr><th>ลำดับ</th><th>ชื่อพนักงาน</th><th>วันเริ่มงาน</th><th>วันทำงานวันสุดท้าย (ถ้าลาออก)</th><th>ชื่อผู้มาแทน</th><th>วันเริ่มงานผู้มาแทน</th></tr>
          </thead>
          <tbody>
            {f.staff.map((p, i) => {
              const u = (k: keyof typeof p, v: string) => set("staff", f.staff.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><input className="y" value={p.name} onChange={(e) => u("name", e.target.value)} /></td>
                  <td><input className="y" type="date" value={p.start} onChange={(e) => u("start", e.target.value)} /></td>
                  <td><input className="y" type="date" value={p.last} onChange={(e) => u("last", e.target.value)} /></td>
                  <td><input className="y" value={p.rep} onChange={(e) => u("rep", e.target.value)} /></td>
                  <td><input className="y" type="date" value={p.repStart} onChange={(e) => u("repStart", e.target.value)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>ชื่อเรียกจุดปฏิบัติงาน <span className="cellref">A21:A28</span></h2>
        <p className="muted">ห้ามแก้ลำดับ/ตำแหน่งในรอบ (ตามชีต) — แก้ได้เฉพาะชื่อเรียก</p>
        <div className="grid2">
          {f.spotNames.map((n, i) => (
            <span key={i} style={{ display: "contents" }}>
              <label>จุดที่ {i + 1}</label>
              <input className="y" value={n} onChange={(e) => set("spotNames", f.spotNames.map((x, j) => (j === i ? e.target.value : x)))} />
            </span>
          ))}
        </div>
      </section>

      <section className="card scroll-x">
        <h2>วันหยุดนักขัตฤกษ์ / วันหยุดหน่วยงาน <span className="cellref">J10:K55</span></h2>
        <p className="muted">วันที่นี้จะเป็นแถบเทา และชื่อวันหยุดขึ้นในคอลัมน์หมายเหตุ · สูงสุด 46 รายการ</p>
        <table className="form">
          <thead><tr><th style={{ width: 170 }}>วันที่</th><th>ชื่อวันหยุด (แสดงในตารางเวร)</th><th></th></tr></thead>
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
        <p><button disabled={f.holidays.length >= 46} onClick={() => set("holidays", [...f.holidays, { date: "", name: "" }])}>+ เพิ่มวันหยุด</button></p>
      </section>

      <section className="card">
        <h2>รายชื่อสำหรับ dropdown ในตารางเวร <span className="cellref">O10:O55</span></h2>
        <p className="muted">หนึ่งบรรทัดต่อหนึ่งชื่อ · สูงสุด 46 ชื่อ</p>
        <textarea className="y" rows={10} style={{ width: "100%" }} value={dropText} onChange={(e) => { setDropText(e.target.value); set("dropdown", e.target.value.split("\n").map((x) => x.trim()).filter((x) => x !== "")); }} />
      </section>

      <div className="savebar">
        <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        <button disabled={busy || !dirty} onClick={() => { setF(initial); setDropText(initial.dropdown.join("\n")); }}>ยกเลิกการแก้ไข</button>
      </div>
    </div>
  );
}
