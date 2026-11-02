"use client";

import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { SHEET_CSS } from "@/lib/shift3/render";

interface Props {
  table: string;
  tableTitle: string;
  ym: string;
  prevYm: string;
  nextYm: string;
  label: string;
  tabName: string;
  manualSource: "month-tab" | "web-tab";
  sectionHtml: string;
  names: string[];
  warning: string;
}

// Legal แนวนอน 14 x 8.5 นิ้ว ที่ 96dpi, ขอบ 6 มม.
const PAGE_W = 14 * 96 - 2 * 23;
const PAGE_H = 8.5 * 96 - 2 * 23;

// ช่องที่ค่าตั้งต้นคือ "จนท." (เลือกชื่อจากรายการ) — ช่องอื่นพิมพ์/เลือกชื่อทับได้ และคืนค่าสูตรได้
const OFFICER_COLS = ["D", "E", "F", "S", "T", "U", "AC"];

export default function ScheduleView(p: Props) {
  const router = useRouter();
  const [zoom, setZoom] = useState(0.35);
  const [edit, setEdit] = useState<{ key: string; current: string; day: string; col: string; sec: string } | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  
  useEffect(() => {
    try {
      const z = Number(localStorage.getItem("shift-zoom"));
      if (z > 0) setZoom(z);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("shift-zoom", String(zoom));
    } catch {}
  }, [zoom]);

  // ขนาดจริงของตาราง (px) ตามความกว้างคอลัมน์/ความสูงแถวในชีต + เส้นขอบ
  // ใช้คำนวณสเกลให้ 1 ตาราง = 1 หน้า Legal แนวนอน
  const NATURAL_W = 44 + 36 * 145 + 40;
  const NATURAL_H = 36 + 28 + 28 + 34 + 46 + 34 + 34 + 31 * 112 + 72 + 30 + 30 + 40;
  const printZoom = Math.min(PAGE_W / NATURAL_W, PAGE_H / NATURAL_H);

  const onClick = (e: MouseEvent) => {
    const td = (e.target as HTMLElement).closest<HTMLTableCellElement>("td[data-k]");
    if (!td) return;
    const key = td.dataset.k!;
    const [sec, col, day] = key.split(":");
    const current = td.textContent ?? "";
    setEdit({ key, current, sec, col, day });
    const officer = OFFICER_COLS.includes(col) || (sec === "1" && col === "B");
    // ช่องพิมพ์/เลือกเอง: เริ่มว่างเพื่อให้รายการชื่อแสดงครบ (ค่าปัจจุบันดูได้จากบรรทัด "ค่าปัจจุบัน")
    setValue(officer ? (current === "จนท." ? "" : current) : "");
    setErr("");
  };

  const save = async (v: string | null) => {
    if (!edit) return;
    setBusy(true);
    setErr("");
    const r = await fetch("/api/shift3/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ym: p.ym, key: edit.key, value: v }),
    });
    setBusy(false);
    if (!r.ok) return setErr((await r.json()).error ?? "บันทึกไม่สำเร็จ");
    setEdit(null);
    router.refresh();
  };

  const isOfficer = edit ? OFFICER_COLS.includes(edit.col) || (edit.sec === "1" && edit.col === "B") : false;

  return (
    <div className={"schedule"}>
      <style>{SHEET_CSS}</style>
      <div className="toolbar no-print">
        <button onClick={() => router.push(`/schedule/${p.table}/${p.prevYm}`)}>◀ เดือนก่อน</button>
        <strong className="month-label">{p.tableTitle} · {p.label}</strong>
        <button onClick={() => router.push(`/schedule/${p.table}/${p.nextYm}`)}>เดือนถัดไป ▶</button>
        <input
          type="month"
          aria-label="เลือกเดือน"
          onChange={(e) => {
            const [y, m] = e.target.value.split("-");
            if (y && m) router.push(`/schedule/${p.table}/${Number(y) + 543}-${m}`);
          }}
        />
        <span className="spacer" />
        <label>
          ขนาด
          <input type="range" min={0.2} max={1} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          {Math.round(zoom * 100)}%
        </label>
        <button className="primary" onClick={() => window.print()}>
          พิมพ์ / บันทึก PDF ตารางนี้ (Legal แนวนอน)
        </button>
      </div>
      <div className="hint no-print">
        คลิกช่องใดก็ได้ในตารางเพื่อเลือก/พิมพ์ชื่อ (หรือคืนค่าตามสูตร) ·{" "}
        {p.manualSource === "month-tab"
          ? `บันทึกลงแท็บ ${p.tabName} ในชีต`
          : `ชีตยังไม่มีแท็บ ${p.tabName} — ช่องที่เลือกเองจะเก็บในแท็บ WEB-ช่องเลือกเอง`}
        {p.warning && <span className="warn"> · {p.warning}</span>}
      </div>
      <div className="sections" onClick={onClick} style={{ ["--print-zoom" as string]: printZoom } as CSSProperties}>
        <div className="print-page">
          <div className="screen-zoom" style={{ zoom }} dangerouslySetInnerHTML={{ __html: p.sectionHtml }} />
        </div>
      </div>

      {edit && (
        <div className="modal-bg no-print" onClick={() => !busy && setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              ส่วนที่ {edit.sec} · วันที่ {edit.day} · คอลัมน์ {edit.col}
            </h3>
            <p className="muted">ค่าปัจจุบัน: {edit.current || "(ว่าง)"}</p>
            {!isOfficer ? (
              <input list="names" value={value} onChange={(e) => setValue(e.target.value)} placeholder="พิมพ์หรือเลือกชื่อ" autoFocus />
            ) : (
              <select value={value} onChange={(e) => setValue(e.target.value)} autoFocus>
                <option value="">— เลือกชื่อ —</option>
                {p.names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            <datalist id="names">
              {p.names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {err && <div className="error">{err}</div>}
            <div className="modal-actions">
              <button disabled={busy} onClick={() => save(null)}>
                {isOfficer ? "คืนค่า จนท." : "คืนค่าตามสูตร"}
              </button>
              {!isOfficer && (
                <button disabled={busy} onClick={() => save("")}>
                  ล้างให้ว่าง
                </button>
              )}
              <span className="spacer" />
              <button disabled={busy} onClick={() => setEdit(null)}>
                ยกเลิก
              </button>
              <button className="primary" disabled={busy || (isOfficer && value === "")} onClick={() => save(value)}>
                {busy ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
