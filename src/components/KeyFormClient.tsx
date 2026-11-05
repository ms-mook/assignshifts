"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import Icon from "./Icon";
import type { KeySettings } from "@/lib/key/engine";
import type { KeyForm } from "@/lib/key/repo";

export default function KeyFormClient({ initial, part, settings }: { initial: KeyForm; part: "settings" | "leaves"; settings: KeySettings }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<KeyForm>(initial);
  const [busy, setBusy] = useState(false);
  const [dropText, setDropText] = useState(initial.dropdown.join("\n"));
  const [headText, setHeadText] = useState(initial.heads.join("\n"));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof KeyForm>(k: K, v: KeyForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter((x) => x !== "");

  const save = async () => {
    setBusy(true);
    const t = toast.loading(part === "leaves" ? "กำลังบันทึกการลา/แลกเวร (Key)… (รอสักครู่)" : "กำลังบันทึกตั้งค่า (Key)… (รอสักครู่)");
    try {
      const res = await fetch("/api/key/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form: f, part }) });
      if (!res.ok) t.error((await res.json().catch(() => ({}))).error ?? `บันทึกไม่สำเร็จ (${res.status})`);
      else {
        t.success("บันทึกสำเร็จ ตาราง Key ทุกเดือนอัปเดตตาม");
        router.refresh();
      }
    } catch {
      t.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  const bar = (
    <div className="savebar">
      <button className="btn btn-primary" disabled={busy || !dirty} onClick={save}>{busy ? <span className="loading loading-spinner loading-xs" /> : <Icon name="Save" size={16} />}{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      <button className="btn btn-ghost" disabled={busy || !dirty} onClick={() => { setF(initial); setDropText(initial.dropdown.join("\n")); setHeadText(initial.heads.join("\n")); }}><Icon name="Undo2" size={16} />ยกเลิกการแก้ไข</button>
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <h1>ตั้งค่า — ตาราง Key</h1>
        <span className="muted">ช่องสีเหลือง = แก้ได้ (เหมือนในชีต) · เปลี่ยนแล้วตารางเวรทุกเดือนอัปเดตเอง</span>
      </div>
      <section className="card">
        <h2>ทั่วไป</h2>
        <div className="grid2">
          <label>วันเริ่มรอบเวียน (วันจันทร์) <span className="cellref">B3</span></label>
          <input className="y" type="date" value={f.rotStart} onChange={(e) => set("rotStart", e.target.value)} />
          <label>ชื่อประจำ Key4 (SMC) <span className="cellref">B4</span></label>
          <input className="y" value={f.key4Name} onChange={(e) => set("key4Name", e.target.value)} />
          <label>หัวหน้าเวรประจำ (R/A) <span className="cellref">B10</span></label>
          <input className="y" value={f.head} onChange={(e) => set("head", e.target.value)} />
          <label>ชื่อผู้ลงนาม <span className="cellref">B5</span></label>
          <input className="y" value={f.signerName} onChange={(e) => set("signerName", e.target.value)} />
          <label>ตำแหน่งผู้ลงนาม <span className="cellref">B6</span></label>
          <input className="y" value={f.signerTitle} onChange={(e) => set("signerTitle", e.target.value)} />
          <label>เกณฑ์ส่วนต่างวันทำงานสูงสุด (วัน) <span className="cellref">B7</span></label>
          <input className="y" type="number" min={0} value={f.threshold} onChange={(e) => set("threshold", Number(e.target.value))} />
          <label>ชื่อหัวตาราง <span className="cellref">B8</span></label>
          <input className="y" value={f.title} onChange={(e) => set("title", e.target.value)} />
          <label>หมายเลขเอกสาร <span className="cellref">B9</span></label>
          <input className="y" value={f.docNo} onChange={(e) => set("docNo", e.target.value)} />
        </div>
      </section>
      <section className="card">
        <h2>ลำดับเวียน (4 คน = 4 จุด เวียนทุกสัปดาห์) <span className="cellref">B13:C16</span></h2>
        <table className="form">
          <thead><tr><th>ลำดับ</th><th>ชื่อพนักงาน</th><th>จุดในสัปดาห์แรก (อ้างอิง ไม่มีผลกับสูตร)</th></tr></thead>
          <tbody>
            {f.rot.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input className="y" value={r.name} onChange={(e) => set("rot", f.rot.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                <td><input className="y" value={r.note} onChange={(e) => set("rot", f.rot.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card scroll-x">
        <h2>วันหยุดนักขัตฤกษ์ / วันหยุดหน่วยงาน <span className="cellref">E13:F58</span></h2>
        <table className="form">
          <thead><tr><th style={{ width: 170 }}>วันที่</th><th>ชื่อวันหยุด</th><th></th></tr></thead>
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
        <h2>รายชื่อใน dropdown <span className="cellref">J13:J58</span> · รายชื่อหัวหน้าเวร (R/A) <span className="cellref">R13:R20</span></h2>
        <p className="muted">หนึ่งบรรทัดต่อหนึ่งชื่อ · สรุปวันทำงานรายเดือนแสดง 20 ชื่อแรกของ dropdown (ตามชีต)</p>
        <div className="grid2">
          <textarea className="y" rows={14} value={dropText} onChange={(e) => { setDropText(e.target.value); set("dropdown", lines(e.target.value)); }} />
          <textarea className="y" rows={8} value={headText} onChange={(e) => { setHeadText(e.target.value); set("heads", lines(e.target.value)); }} />
        </div>
      </section>
      {bar}
    </div>
  );
}
