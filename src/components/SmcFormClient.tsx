"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import Icon from "./Icon";
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
      <button className="btn btn-primary" disabled={busy || !dirty} onClick={save}>{busy ? <span className="loading loading-spinner loading-xs" /> : <Icon name="Save" size={16} />}{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      <button className="btn btn-ghost" disabled={busy || !dirty} onClick={() => { setF(initial); setTexts(Object.fromEntries(LISTS.map((l) => [l.k, initial[l.k].join("\n")])) as Record<ListKey, string>); }}><Icon name="Undo2" size={16} />ยกเลิกการแก้ไข</button>
    </div>
  );

  const field = (k: keyof SmcForm, label: string, ref: string, wide = false) => (
    <label className={wide ? "sf-field wide" : "sf-field"}>
      <span className="sf-label">
        {label} <span className="cellref">{ref}</span>
      </span>
      <input className="y" value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} />
    </label>
  );
  const TIMES = ["07.00–08.30 น.", "08.30–12.30 น.", "12.30–16.00 น."] as const;
  return (
    <div>
      <div className="page-head">
        <h1>ตั้งค่า — ตาราง SMC</h1>
        <span className="muted">ช่องสีเหลือง = แก้ได้ (เหมือนในชีต) · เปลี่ยนแล้วตารางเวรทุกเดือนอัปเดตเอง</span>
      </div>

      <div className="sf-grid">
        <section className="card">
          <h2>
            <Icon name="SquarePen" size={18} /> หัวตาราง และผู้จัดทำ
          </h2>
          <div className="sf-fields">
            {field("title", "ชื่อหัวตาราง", "B3", true)}
            {field("docNo", "หมายเลขเอกสาร", "B4", true)}
            {field("signerName", "ชื่อผู้จัดทำ (ท้ายตาราง)", "B5")}
            {field("signerTitle", "ตำแหน่งผู้จัดทำ", "B6")}
          </div>
        </section>

        <section className="card">
          <h2>
            <Icon name="Clock" size={18} /> ชั่วโมงต่อช่วงเวลา
            <small>ใช้คำนวณชั่วโมงในหน้าสรุป</small>
          </h2>
          <div className="sf-hours">
            {TIMES.map((lb, i) => (
              <label key={lb} className="sf-hour">
                <span className="sf-time">{lb}</span>
                <span className="sf-hour-in">
                  <input className="y" type="number" step={0.5} min={0} value={f.hours[i]} onChange={(e) => set("hours", f.hours.map((x, j) => (j === i ? Number(e.target.value) : x)) as [number, number, number])} />
                  <span className="muted">ชม.</span>
                </span>
                <span className="cellref">F{4 + i}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <h2>
          <Icon name="LayoutGrid" size={18} /> ค่าตั้งต้นในตารางเวร
          <small>ข้อความที่ขึ้นในช่องเมื่อไม่ได้แก้เอง</small>
        </h2>
        <div className="sf-cols">
          <div className="sf-col">
            <div className="sf-col-head">Manager/Q บัตรคิว</div>
            {field("q0700", "07.00–08.30 น.", "B7")}
            {field("q0830", "08.30–12.30 น.", "B8")}
            {field("q1230", "12.30–16.00 น. (ช่อง1/บัตรคิว)", "B9")}
          </div>
          <div className="sf-col">
            <div className="sf-col-head">ลงทะเบียน Key1</div>
            {field("key0700", "07.00–08.30 น.", "B10")}
            {field("key0830", "08.30–12.30 น.", "B11")}
          </div>
          <div className="sf-col">
            <div className="sf-col-head">ข้อความช่องประจำ</div>
            {field("mt", "MT", "B12")}
            {field("pt", "Part-time", "B13")}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>
          <Icon name="Users" size={18} /> รายชื่อสำหรับ dropdown
          <small>หนึ่งบรรทัดต่อหนึ่งชื่อ</small>
        </h2>
        <div className="sf-lists">
          {LISTS.map((l) => {
            const n = f[l.k].length;
            const over = n > l.max;
            return (
              <div key={l.k} className={over ? "sf-list over" : "sf-list"}>
                <div className="sf-list-head">
                  <span className="sf-list-title">{l.label}</span>
                  <span className="sf-list-meta">
                    <span className={over ? "badge badge-error badge-sm" : "badge badge-soft badge-primary badge-sm"}>
                      {n}/{l.max} ชื่อ
                    </span>
                    <span className="cellref">{l.ref}</span>
                  </span>
                </div>
                <textarea
                  className="y"
                  rows={l.max > 4 ? 10 : 4}
                  value={texts[l.k]}
                  onChange={(e) => {
                    setTexts((x) => ({ ...x, [l.k]: e.target.value }));
                    set(l.k, e.target.value.split("\n").map((x) => x.trim()).filter((x) => x !== ""));
                  }}
                />
                {over && <div className="sf-over"><Icon name="TriangleAlert" size={13} /> เกิน {l.max} ชื่อ (ในชีตมีช่องแค่ {l.max} แถว)</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>
          <Icon name="CalendarX" size={18} /> วันหยุดนักขัตฤกษ์
          <span className="badge badge-soft badge-primary badge-sm">{f.holidays.length}/50 วัน</span>
          <span className="cellref">E17:F66</span>
        </h2>
        <div className="sf-hol">
          {f.holidays.map((h, i) => (
            <div key={i} className="sf-hol-row">
              <input className="y" type="date" aria-label="วันที่" value={h.date} onChange={(e) => set("holidays", f.holidays.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
              <input className="y" aria-label="ชื่อวันหยุด" placeholder="ชื่อวันหยุด" value={h.name} onChange={(e) => set("holidays", f.holidays.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <button className="btn btn-xs btn-ghost btn-square text-error" title="ลบวันหยุดนี้" aria-label="ลบ" onClick={() => set("holidays", f.holidays.filter((_, j) => j !== i))}>
                <Icon name="Trash" size={15} />
              </button>
            </div>
          ))}
          {f.holidays.length === 0 && <div className="muted">ยังไม่มีวันหยุด</div>}
        </div>
        <div className="sf-actions">
          <button className="btn btn-sm btn-soft btn-primary" disabled={f.holidays.length >= 50} onClick={() => set("holidays", [...f.holidays, { date: "", name: "" }])}><Icon name="Plus" size={14} />เพิ่มวันหยุด</button>
          <button className="btn btn-sm btn-ghost" onClick={() => set("holidays", [...f.holidays].sort((a, b) => (a.date || "9").localeCompare(b.date || "9")))}><Icon name="ArrowDownAZ" size={14} />เรียงตามวันที่</button>
        </div>
      </section>
      {bar}
    </div>
  );
}
