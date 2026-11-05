"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanCalculator, leaveSpotOf, suggestedReplacement } from "@/lib/shift3/engine";
import { MONTH_SHORT, parseYm, shiftYm } from "@/lib/config";
import { serialFromYMD, toSerial } from "@/lib/sheets-date";
import { leaveRowProblems } from "@/lib/leave-rules";
import { useToast } from "./Toast";
import Icon from "./Icon";
import type { Shift3Settings } from "@/lib/shift3/types";
import type { LeaveForm, LeaveSyncResult } from "@/lib/shift3/repo";

const TABLE_NAME: Record<string, string> = { shift3: "3 ช่วงเวลา", key: "Key", smc: "SMC", ot: "OT" };

interface Props {
  initial: LeaveForm[];
  settings: Shift3Settings;
  staff: string[];
  allNames: string[];
  sync?: LeaveSyncResult;
  /** ผลการดึงของทุกชีต (ดึงครั้งเดียวเข้าครบ 4 ชีต) */
  syncAll?: Record<string, LeaveSyncResult>;
  ym: string;
}

export default function LeavesClient({ initial, settings, staff, allNames, sync, syncAll, ym }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<LeaveForm[]>(initial);
  const pmo = parseYm(ym);
  const monthLabel = pmo ? `${MONTH_SHORT[pmo.month - 1]} ${pmo.yearBE}` : ym;
  const prevYm = pmo ? shiftYm(pmo.yearBE, pmo.month, -1) : ym;
  const nextYm = pmo ? shiftYm(pmo.yearBE, pmo.month, 1) : ym;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const plan = useMemo(() => new PlanCalculator(settings), [settings]);
  const winS = pmo ? serialFromYMD(pmo.yearBE - 543, pmo.month, 1) : null;
  const winE = pmo ? serialFromYMD(pmo.yearBE - 543, pmo.month + 1, 0) : null;
  const outside = winS === null || winE === null ? 0 : rows.filter((r) => { const d = toSerial(r.date); return d !== null && (d < winS || d > winE); }).length;
  const problems = leaveRowProblems(rows);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const upd = (i: number, k: keyof LeaveForm, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const [pulling, setPulling] = useState(false);
  const pull = async () => {
    if (dirty && !window.confirm("มีการแก้ไขที่ยังไม่บันทึก — ดึงข้อมูลใหม่จะล้างการแก้ไขนี้ ทำต่อหรือไม่?")) return;
    setPulling(true);
    const t = toast.loading("กำลังดึงการลาจากระบบลา…");
    try {
      const r = await fetch("/api/shift3/leaves/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ym }) });
      const j = (await r.json().catch(() => ({}))) as Partial<LeaveSyncResult> & { all?: Record<string, LeaveSyncResult> };
      if (!r.ok || j.error) t.error(j.error ?? `ดึงข้อมูลไม่สำเร็จ (${r.status})`);
      else {
        const all = Object.values(j.all ?? {}) as LeaveSyncResult[];
        const add = all.reduce((n, x) => n + (x.added ?? 0), 0);
        const rem = all.reduce((n, x) => n + (x.removed ?? 0), 0);
        const bad = all.filter((x) => x.error).length;
        t.success(`ดึงข้อมูลแล้ว ทั้ง 4 ชีต · ตารางนี้ เพิ่ม ${j.added ?? 0} · นำออก ${j.removed ?? 0} · รวมทุกชีต เพิ่ม ${add} · นำออก ${rem}${bad ? ` · ผิดพลาด ${bad} ชีต` : ""}`);
      }
      router.refresh();
    } catch {
      t.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setPulling(false);
    }
  };
  useEffect(() => setRows(initial), [initial]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const t = toast.loading("กำลังบันทึกการลา/แลกเวร… (รอสักครู่)");
    try {
      const res = await fetch("/api/shift3/leaves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, ym }) });
      if (!res.ok) {
        const text = (await res.json().catch(() => ({}))).error ?? `บันทึกไม่สำเร็จ (${res.status})`;
        setMsg({ ok: false, text });
        t.error(text);
      } else {
        setMsg({ ok: true, text: `บันทึกเดือน ${monthLabel} ลงชีต ลา-แลกเวร แล้ว (เดือนอื่นไม่ถูกแตะ)` });
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
        <h1>บันทึกการลา / แลกเวร รายวัน · {monthLabel}</h1>
        <span className="muted">กรอก 1 แถวต่อ 1 คน 1 วัน · ถ้ายังไม่ใส่คนแทน ตารางจะขึ้น &apos;⚠ ชื่อ ลา&apos; สีแดง · มีผลทั้ง 3 ช่วงเวลา</span>
      </div>
      <div className={sync?.error ? "sync-bar bad" : "sync-bar"}>
        <Icon name={sync?.error ? "TriangleAlert" : "CalendarCheck"} size={18} />
        <div className="sync-text">
          <b>ดึงอัตโนมัติจากระบบลา</b> (ดึงครั้งเดียวเข้าครบทั้ง 4 ชีต) — เฉพาะที่ Approve แล้ว (ลาป่วย / ลากิจ / ลาพักร้อน / ลาอื่นๆ) เฉพาะเดือน <b>{monthLabel}</b> ที่กำลังจัดทำ · 1 แถวต่อ 1 วันทำการ
          {sync && !sync.error && (
            <span className="muted"> · ล่าสุด {sync.at} น. เพิ่ม {sync.added} · นำออก {sync.removed}</span>
          )}
          {sync?.error && <div className="error">{sync.error}</div>}
          {syncAll && (
            <div className="muted small">
              ดึงครั้งเดียวเข้าแท็บ ลา-แลกเวร ครบทั้ง 4 ชีต:{" "}
              {(Object.entries(syncAll) as [string, LeaveSyncResult][]).map(([t, r], i) => (
                <span key={t} className={r.error ? "error" : undefined}>
                  {i > 0 ? " · " : ""}
                  {TABLE_NAME[t] ?? t} {r.error ? "ผิดพลาด" : `+${r.added} −${r.removed}`}
                </span>
              ))}
            </div>
          )}
          {sync && sync.skippedNames.length > 0 && (
            <div className="muted small">ไม่ได้ดึง (ไม่ใช่พนักงานตารางนี้): {sync.skippedNames.join(", ")}</div>
          )}
        </div>
        <div className="join">
          <button className="btn btn-sm join-item btn-soft" disabled={pulling || busy || dirty} onClick={() => router.push(`/leaves?ym=${prevYm}`)} title="เดือนก่อนหน้า" aria-label="เดือนก่อนหน้า"><Icon name="ChevronLeft" size={14} /></button>
          <span className="btn btn-sm join-item btn-soft no-animation pointer-events-none">{monthLabel}</span>
          <button className="btn btn-sm join-item btn-soft" disabled={pulling || busy || dirty} onClick={() => router.push(`/leaves?ym=${nextYm}`)} title="เดือนถัดไป" aria-label="เดือนถัดไป"><Icon name="ChevronRight" size={14} /></button>
        </div>
        <button className="btn btn-sm btn-soft btn-primary" disabled={pulling || busy} onClick={pull}>
          {pulling ? <span className="loading loading-spinner loading-xs" /> : <Icon name="RotateCcw" size={14} />}
          ดึงข้อมูลล่าสุด
        </button>
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
                <tr key={i} className={r.ref ? "from-sys" : undefined}>
                  {r.ref ? (
                    <>
                      <td className="ro">
                        {r.date} <span className="badge badge-soft badge-info badge-xs">ระบบลา</span>
                      </td>
                      <td className="ro"><b>{r.name}</b></td>
                    </>
                  ) : (
                    <>
                      <td><input className="y" type="date" value={r.date} onChange={(e) => upd(i, "date", e.target.value)} /></td>
                      <td><input className="y" list="staff" value={r.name} onChange={(e) => upd(i, "name", e.target.value)} /></td>
                    </>
                  )}
                  <td>
                    <input className={problems.has(i) ? "y input-error" : "y"} list="all" value={r.replacement} style={problems.has(i) ? { background: "#FDE2E1", borderColor: "#C00000" } : undefined} title={problems.get(i)} onChange={(e) => upd(i, "replacement", e.target.value)} />
                    {problems.has(i) && <div className="error small">{problems.get(i)}</div>}
                  </td>
                  <td>{r.ref ? <span className="ro">{r.type}</span> : <input className="y" value={r.type} onChange={(e) => upd(i, "type", e.target.value)} />}</td>
                  <td className="ro">{r.name && d !== null ? leaveSpotOf(plan, d, r.name) : ""}</td>
                  <td className="ro">{d !== null ? suggestedReplacement(plan, d) : ""}</td>
                  <td><input value={r.note} onChange={(e) => upd(i, "note", e.target.value)} /></td>
                  <td>
                    {r.ref ? (
                      <span className="muted small" title="แก้/ยกเลิกที่ระบบลา แล้วกด ดึงข้อมูลล่าสุด">อัตโนมัติ</span>
                    ) : (
                      <button onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>ลบ</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted">ยังไม่มีรายการลา/แลกเวรของเดือน {monthLabel}</p>}
        <p><button onClick={() => setRows((x) => [...x, { date: "", name: "", replacement: "", type: "", note: "" }])}>+ เพิ่มรายการ</button></p>
        {outside > 0 && <p className="error small">มี {outside} แถวที่วันที่ไม่อยู่ในเดือน {monthLabel} — บันทึกได้ แต่แถวนั้นจะไปอยู่ในเดือนของวันที่นั้น (เลื่อนเดือนเพื่อดู)</p>}
      </section>
      <div className="savebar">
        <button className="btn btn-primary" disabled={busy || !dirty || problems.size > 0} onClick={save}>{busy ? <span className="loading loading-spinner loading-xs" /> : <Icon name="Save" size={16} />}{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        <button className="btn btn-ghost" disabled={busy || !dirty} onClick={() => setRows(initial)}><Icon name="Undo2" size={16} />ยกเลิกการแก้ไข</button>
        {problems.size > 0 && <span className="error">แก้ช่องคนมาแทนที่ขึ้นสีแดง {problems.size} แถวก่อน จึงจะบันทึกได้</span>}
        {msg && <span className={msg.ok ? "ok" : "error"}>{msg.text}</span>}
      </div>
    </div>
  );
}
