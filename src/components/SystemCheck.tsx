"use client";

// ปุ่ม "ตรวจทั้งระบบ" — ตรวจ 6 ตาราง (6.00-8.30 / 8.30-12.30 / 12.30-16.30 / Key / SMC / OT) ของเดือนที่เปิดอยู่
// ข้อผิดพลาด = ต้องแก้ · คำเตือน = ตรวจดูแล้วปล่อยผ่านได้ · คลิกรายการเพื่อไปที่ช่องนั้น
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import type { CheckIssue, CheckTable } from "@/lib/system-check-core";

interface Result {
  ym: string;
  at: string;
  issues: CheckIssue[];
  errors: number;
  warns: number;
  failed: { table: string; error: string }[];
}

const TITLE: Record<CheckTable, string> = { s1: "6.00-8.30", s2: "8.30-12.30", s3: "12.30-16.30", key: "Key", smc: "SMC", ot: "OT" };
const ORDER: CheckTable[] = ["s1", "s2", "s3", "key", "smc", "ot"];
const storeKey = (ym: string) => `syscheck:${ym}`;

function loadStored(ym: string): Result | null {
  try {
    const v = sessionStorage.getItem(storeKey(ym));
    return v ? (JSON.parse(v) as Result) : null;
  } catch {
    return null;
  }
}

export default function SystemCheck({ ym, table, monthLabel, onGo }: { ym: string; table: string; monthLabel: string; onGo: (cell: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [filter, setFilter] = useState<"all" | "error" | "warn">("all");
  useEffect(() => setRes(loadStored(ym)), [ym]);

  const run = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/check?ym=${encodeURIComponent(ym)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error ?? `ตรวจไม่สำเร็จ (${r.status})`);
      setRes(j as Result);
      try {
        sessionStorage.setItem(storeKey(ym), JSON.stringify(j));
      } catch {
        /* ไม่จำผลก็ใช้งานได้ */
      }
    } catch (e) {
      setErr((e as Error).message || "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  };

  const go = (t: CheckTable, cell: string) => {
    setOpen(false);
    if (t === table) onGo(cell);
    else router.push(`/schedule/${t}/${ym}?cell=${encodeURIComponent(cell)}`);
  };

  const shown = (res?.issues ?? []).filter((i) => filter === "all" || i.level === filter);
  const groups = ORDER.map((t) => ({ t, items: shown.filter((i) => i.at[0].table === t) })).filter((g) => g.items.length > 0);

  return (
    <>
      <button
        className={`btn btn-sm btn-soft ${res && res.errors > 0 ? "btn-error" : res && res.warns > 0 ? "btn-warning" : "btn-success"}`}
        onClick={() => {
          setOpen(true);
          if (!res && !busy) void run();
        }}
        title="ตรวจ 6 ตาราง (6.00-8.30 / 8.30-12.30 / 12.30-16.30 / Key / SMC / OT) ของเดือนนี้"
      >
        <Icon name="ScanSearch" size={16} />
        ตรวจทั้งระบบ
        {res && (res.errors > 0 || res.warns > 0) && (
          <span className="chk-count">
            {res.errors > 0 && <b className="e">{res.errors}</b>}
            {res.warns > 0 && <b className="w">{res.warns}</b>}
          </span>
        )}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
        // แสดงที่ body (แถบเครื่องมือมีเอฟเฟกต์กระจก ทำให้ป๊อปอัปที่อยู่ข้างในเลื่อนหลุดจอได้)
        <div className="modal modal-open no-print" onClick={() => setOpen(false)}>
          <div className="modal-box wide chk-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ตรวจทั้งระบบ">
            <div className="mhead">
              <Icon name="ScanSearch" size={20} />
              <h3>ตรวจทั้งระบบ · {monthLabel}</h3>
              <button className="btn btn-sm btn-ghost btn-circle mclose" aria-label="ปิด" onClick={() => setOpen(false)}>
                <Icon name="X" size={18} />
              </button>
            </div>
            <p className="muted small">ตรวจ 6 ตาราง (6.00-8.30 · 8.30-12.30 · 12.30-16.30 · Key · SMC · OT) เฉพาะเดือนนี้ · <b className="txt-e">ข้อผิดพลาด</b> = ต้องแก้ · <b className="txt-w">คำเตือน</b> = ตรวจดู ถ้าถูกต้องปล่อยผ่านได้ · กดรายการเพื่อไปที่ช่องนั้น แก้แล้วกด “ตรวจอีกครั้ง”</p>
            <div className="chk-bar">
              {res && (
                <>
                  <button className={`chk-chip${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>ทั้งหมด {res.issues.length}</button>
                  <button className={`chk-chip e${filter === "error" ? " on" : ""}`} onClick={() => setFilter("error")}><Icon name="CircleX" size={14} /> ข้อผิดพลาด {res.errors}</button>
                  <button className={`chk-chip w${filter === "warn" ? " on" : ""}`} onClick={() => setFilter("warn")}><Icon name="TriangleAlert" size={14} /> คำเตือน {res.warns}</button>
                  <span className="muted small">ตรวจเมื่อ {res.at} น.</span>
                </>
              )}
              <span className="spacer" />
              <button className="btn btn-sm btn-primary" disabled={busy} onClick={run}>
                {busy ? <span className="loading loading-spinner loading-xs" /> : <Icon name="RotateCcw" size={14} />}
                {busy ? "กำลังตรวจ…" : res ? "ตรวจอีกครั้ง" : "เริ่มตรวจ"}
              </button>
            </div>
            {err && <div className="alert alert-error alert-soft"><Icon name="TriangleAlert" size={16} /><span>{err}</span></div>}
            {res?.failed.map((f) => (
              <div key={f.table} className="alert alert-warning alert-soft"><Icon name="TriangleAlert" size={16} /><span>ตรวจตาราง {f.table} ไม่ได้: {f.error}</span></div>
            ))}
            <div className="chk-list">
              {busy && !res && <div className="muted p-2"><span className="loading loading-spinner loading-sm" /> กำลังตรวจทั้ง 6 ตาราง…</div>}
              {res && res.issues.length === 0 && res.failed.length === 0 && (
                <div className="chk-ok"><Icon name="CircleCheck" size={22} /> ไม่พบข้อผิดพลาดหรือคำเตือนในเดือนนี้</div>
              )}
              {res && res.issues.length > 0 && shown.length === 0 && <div className="muted p-2">ไม่มีรายการในตัวกรองนี้</div>}
              {groups.map((g) => (
                <section key={g.t} className="chk-group">
                  <div className={`chk-gtitle tone-${g.t}`}>
                    ตาราง {TITLE[g.t]} <span className="muted">· {g.items.length} รายการ{g.t === table ? " (ตารางที่เปิดอยู่)" : ""}</span>
                  </div>
                  {g.items.map((i, n) => (
                    <div key={n} className={`chk-item ${i.level === "error" ? "e" : "w"}`}>
                      <Icon name={i.level === "error" ? "CircleX" : "TriangleAlert"} size={16} className="chk-ic" />
                      <div className="chk-body">
                        <div className="chk-head">
                          <b>วันที่ {i.day}</b> <span className="chk-kind">{i.kind}</span>
                        </div>
                        <div className="chk-text">{i.text}</div>
                        <div className="chk-places">
                          {i.at.map((a, k) => (
                            <button key={k} className="chk-go" onClick={() => go(a.table, a.cell)} title="ไปที่ช่องนี้">
                              <Icon name="Crosshair" size={13} /> {a.table === g.t && i.at.length === 1 ? "" : `${TITLE[a.table]} · `}{a.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
