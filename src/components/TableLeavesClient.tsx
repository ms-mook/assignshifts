"use client";

// หน้า ลา-แลกเวร ของตาราง Key / SMC / OT — แท็บ ลา-แลกเวร รูปแบบเดียวกับตาราง 3 ช่วงเวลา
// แสดง/บันทึกเฉพาะเดือนที่กำลังจัดทำ · ดึงการลาที่ Approve จากระบบลาเฉพาะเดือนนั้น
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MONTH_SHORT, parseYm, shiftYm } from "@/lib/config";
import { serialFromYMD, toSerial } from "@/lib/sheets-date";
import { keyLeaveSpot, type KeySettings } from "@/lib/key/engine";
import { leaveInfo, type OtSettings } from "@/lib/ot/engine";
import { leaveRowProblems } from "@/lib/leave-rules";
import { useToast } from "./Toast";
import Icon from "./Icon";
import type { LeaveForm, LeaveSyncResult } from "@/lib/leave-tab";

const TYPES = ["ลาป่วย", "ลากิจ", "ลาพักร้อน", "ลาอื่นๆ", "อบรม/ประชุม", "แลกเวร", "อื่นๆ"];

const TABLE_NAME: Record<string, string> = { shift3: "3 ช่วงเวลา", key: "Key", smc: "SMC", ot: "OT" };

interface Props {
  table: "key" | "smc" | "ot";
  title: string;
  ym: string;
  initial: LeaveForm[];
  names: string[];
  sync?: LeaveSyncResult;
  /** ผลการดึงของทุกชีต (ดึงครั้งเดียวเข้าครบ 4 ชีต) */
  syncAll?: Record<string, LeaveSyncResult>;
  keySettings?: KeySettings;
  otSettings?: OtSettings;
}

export default function TableLeavesClient({ table, title, ym, initial, names, sync, syncAll, keySettings, otSettings }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<LeaveForm[]>(initial);
  const [busy, setBusy] = useState(false);
  const [pulling, setPulling] = useState(false);
  useEffect(() => setRows(initial), [initial]);

  const pm = parseYm(ym);
  const monthLabel = pm ? `${MONTH_SHORT[pm.month - 1]} ${pm.yearBE}` : ym;
  const prevYm = pm ? shiftYm(pm.yearBE, pm.month, -1) : ym;
  const nextYm = pm ? shiftYm(pm.yearBE, pm.month, 1) : ym;
  const winS = pm ? serialFromYMD(pm.yearBE - 543, pm.month, 1) : null;
  const winE = pm ? serialFromYMD(pm.yearBE - 543, pm.month + 1, 0) : null;
  const outside = winS === null || winE === null ? 0 : rows.filter((r) => { const d = toSerial(r.date); return d !== null && (d < winS || d > winE); }).length;
  const problems = leaveRowProblems(rows);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const upd = (i: number, k: keyof LeaveForm, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const pull = async () => {
    if (dirty && !window.confirm("มีการแก้ไขที่ยังไม่บันทึก — ดึงข้อมูลใหม่จะล้างการแก้ไขนี้ ทำต่อหรือไม่?")) return;
    setPulling(true);
    const t = toast.loading("กำลังดึงการลาจากระบบลา…");
    try {
      const r = await fetch(`/api/leaves/${table}/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ym }) });
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

  const save = async () => {
    setBusy(true);
    const t = toast.loading(`กำลังบันทึกการลา/แลกเวร (${title})… (รอสักครู่)`);
    try {
      const res = await fetch(`/api/leaves/${table}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, ym }) });
      if (!res.ok) t.error((await res.json().catch(() => ({}))).error ?? `บันทึกไม่สำเร็จ (${res.status})`);
      else {
        t.success(`บันทึกเดือน ${monthLabel} แล้ว (เดือนอื่นไม่ถูกแตะ) ตารางจะอัปเดตตามอัตโนมัติ`);
        router.refresh();
      }
    } catch {
      t.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  const auto = (r: LeaveForm): string[] => {
    const d = toSerial(r.date);
    if (table === "key" && keySettings) return [r.name && d !== null ? keyLeaveSpot(keySettings, { date: d, who: r.name, sub: r.replacement, note: r.note }) : ""];
    if (table === "ot" && otSettings) {
      const info = leaveInfo(otSettings, { date: d, who: r.name, sub: r.replacement, type: r.type });
      return [info.spot, info.smcPerson];
    }
    return [];
  };
  const autoHead = table === "key" ? ["จุดที่ลา (อัตโนมัติ)"] : table === "ot" ? ["จุดของคนลาในวันนั้น (อัตโนมัติ)", "คนที่อยู่บัตรคิว SMC วันนั้น (แนะนำให้แทน)"] : [];
  const hint =
    table === "key"
      ? "ถ้าไม่ใส่คนแทน ช่องในตารางเวรจะขึ้น \"ลา\""
      : table === "smc"
        ? "ชื่อคนลาจะหายจาก dropdown ของวันนั้น · ใส่คนแทนแล้วช่องประจำจะเปลี่ยนเป็นคนแทน"
        : "ถ้ายังไม่ใส่คนแทน ฟอร์มรายเดือนจะขึ้น ⚠ สีแดง · คนที่ถูกดึงไปแทนจะขึ้น '→ ไปช่วยจุดอื่น' ที่จุดเดิม";

  return (
    <div>
      <div className="page-head">
        <h1>บันทึกการลา / แลกเวร รายวัน — {title} · {monthLabel}</h1>
        <span className="muted">กรอก 1 แถวต่อ 1 คน 1 วัน · {hint}</span>
      </div>
      <div className={sync?.error ? "sync-bar bad" : "sync-bar"}>
        <Icon name={sync?.error ? "TriangleAlert" : "CalendarCheck"} size={18} />
        <div className="sync-text">
          <b>ดึงอัตโนมัติจากระบบลา</b> (ดึงครั้งเดียวเข้าครบทั้ง 4 ชีต) — เฉพาะที่ Approve แล้ว (ลาป่วย / ลากิจ / ลาพักร้อน / ลาอื่นๆ) เฉพาะเดือน <b>{monthLabel}</b> ที่กำลังจัดทำ · 1 แถวต่อ 1 วันทำการ
          {sync && !sync.error && <span className="muted"> · ล่าสุด {sync.at} น. เพิ่ม {sync.added} · นำออก {sync.removed}</span>}
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
          {sync && sync.skippedNames.length > 0 && <div className="muted small">ไม่ได้ดึง (ไม่ใช่พนักงานตารางนี้): {sync.skippedNames.join(", ")}</div>}
        </div>
        <div className="join">
          <button className="btn btn-sm join-item btn-soft" disabled={pulling || busy || dirty} onClick={() => router.push(`/${table}/leaves?ym=${prevYm}`)} title="เดือนก่อนหน้า" aria-label="เดือนก่อนหน้า"><Icon name="ChevronLeft" size={14} /></button>
          <span className="btn btn-sm join-item btn-soft no-animation pointer-events-none">{monthLabel}</span>
          <button className="btn btn-sm join-item btn-soft" disabled={pulling || busy || dirty} onClick={() => router.push(`/${table}/leaves?ym=${nextYm}`)} title="เดือนถัดไป" aria-label="เดือนถัดไป"><Icon name="ChevronRight" size={14} /></button>
        </div>
        <button className="btn btn-sm btn-soft btn-primary" disabled={pulling || busy} onClick={pull}>
          {pulling ? <span className="loading loading-spinner loading-xs" /> : <Icon name="RotateCcw" size={14} />}
          ดึงข้อมูลล่าสุด
        </button>
      </div>
      <datalist id={`${table}-names`}>{names.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="leave-types">{TYPES.map((n) => <option key={n} value={n} />)}</datalist>
      <section className="card scroll-x">
        <table className="form">
          <thead>
            <tr>
              <th style={{ width: 160 }}>วันที่</th>
              <th>ชื่อคนลา</th>
              <th>ชื่อคนมาแทน (ว่าง = ยังไม่มีคนแทน)</th>
              <th>ประเภท</th>
              {autoHead.map((h) => <th key={h}>{h}</th>)}
              <th>หมายเหตุ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.ref ? "from-sys" : undefined}>
                {r.ref ? (
                  <>
                    <td className="ro">{r.date} <span className="badge badge-soft badge-info badge-xs">ระบบลา</span></td>
                    <td className="ro"><b>{r.name}</b></td>
                  </>
                ) : (
                  <>
                    <td><input className="y" type="date" value={r.date} onChange={(e) => upd(i, "date", e.target.value)} /></td>
                    <td><input className="y" list={`${table}-names`} value={r.name} onChange={(e) => upd(i, "name", e.target.value)} /></td>
                  </>
                )}
                <td>
                    <input className={problems.has(i) ? "y input-error" : "y"} list={`${table}-names`} value={r.replacement} style={problems.has(i) ? { background: "#FDE2E1", borderColor: "#C00000" } : undefined} title={problems.get(i)} onChange={(e) => upd(i, "replacement", e.target.value)} />
                    {problems.has(i) && <div className="error small">{problems.get(i)}</div>}
                  </td>
                <td>{r.ref ? <span className="ro">{r.type}</span> : <input className="y" list="leave-types" value={r.type} onChange={(e) => upd(i, "type", e.target.value)} />}</td>
                {auto(r).map((v, k) => <td key={k} className="ro">{v}</td>)}
                <td><input value={r.note} onChange={(e) => upd(i, "note", e.target.value)} /></td>
                <td>
                  {r.ref ? (
                    <span className="muted small" title="แก้/ยกเลิกที่ระบบลา แล้วกด ดึงข้อมูลล่าสุด">อัตโนมัติ</span>
                  ) : (
                    <button onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>ลบ</button>
                  )}
                </td>
              </tr>
            ))}
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
      </div>
    </div>
  );
}
