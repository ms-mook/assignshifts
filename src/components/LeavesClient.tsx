"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanCalculator, leaveSpotOf, suggestedReplacement } from "@/lib/shift3/engine";
import { toSerial } from "@/lib/sheets-date";
import { useToast } from "./Toast";
import type { Shift3Settings } from "@/lib/shift3/types";
import type { LeaveForm } from "@/lib/shift3/repo";

interface Props {
  initial: LeaveForm[];
  settings: Shift3Settings;
  staff: string[];
  allNames: string[];
}

export default function LeavesClient({ initial, settings, staff, allNames }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<LeaveForm[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const plan = useMemo(() => new PlanCalculator(settings), [settings]);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const upd = (i: number, k: keyof LeaveForm, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const t = toast.loading("กำลังบันทึกการลา/แลกเวร… (รอสักครู่)");
    try {
      const res = await fetch("/api/shift3/leaves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      if (!res.ok) {
        const text = (await res.json().catch(() => ({}))).error ?? `บันทึกไม่สำเร็จ (${res.status})`;
        setMsg({ ok: false, text });
        t.error(text);
      } else {
        setMsg({ ok: true, text: "บันทึกลงชีต ลา-แลกเวร แล้ว" });
        t.success("บันทึกการลา/แลกเวรสำเร็จ ตารางจะอัปเดตตามอัตโนมัติ");
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
        <h1>บันทึกการลา / แลกเวร รายวัน</h1>
        <span className="muted">กรอก 1 แถวต่อ 1 คน 1 วัน · ถ้ายังไม่ใส่คนแทน ตารางจะขึ้น &apos;⚠ ชื่อ ลา&apos; สีแดง · มีผลทั้ง 3 ช่วงเวลา</span>
      </div>
      <datalist id="staff">{staff.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="all">{allNames.map((n) => <option key={n} value={n} />)}</datalist>
      <section className="card scroll-x">
        <table className="form">
          <thead>
            <tr>
              <th style={{ width: 160 }}>วันที่</th>
              <th>ชื่อคนลา</th>
              <th>ชื่อคนมาแทน (ว่าง = ยังไม่มีคนแทน)</th>
              <th>ประเภท</th>
              <th>จุดของคนลา ช่วงเช้า (อัตโนมัติ)</th>
              <th>คนที่อยู่ OPD ทั่วไป12 วันนั้น (แนะนำให้แทน)</th>
              <th>หมายเหตุ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const d = toSerial(r.date);
              return (
                <tr key={i}>
                  <td><input className="y" type="date" value={r.date} onChange={(e) => upd(i, "date", e.target.value)} /></td>
                  <td><input className="y" list="staff" value={r.name} onChange={(e) => upd(i, "name", e.target.value)} /></td>
                  <td><input className="y" list="all" value={r.replacement} onChange={(e) => upd(i, "replacement", e.target.value)} /></td>
                  <td><input className="y" value={r.type} onChange={(e) => upd(i, "type", e.target.value)} /></td>
                  <td className="ro">{r.name && d !== null ? leaveSpotOf(plan, d, r.name) : ""}</td>
                  <td className="ro">{d !== null ? suggestedReplacement(plan, d) : ""}</td>
                  <td><input value={r.note} onChange={(e) => upd(i, "note", e.target.value)} /></td>
                  <td><button onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>ลบ</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p><button onClick={() => setRows((x) => [...x, { date: "", name: "", replacement: "", type: "", note: "" }])}>+ เพิ่มรายการ</button></p>
      </section>
      <div className="savebar">
        <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        <button disabled={busy || !dirty} onClick={() => setRows(initial)}>ยกเลิกการแก้ไข</button>
        {msg && <span className={msg.ok ? "ok" : "error"}>{msg.text}</span>}
      </div>
    </div>
  );
}
