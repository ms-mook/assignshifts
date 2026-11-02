"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import type { SmcForm } from "@/lib/smc/repo";

const TYPES = ["ลาป่วย", "ลากิจ", "ลาพักร้อน", "อบรม/ประชุม", "สลับเวร", "ไม่อยู่ปฏิบัติงาน", "อื่นๆ"];
type ListKey = "listJ" | "listL" | "listN" | "listP" | "listT";
const LISTS: { k: ListKey; label: string; ref: string; max: number }[] = [
  { k: "listJ", label: "รายชื่อ จนท.จ้างเหมาฯ", ref: "J17:J46", max: 30 },
  { k: "listL", label: "รายชื่อ Key1 / ช่อง 3,4,5 (07.00–08.30) และคนแทน", ref: "L17:L46", max: 30 },
  { k: "listN", label: "dropdown 08.30–12.30 ช่อง 3,4 / ช่อง 5", ref: "N17:N46", max: 30 },
  { k: "listP", label: "dropdown 12.30–16.00 ช่อง 2,3,4,5", ref: "P17:P46", max: 30 },
  { k: "listT", label: "ผู้แทนอัมพร (4 คน)", ref: "T17:T20", max: 4 },
];

export default function SmcFormClient({ initial, part }: { initial: SmcForm; part: "settings" | "leaves" }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<SmcForm>(initial);
  const [busy, setBusy] = useState(false);
  const [texts, setTexts] = useState<Record<ListKey, string>>(() => Object.fromEntries(LISTS.map((l) => [l.k, initial[l.k].join("\n")])) as Record<ListKey, string>);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof SmcForm>(k: K, v: SmcForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const allNames = Array.from(new Set([...f.listJ, ...f.listL, ...f.listN, ...f.listP, ...f.listT]));

  const save = async () => {
    setBusy(true);
    const t = toast.loading(part === "leaves" ? "กำลังบันทึกตารางลา (SMC)… (รอสักครู่)" : "กำลังบันทึกตั้งค่า (SMC)… (รอสักครู่)");
    try {
      const res = await fetch("/api/smc/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form: f, part }) });
      if (!res.ok) t.error((await res.json().catch(() => ({}))).error ?? `บันทึกไม่สำเร็จ (${res.status})`);
      else {
        t.success("บันทึกสำเร็จ ตาราง SMC ทุกเดือนอัปเดตตาม");
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
      <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      <button disabled={busy || !dirty} onClick={() => { setF(initial); setTexts(Object.fromEntries(LISTS.map((l) => [l.k, initial[l.k].join("\n")])) as Record<ListKey, string>); }}>ยกเลิกการแก้ไข</button>
    </div>
  );

  if (part === "leaves")
    return (
      <div>
        <div className="page-head">
          <h1>ตารางวันลา / ขอสลับเวร / ไม่อยู่ปฏิบัติงาน — ตาราง SMC</h1>
          <span className="muted">กรอก 1 แถวต่อ 1 รายการ · ถ้าใส่คนแทน ช่องของคนนั้นในตารางเวรจะเปลี่ยนเป็นคนแทนอัตโนมัติ · ถ้าชื่อยังค้างในตารางเวร จะขึ้นสีส้มเตือน</span>
        </div>
        <datalist id="smc-names">{allNames.map((n) => <option key={n} value={n} />)}</datalist>
        <section className="card scroll-x">
          <table className="form">
            <thead><tr><th>ชื่อพนักงาน</th><th style={{ width: 160 }}>วันที่เริ่ม</th><th style={{ width: 160 }}>วันที่สิ้นสุด (ว่าง = วันเดียว)</th><th>ประเภท</th><th>คนแทน / คู่สลับเวร</th><th>หมายเหตุ</th><th>จำนวนวัน (อัตโนมัติ)</th><th></th></tr></thead>
            <tbody>
              {f.leaves.map((l, i) => {
                const u = (k: keyof typeof l, v: string) => set("leaves", f.leaves.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                const end = l.name && l.start ? l.end || l.start : "";
                const days = end ? Math.round((Date.parse(end) - Date.parse(l.start)) / 86400000) + 1 : "";
                return (
                  <tr key={i}>
                    <td><input className="y" list="smc-names" value={l.name} onChange={(e) => u("name", e.target.value)} /></td>
                    <td><input className="y" type="date" value={l.start} onChange={(e) => u("start", e.target.value)} /></td>
                    <td><input className="y" type="date" value={l.end} onChange={(e) => u("end", e.target.value)} /></td>
                    <td>
                      <select className="y" value={l.type} onChange={(e) => u("type", e.target.value)}>
                        <option value=""></option>
                        {TYPES.map((x) => <option key={x}>{x}</option>)}
                        {l.type && !TYPES.includes(l.type) && <option>{l.type}</option>}
                      </select>
                    </td>
                    <td><input className="y" list="smc-names" value={l.sub} onChange={(e) => u("sub", e.target.value)} /></td>
                    <td><input className="y" value={l.note} onChange={(e) => u("note", e.target.value)} /></td>
                    <td className="ro">{days}</td>
                    <td><button onClick={() => set("leaves", f.leaves.filter((_, j) => j !== i))}>ลบ</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p><button disabled={f.leaves.length >= 196} onClick={() => set("leaves", [...f.leaves, { name: "", start: "", end: "", type: "", sub: "", note: "" }])}>+ เพิ่มรายการ</button></p>
        </section>
        {bar}
      </div>
    );

  const txt = (k: keyof SmcForm, label: string, ref: string) => (
    <>
      <label>{label} <span className="cellref">{ref}</span></label>
      <input className="y" value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} />
    </>
  );
  return (
    <div>
      <div className="page-head">
        <h1>ตั้งค่า — ตาราง SMC</h1>
        <span className="muted">ช่องสีเหลือง = แก้ได้ (เหมือนในชีต) · เปลี่ยนแล้วตารางเวรทุกเดือนอัปเดตเอง</span>
      </div>
      <section className="card">
        <h2>ทั่วไป</h2>
        <div className="grid2">
          {txt("title", "ชื่อหัวตาราง", "B3")}
          {txt("docNo", "หมายเลขเอกสาร", "B4")}
          {txt("signerName", "ชื่อผู้จัดทำ (ท้ายตาราง)", "B5")}
          {txt("signerTitle", "ตำแหน่งผู้จัดทำ", "B6")}
          {txt("q0700", "ค่าตั้งต้น Manager/Q บัตรคิว 07.00–08.30 น.", "B7")}
          {txt("q0830", "ค่าตั้งต้น Manager/Q บัตรคิว 08.30–12.30 น.", "B8")}
          {txt("q1230", "ค่าตั้งต้น Manager/Q ช่อง1/บัตรคิว 12.30–16.00 น.", "B9")}
          {txt("key0700", "ค่าตั้งต้น ลงทะเบียน Key1 07.00–08.30 น.", "B10")}
          {txt("key0830", "ค่าตั้งต้น ลงทะเบียน Key1 08.30–12.30 น.", "B11")}
          {txt("mt", "ข้อความช่องประจำ (MT)", "B12")}
          {txt("pt", "ข้อความช่องประจำ (Part-time)", "B13")}
          {(["07.00–08.30 น.", "08.30–12.30 น.", "12.30–16.00 น."] as const).map((lb, i) => (
            <span key={lb} style={{ display: "contents" }}>
              <label>ชั่วโมงต่อช่วงเวลา {lb} <span className="cellref">F{4 + i}</span></label>
              <input className="y" type="number" step={0.5} value={f.hours[i]} onChange={(e) => set("hours", f.hours.map((x, j) => (j === i ? Number(e.target.value) : x)) as [number, number, number])} />
            </span>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>รายชื่อสำหรับ dropdown</h2>
        <p className="muted">หนึ่งบรรทัดต่อหนึ่งชื่อ</p>
        <div className="grid2">
          {LISTS.map((l) => (
            <span key={l.k} style={{ display: "contents" }}>
              <label>{l.label} <span className="cellref">{l.ref}</span></label>
              <textarea className="y" rows={l.max > 4 ? 8 : 4} value={texts[l.k]} onChange={(e) => { setTexts((x) => ({ ...x, [l.k]: e.target.value })); set(l.k, e.target.value.split("\n").map((x) => x.trim()).filter((x) => x !== "")); }} />
            </span>
          ))}
        </div>
      </section>
      <section className="card scroll-x">
        <h2>วันหยุดนักขัตฤกษ์ <span className="cellref">E17:F66</span></h2>
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
        <p><button disabled={f.holidays.length >= 50} onClick={() => set("holidays", [...f.holidays, { date: "", name: "" }])}>+ เพิ่มวันหยุด</button></p>
      </section>
      {bar}
    </div>
  );
}
