"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leaveInfo, type OtSettings } from "@/lib/ot/engine";
import { toSerial } from "@/lib/sheets-date";
import { useToast } from "./Toast";
import type { OtLeaveForm } from "@/lib/ot/repo";

const TYPES = ["ลาป่วย", "ลากิจ", "ลาพักร้อน", "อบรม/ประชุม", "แลกเวร", "อื่นๆ"];

export default function OtLeavesClient({ initial, settings, names }: { initial: OtLeaveForm[]; settings: OtSettings; names: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<OtLeaveForm[]>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const upd = (i: number, k: keyof OtLeaveForm, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const save = async () => {
    setBusy(true);
    const t = toast.loading("กำลังบันทึกการลา/แลกเวร (OT)… (รอสักครู่)");
    try {
      const res = await fetch("/api/ot/leaves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      if (!res.ok) t.error((await res.json().catch(() => ({}))).error ?? `บันทึกไม่สำเร็จ (${res.status})`);
      else {
        t.success("บันทึกสำเร็จ ตาราง OTจะอัปเดตตามอัตโนมัติ");
        router.refresh();
      }
    } catch {
      t.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>บันทึกการลา / แลกเวร รายวัน — ตาราง OT</h1>
        <span className="muted">กรอก 1 แถวต่อ 1 คน 1 วัน (ลาหลายวันให้กรอกทีละวัน) · ถ้ายังไม่ใส่คนแทน ฟอร์มรายเดือนจะขึ้น ⚠ สีแดง · คนที่ถูกดึงไปแทนจะขึ้น &apos;→ ไปช่วยจุดอื่น&apos; ที่จุดเดิม</span>
      </div>
      <datalist id="ot-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <section className="card scroll-x">
        <table className="form">
          <thead>
            <tr>
              <th style={{ width: 160 }}>วันที่</th>
              <th>ชื่อคนลา</th>
              <th>ชื่อคนมาแทน (เว้นว่าง = ยังไม่มีคนแทน)</th>
              <th>ประเภท</th>
              <th>จุดของคนลาในวันนั้น (อัตโนมัติ)</th>
              <th>คนที่อยู่บัตรคิว SMC วันนั้น (แนะนำให้แทน)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const info = leaveInfo(settings, { date: toSerial(r.date), who: r.who, sub: r.sub, type: r.type });
              const warn = r.date && r.who && !r.sub;
              return (
                <tr key={i}>
                  <td><input className="y" type="date" value={r.date} onChange={(e) => upd(i, "date", e.target.value)} /></td>
                  <td><input className="y" list="ot-names" value={r.who} onChange={(e) => upd(i, "who", e.target.value)} /></td>
                  <td><input className="y" list="ot-names" value={r.sub} style={warn ? { background: "#FF7B80" } : undefined} onChange={(e) => upd(i, "sub", e.target.value)} /></td>
                  <td>
                    <select className="y" value={r.type} onChange={(e) => upd(i, "type", e.target.value)}>
                      <option value=""></option>
                      {TYPES.map((x) => <option key={x}>{x}</option>)}
                      {r.type && !TYPES.includes(r.type) && <option>{r.type}</option>}
                    </select>
                  </td>
                  <td className="ro">{info.spot}</td>
                  <td className="ro">{info.smcPerson}</td>
                  <td><button onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>ลบ</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p><button onClick={() => setRows((x) => [...x, { date: "", who: "", sub: "", type: "" }])}>+ เพิ่มรายการ</button></p>
      </section>
      <div className="savebar">
        <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        <button disabled={busy || !dirty} onClick={() => setRows(initial)}>ยกเลิกการแก้ไข</button>
      </div>
    </div>
  );
}
