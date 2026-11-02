"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { colIndex } from "@/lib/shift3/engine";
import { COL_WIDTH, ROW_HEIGHT } from "@/lib/shift3/layout";
import { SHEET_CSS } from "@/lib/shift3/render";
import { rememberYm } from "./NavLinks";
import { useToast } from "./Toast";
import { downloadTablePdf } from "@/lib/pdf-export";
import Icon from "./Icon";
import type { SummaryGroup } from "@/lib/shift-summary";

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
  personColors: Record<string, string>;
  dupDays: number[];
  /** ฐาน API (ค่าเริ่มต้น /api/shift3) */
  api?: string;
  /** คอลัมน์ที่ค่าตั้งต้นเป็น จนท. (เลือกจากรายชื่อเท่านั้น) */
  officerCols?: string[];
  /** ข้อความช่วยใต้แถบเครื่องมือ (แทนข้อความเริ่มต้น) */
  hint?: string;
  /** ข้อความเตือนชื่อซ้ำ (แทนข้อความเริ่มต้น) */
  dupNote?: string;
  /** สรุปจำนวนเวรของแต่ละคนในเดือนนี้ (ปุ่ม สรุปเวร) */
  summary?: SummaryGroup[];
  /** ตั้งค่าการสร้าง PDF */
  pdf?: { colA: number; colW: number; keepCols?: number[]; sheetCss?: string };
  warning: string;
}

type Paper = "a4" | "legal";
// กระดาษแนวนอน (px ที่ 96dpi) หักขอบ 5 มม. ทุกด้าน
const MARGIN_MM = 5;
const MM = 96 / 25.4;
const PAPERS: Record<Paper, { label: string; css: string; w: number; h: number }> = {
  a4: { label: "A4 แนวนอน", css: "A4 landscape", w: 297 * MM, h: 210 * MM },
  legal: { label: "Legal แนวนอน", css: "legal landscape", w: 14 * 96, h: 8.5 * 96 },
};

// ขนาดจริงของตาราง (px) ตามความกว้างคอลัมน์/ความสูงแถวในชีต
const NATURAL_W = COL_WIDTH.A + 36 * COL_WIDTH.other;
const FIXED_H =
  ROW_HEIGHT.title + ROW_HEIGHT.subtitle + ROW_HEIGHT.time + ROW_HEIGHT.header.reduce((a, b) => a + b, 0) + ROW_HEIGHT.sigGap + ROW_HEIGHT.sig * 2 + 40;

/** ช่องที่ค่าตั้งต้นคือ "จนท." (เลือกชื่อจากรายการ) — ช่องอื่นพิมพ์/เลือกชื่อทับได้ */
const OFFICER_COLS = ["D", "E", "F", "S", "T", "U", "AC"];

const BG_SWATCHES: { c: string; t: string }[] = [
  { c: "#7F7F7F", t: "เทาทึบ (ปิดให้บริการ)" },
  { c: "#BFBFBF", t: "เทาอ่อน" },
  { c: "#FFFFFF", t: "ขาว" },
  { c: "#FFF2CC", t: "เหลือง" },
  { c: "#FFC7CE", t: "ชมพู" },
  { c: "#F8CBAD", t: "ส้ม" },
  { c: "#C6E0B4", t: "เขียว" },
  { c: "#BDD7EE", t: "ฟ้า" },
  { c: "#E4DFEC", t: "ม่วง" },
];
const FG_SWATCHES: { c: string; t: string }[] = [
  { c: "#000000", t: "ดำ" },
  { c: "#C00000", t: "แดง" },
  { c: "#C55A11", t: "ส้ม" },
  { c: "#2E7D32", t: "เขียว" },
  { c: "#1F4E9E", t: "น้ำเงิน" },
  { c: "#7030A0", t: "ม่วง" },
  { c: "#7F7F7F", t: "เทา" },
  { c: "#FFFFFF", t: "ขาว" },
];

// สีวงกลมหน้าชื่อในรายการ (ตกแต่งเท่านั้น)
const AV_COLORS = ["#1f3a68", "#2f6694", "#2f7660", "#56508a", "#8c4a66", "#a8643a", "#355784", "#2f6b74", "#6b4f6e", "#5a7598"];
const avColor = (n: string) => AV_COLORS[Array.from(n).reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV_COLORS.length];

interface CellRef {
  key: string;
  c: number;
  d: number;
  el: HTMLElement;
}

async function post(url: string, body: unknown): Promise<{ ok: boolean; status: number; error: string; conflict: boolean }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; conflict?: boolean };
    return { ok: r.ok, status: r.status, error: j.error ?? (r.ok ? "" : `ไม่สำเร็จ (รหัส ${r.status})`), conflict: j.conflict === true };
  } catch {
    return { ok: false, status: 0, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่", conflict: false };
  }
}

// ตัวตารางเป็น HTML ล้วน: ห่อด้วย memo เพื่อไม่ให้ถูกวาดใหม่ทุกครั้งที่เลือกช่อง (ไม่เสียดัชนีช่อง/ไม่กระตุก)
const SheetHtml = memo(function SheetHtml({ html, zoom }: { html: string; zoom: number }) {
  return <div className="screen-zoom" style={{ zoom }} dangerouslySetInnerHTML={{ __html: html }} />;
});

export default function ScheduleView(p: Props) {
  const router = useRouter();
  const toast = useToast();
  const API = p.api ?? "/api/shift3";
  const rootRef = useRef<HTMLDivElement>(null);
  const cells = useRef<CellRef[]>([]);
  const dragging = useRef(false);
  const moved = useRef(false);
  const downAt = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.35);
  const [paper, setPaper] = useState<Paper>("a4");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const [edit, setEdit] = useState<{ key: string; current: string; day: string; col: string; sec: string } | null>(null);
  const [value, setValue] = useState("");
  const busy = false; // บันทึกเบื้องหลังแล้ว ไม่ต้องล็อกป๊อปอัป
  const [err, setErr] = useState("");
  const [colorsOpen, setColorsOpen] = useState(false);
  const [sumOpen, setSumOpen] = useState(false);
  const [colors, setColors] = useState<Record<string, string>>(p.personColors);

  useEffect(() => {
    try {
      // ขนาดจำแยกตามตาราง (ตารางแต่ละแบบกว้างไม่เท่ากัน) — ครั้งแรกปรับให้พอดีความกว้างจอ
      const z = Number(localStorage.getItem(`shift-zoom-${p.table}`));
      if (z > 0) setZoom(z);
      else fitToScreen();
      const pp = localStorage.getItem("shift-paper");
      if (pp === "a4" || pp === "legal") setPaper(pp);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(`shift-zoom-${p.table}`, String(zoom));
      localStorage.setItem("shift-paper", paper);
    } catch {}
  }, [zoom, paper]);
  useEffect(() => rememberYm(p.ym), [p.ym]);

  /** ปรับขนาดให้ตารางเต็มความกว้างของกรอบบนจอ (ไม่กระทบ PDF/การพิมพ์) */
  function fitToScreen() {
    const root = rootRef.current;
    const table = root?.querySelector<HTMLElement>("table.sheet");
    if (!root || !table) return;
    const natural = parseFloat(table.style.width) || table.scrollWidth;
    const avail = root.clientWidth - 24;
    if (natural > 0 && avail > 0) setZoom(Math.max(0.2, Math.min(1.5, Math.floor((avail / natural) * 100) / 100)));
  }
  useEffect(() => setColors(p.personColors), [p.personColors]);

  // เตือนครั้งเดียวต่อการเปิดตาราง ถ้ามีชื่อซ้ำในแถวเดียวกัน
  const warnedFor = useRef("");
  useEffect(() => {
    const k = `${p.table}/${p.ym}`;
    if (p.dupDays.length > 0 && warnedFor.current !== k) {
      warnedFor.current = k;
      toast.error(`พบชื่อซ้ำในแถวเดียวกัน วันที่ ${p.dupDays.join(", ")} (กรอบแดงในตาราง) — ${p.dupNote ?? "พนักงาน 1 คนอยู่ได้ทีละจุด"}`);
    }
  }, [p.dupDays, p.table, p.ym, toast]);

  // จัดทำดัชนีช่องในตาราง (ทุกครั้งที่ตารางถูกวาดใหม่) แล้วทาสีช่องที่เลือกอยู่
  const reindex = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    cells.current = Array.from(root.querySelectorAll<HTMLElement>("td[data-k]")).map((el) => {
      const key = el.dataset.k!;
      const [, col, day] = key.split(":");
      return { key, c: colIndex(col), d: Number(day), el };
    });
  }, []);
  // ถ้า DOM ของตารางถูกวาดใหม่ (ช่องเก่าหลุดจากหน้า) ให้ทำดัชนีใหม่ก่อนใช้งาน
  const ensureIndex = () => {
    const f = cells.current[0];
    if (!f || !f.el.isConnected) reindex();
  };
  useEffect(() => {
    reindex();
    // ช่องที่เลือกไว้แต่ไม่มีแล้ว (เปลี่ยนเดือน) ให้ล้างออก
    const have = new Set(cells.current.map((x) => x.key));
    setSel((s) => (Array.from(s).every((k) => have.has(k)) ? s : new Set(Array.from(s).filter((k) => have.has(k)))));
  }, [p.sectionHtml, reindex]);
  // รันทุกครั้งที่ render: ทาสีช่องที่เลือก (ทนต่อกรณี React วาดตารางใหม่)
  useEffect(() => {
    ensureIndex();
    for (const x of cells.current) x.el.classList.toggle("sel", sel.has(x.key));
  });

  // ----- พิมพ์ให้พอดีหน้า: ย่อทั้งตารางให้เต็มกระดาษ (ปรับความสูงแถวข้อมูลให้สัดส่วนเท่ากระดาษ ไม่เหลือที่ว่าง) -----
  const fit = useMemo(() => {
    const pg = PAPERS[paper];
    const pw = pg.w - 2 * MARGIN_MM * MM;
    const ph = pg.h - 2 * MARGIN_MM * MM;
    const zoomPrint = (pw / NATURAL_W) * 0.995;
    const rowH = Math.max(70, Math.min(160, (NATURAL_W * (ph / pw) - FIXED_H) / 31));
    return { zoomPrint, rowH };
  }, [paper]);

  const rectKeys = useCallback((a: string, b: string): string[] => {
    if (!cells.current[0]?.el.isConnected) reindex();
    const pa = cells.current.find((x) => x.key === a);
    const pb = cells.current.find((x) => x.key === b);
    if (!pa || !pb) return [b];
    const [c1, c2] = [Math.min(pa.c, pb.c), Math.max(pa.c, pb.c)];
    const [d1, d2] = [Math.min(pa.d, pb.d), Math.max(pa.d, pb.d)];
    return cells.current.filter((x) => x.c >= c1 && x.c <= c2 && x.d >= d1 && x.d <= d2).map((x) => x.key);
  }, [reindex]);

  const cellOf = (e: MouseEvent) => (e.target as HTMLElement).closest<HTMLTableCellElement>("td[data-k]");

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const td = cellOf(e);
    if (!td) return;
    const key = td.dataset.k!;
    if (e.shiftKey && anchor.current) {
      setSel(new Set(rectKeys(anchor.current, key)));
    } else if (e.ctrlKey || e.metaKey) {
      setSel((s) => {
        const n = new Set(s);
        if (n.has(key)) n.delete(key);
        else n.add(key);
        return n;
      });
      anchor.current = key;
    } else {
      setSel(new Set([key]));
      anchor.current = key;
      dragging.current = true;
      moved.current = false;
      downAt.current = { x: e.clientX, y: e.clientY };
      const stop = () => {
        dragging.current = false;
        window.removeEventListener("mouseup", stop);
        // คลิกธรรมดา (ไม่ลาก) = เปิดรายการชื่อให้เลือกทันที
        if (!moved.current) openEdit(key);
      };
      window.addEventListener("mouseup", stop);
    }
  };
  const onMouseOver = (e: MouseEvent) => {
    if (!dragging.current || !anchor.current) return;
    const td = cellOf(e);
    if (!td) return;
    // ต้องขยับเมาส์จริง (ไม่ใช่แค่หน้าเลื่อนใต้เมาส์) จึงนับเป็นการลากเลือก
    if (!moved.current && Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y) < 4) return;
    if (td.dataset.k !== anchor.current) moved.current = true;
    setSel(new Set(rectKeys(anchor.current, td.dataset.k!)));
  };

  function openEdit(key: string) {
    ensureIndex();
    const x = cells.current.find((c) => c.key === key);
    if (!x) return;
    const [sec, col, day] = key.split(":");
    const current = x.el.textContent ?? "";
    setEdit({ key, current, sec, col, day });
    setValue(""); // ช่องค้นหา/พิมพ์ชื่อ เริ่มว่างเพื่อให้รายการชื่อแสดงครบ
    setErr("");
  }
  const onDoubleClick = (e: MouseEvent) => {
    const td = cellOf(e);
    if (td) openEdit(td.dataset.k!);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !edit && !colorsOpen) setSel(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit, colorsOpen]);

  // ----- บันทึกแบบไม่ต้องรอ: ปิดป๊อปอัปและแสดงชื่อในช่องทันที แล้วบันทึกลง Google Sheet เบื้องหลัง -----
  // ส่งคำขอทีละรายการตามลำดับ (กันบันทึกทับกันในแท็บ WEB) และโหลดตารางใหม่ครั้งเดียวเมื่อบันทึกครบทุกรายการ
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const enqueue = (task: () => Promise<void>) => {
    pending.current += 1;
    queue.current = queue.current
      .then(task)
      .catch(() => undefined)
      .finally(() => {
        pending.current -= 1;
        if (pending.current === 0) {
          stale.current = true;
          setTimeout(() => (stale.current = false), 10_000); // กันค้าง ถ้าตารางที่โหลดใหม่หน้าตาเหมือนเดิม
          router.refresh();
        }
      });
  };
  // ตารางใหม่จาก server มาถึงแล้ว → PDF ใช้ข้อมูลล่าสุดได้
  const stale = useRef(false);
  useEffect(() => {
    stale.current = false;
  }, [p.sectionHtml]);
  // ปิด/ย้ายหน้าระหว่างยังบันทึกไม่เสร็จ → เตือนก่อน
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (pending.current > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  // ----- บันทึกชื่อ -----
  const saveName = (v: string | null) => {
    if (!edit) return;
    const key = edit.key;
    ensureIndex();
    const cell = cells.current.find((c) => c.key === key)?.el;
    const before = cell?.textContent ?? "";
    if (cell) {
      if (v !== null) cell.textContent = v; // คืนค่าตามสูตร: รอค่าจริงจากชีต
      cell.classList.add("saving");
    }
    setEdit(null);
    setErr("");
    const t = toast.loading(v === null ? "กำลังคืนค่าตามสูตร…" : v === "" ? "กำลังล้างช่อง…" : `กำลังบันทึก “${v}”…`);
    enqueue(async () => {
      const r = await post(`${API}/manual`, { ym: p.ym, key, value: v });
      cell?.classList.remove("saving");
      if (!r.ok) {
        if (cell) cell.textContent = before; // คืนค่าเดิมบนจอ
        t.error(r.conflict ? `ไม่ได้บันทึก — ชื่อซ้ำ: ${r.error}` : `บันทึกไม่สำเร็จ: ${r.error}`);
        return;
      }
      t.success(v === null ? "คืนค่าตามสูตรแล้ว" : v === "" ? "ล้างช่องแล้ว" : `บันทึก “${v}” แล้ว`);
    });
  };

  const selKeys = Array.from(sel);
  const bulkManual = async (v: null | "") => {
    if (selKeys.length === 0) return;
    const what = v === null ? "คืนค่าตามสูตร" : "ล้างช่องให้ว่าง";
    if (selKeys.length > 1 && !window.confirm(`${what} ${selKeys.length} ช่อง?`)) return;
    const keys = [...selKeys];
    const t = toast.loading(`กำลัง${what} ${keys.length} ช่อง…`);
    const before = new Map<HTMLElement, string>();
    for (const x of cells.current) {
      if (!sel.has(x.key)) continue;
      before.set(x.el, x.el.textContent ?? "");
      if (v === "") x.el.textContent = "";
      x.el.classList.add("saving");
    }
    enqueue(async () => {
      const r = await post(`${API}/manual`, { ym: p.ym, keys, value: v });
      for (const [el, txt] of before) {
        el.classList.remove("saving");
        if (!r.ok) el.textContent = txt;
      }
      if (!r.ok) return void t.error(`${what}ไม่สำเร็จ: ${r.error}`);
      t.success(`${what} ${keys.length} ช่อง สำเร็จ`);
    });
  };

  // ----- สีพื้น / สีตัวอักษร -----
  const applyStyle = (patch: { bg?: string | null; fg?: string | null; clear?: boolean }) => {
    if (selKeys.length === 0) return;
    const keys = [...selKeys];
    // แสดงผลทันที แล้วค่อยบันทึก (ถ้าบันทึกไม่ได้ คืนสีเดิมบนจอ)
    const before = new Map<HTMLElement, [string, string]>();
    for (const x of cells.current) {
      if (!sel.has(x.key)) continue;
      before.set(x.el, [x.el.style.background, x.el.style.color]);
      if (typeof patch.bg === "string") x.el.style.background = patch.bg;
      if (typeof patch.fg === "string") x.el.style.color = patch.fg;
    }
    const t = toast.loading("กำลังบันทึกสี…");
    enqueue(async () => {
      const r = await post(`${API}/style`, { ym: p.ym, keys, ...patch });
      if (!r.ok) {
        for (const [el, [bg, fg]] of before) {
          el.style.background = bg;
          el.style.color = fg;
        }
        return void t.error(`บันทึกสีไม่สำเร็จ: ${r.error}`);
      }
      t.success(patch.clear || patch.bg === null || patch.fg === null ? "ล้างสีแล้ว" : "บันทึกสีสำเร็จ");
    });
  };

  const savePersonColors = async () => {
    const t = toast.loading("กำลังบันทึกสีพนักงาน… (รอสักครู่)");
    const r = await post(`${API}/person-colors`, { colors });
    if (!r.ok) return t.error(`บันทึกสีพนักงานไม่สำเร็จ: ${r.error}`);
    t.success("บันทึกสีพนักงานสำเร็จ");
    setColorsOpen(false);
    router.refresh();
  };

  // ดาวน์โหลดเป็น PDF 1 หน้าทันที (ไม่เปิดหน้าต่างพิมพ์/พรีวิว)
  const doPrint = async () => {
    if (pending.current > 0 || stale.current) return void toast.info("กำลังบันทึกลง Google Sheet อยู่ — รอสักครู่แล้วกดดาวน์โหลด PDF อีกครั้ง");
    if (p.dupDays.length > 0 && !window.confirm(`ตารางนี้ยังมีชื่อซ้ำในแถวเดียวกัน (วันที่ ${p.dupDays.join(", ")}) ดาวน์โหลดต่อหรือไม่?`)) return;
    const h = toast.loading("กำลังสร้างไฟล์ PDF…");
    try {
      await downloadTablePdf({
        sectionHtml: p.sectionHtml,
        sheetCss: p.pdf?.sheetCss ?? SHEET_CSS,
        colA: p.pdf?.colA ?? COL_WIDTH.A,
        colW: p.pdf?.colW ?? COL_WIDTH.other,
        keepCols: p.pdf?.keepCols,
        rowH: fit.rowH,
        paper,
        marginMm: MARGIN_MM,
        fileName: `shift-${p.table}_${p.ym}.pdf`, // ชื่อไฟล์ ASCII ให้ทุกเบราว์เซอร์ตั้งชื่อได้ตรง
      });
      h.success("ดาวน์โหลด PDF แล้ว");
    } catch (e) {
      h.error(`สร้าง PDF ไม่สำเร็จ: ${e instanceof Error ? e.message : e}`);
    }
  };

  const isOfficer = edit ? (p.officerCols ?? OFFICER_COLS).includes(edit.col) || (edit.sec === "1" && edit.col === "B") : false;
  const uniqNames = useMemo(() => Array.from(new Set(p.names)), [p.names]);
  const single = selKeys.length === 1 ? selKeys[0] : null;
  const shown = useMemo(() => {
    const q = value.trim().toLowerCase();
    return q === "" ? uniqNames : uniqNames.filter((n) => n.toLowerCase().includes(q));
  }, [uniqNames, value]);

  return (
    <div className="schedule">
      <style>{SHEET_CSS}</style>
      <style>{`@page{size:${PAPERS[paper].css};margin:${MARGIN_MM}mm}`}</style>
      <div className="toolbar no-print">
        <div className="join">
          <button className="btn btn-sm join-item" onClick={() => router.push(`/schedule/${p.table}/${p.prevYm}`)} title="เดือนก่อน">
            <Icon name="ChevronLeft" size={16} />
            เดือนก่อน
          </button>
          <button className="btn btn-sm join-item" onClick={() => router.push(`/schedule/${p.table}/${p.nextYm}`)} title="เดือนถัดไป">
            เดือนถัดไป
            <Icon name="ChevronRight" size={16} />
          </button>
        </div>
        <strong className={`month-chip tone-${p.table}`}>
          <Icon name="CalendarDays" size={16} />
          <span className="tt">{p.tableTitle}</span> · {p.label}
        </strong>
        <input
          type="month"
          className="input input-sm w-auto"
          aria-label="เลือกเดือน"
          title="ไปเดือนที่ต้องการ"
          onChange={(e) => {
            const [y, m] = e.target.value.split("-");
            if (y && m) router.push(`/schedule/${p.table}/${Number(y) + 543}-${m}`);
          }}
        />
        <span className="spacer" />
        <label className="zoombox" title="ขนาดตารางบนจอ (ไม่กระทบ PDF)">
          <Icon name="ZoomIn" size={16} />
          <input type="range" className="range range-primary range-xs" min={0.2} max={1.5} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="ขนาดตาราง" />
          <span className="pct">{Math.round(zoom * 100)}%</span>
        </label>
        <button className="btn btn-sm btn-soft btn-accent" onClick={fitToScreen} title="ปรับขนาดให้ตารางเต็มความกว้างจอ">
          <Icon name="Maximize2" size={16} />
          พอดีจอ
        </button>
        {p.summary && (
          <button className="btn btn-sm btn-soft btn-info" onClick={() => setSumOpen(true)}>
            <Icon name="ChartColumn" size={16} />
            สรุปเวร
          </button>
        )}
        <button className="btn btn-sm btn-soft btn-secondary" onClick={() => setColorsOpen(true)}>
          <Icon name="Palette" size={16} />
          สีตามชื่อพนักงาน
        </button>
        <select className="select select-sm w-auto" value={paper} onChange={(e) => setPaper(e.target.value as Paper)} aria-label="ขนาดกระดาษ">
          {(Object.keys(PAPERS) as Paper[]).map((k) => (
            <option key={k} value={k}>
              {PAPERS[k].label}
            </option>
          ))}
        </select>
        <button className="btn btn-sm btn-primary" onClick={doPrint}>
          <Icon name="FileDown" size={16} />
          ดาวน์โหลด PDF
        </button>
      </div>

      {sel.size > 0 && (
        <div className="seltools no-print" role="toolbar" aria-label="เครื่องมือช่องที่เลือก">
          <span className="badge badge-primary gap-1 font-bold">
            <Icon name="MousePointerClick" size={14} />
            เลือก {sel.size} ช่อง
          </span>
          <button className="btn btn-xs btn-primary btn-soft" disabled={!single} onClick={() => single && openEdit(single)} title="คลิกที่ช่องก็ได้">
            <Icon name="PencilLine" size={14} />
            เลือก/พิมพ์ชื่อ
          </button>
          <span className="grp">
            <Icon name="Paintbrush" size={14} />
            สีพื้น
            {BG_SWATCHES.map((s) => (
              <button key={s.c} className="swatch" style={{ background: s.c }} title={s.t} aria-label={`สีพื้น ${s.t}`} onClick={() => applyStyle({ bg: s.c })} />
            ))}
            <input type="color" aria-label="สีพื้นอื่นๆ" title="เลือกสีพื้นอื่น" defaultValue="#FFF2CC" onChange={(e) => applyStyle({ bg: e.target.value })} />
            <button className="btn btn-xs btn-ghost" onClick={() => applyStyle({ bg: null })}>ล้าง</button>
          </span>
          <span className="grp">
            <Icon name="Type" size={14} />
            สีตัวอักษร
            {FG_SWATCHES.map((s) => (
              <button key={s.c} className="swatch fg" style={{ color: s.c, background: s.c === "#FFFFFF" ? "#444" : "#fff" }} title={s.t} aria-label={`สีตัวอักษร ${s.t}`} onClick={() => applyStyle({ fg: s.c })}>
                ก
              </button>
            ))}
            <input type="color" aria-label="สีตัวอักษรอื่นๆ" title="เลือกสีตัวอักษรอื่น" defaultValue="#C00000" onChange={(e) => applyStyle({ fg: e.target.value })} />
            <button className="btn btn-xs btn-ghost" onClick={() => applyStyle({ fg: null })}>ล้าง</button>
          </span>
          <button className="btn btn-xs btn-soft btn-warning" onClick={() => applyStyle({ clear: true })}>
            <Icon name="Eraser" size={14} />
            ล้างสีทั้งหมด
          </button>
          <button className="btn btn-xs btn-soft btn-error" onClick={() => bulkManual("")}>
            <Icon name="X" size={14} />
            ล้างชื่อให้ว่าง
          </button>
          <button className="btn btn-xs btn-soft btn-success" onClick={() => bulkManual(null)}>
            <Icon name="RotateCcw" size={14} />
            คืนค่าตามสูตร
          </button>
          <span className="spacer" />
          <button className="btn btn-xs btn-ghost" onClick={() => setSel(new Set())}>
            ยกเลิกเลือก <kbd className="kbd kbd-xs">Esc</kbd>
          </button>
        </div>
      )}

      <div className="hint no-print">
        <Icon name="MousePointerClick" size={14} />
        คลิกช่องเพื่อเลือกชื่อ · ลากเมาส์ หรือกด Shift เพื่อเลือกหลายช่อง (ใส่สี/ล้างชื่อ) · Ctrl+คลิกเพื่อเพิ่ม ·{" "}
        {p.hint ??
          (p.manualSource === "month-tab"
            ? `ช่อง จนท. บันทึกลงแท็บ ${p.tabName} ในชีต`
            : `ชีตยังไม่มีแท็บ ${p.tabName} — ช่องที่แก้เองจะเก็บในแท็บ WEB-ช่องเลือกเอง`)}
        {p.warning && <span className="badge badge-warning badge-sm">{p.warning}</span>}
        {p.dupDays.length > 0 && (
          <span className="badge badge-error badge-sm gap-1">
            <Icon name="TriangleAlert" size={12} />
            ชื่อซ้ำในแถวเดียวกัน วันที่ {p.dupDays.join(", ")}
          </span>
        )}
      </div>

      <div
        ref={rootRef}
        className="sections"
        onMouseDown={onMouseDown}
        onMouseOver={onMouseOver}
        onDoubleClick={onDoubleClick}
        style={{ ["--print-zoom" as string]: fit.zoomPrint, ["--print-row-h" as string]: `${fit.rowH}px` } as CSSProperties}
      >
        <div className="print-page">
          <SheetHtml html={p.sectionHtml} zoom={zoom} />
        </div>
      </div>

      {edit && (
        <div className="modal modal-open no-print" onClick={() => !busy && setEdit(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="เลือกชื่อ">
            <div className="mhead">
              <Icon name="SquarePen" size={20} />
              <h3>
                {p.tableTitle} · วันที่ {edit.day} · คอลัมน์ {edit.col}
              </h3>
              <button className="btn btn-sm btn-ghost btn-circle mclose" aria-label="ปิด" disabled={busy} onClick={() => setEdit(null)}>
                <Icon name="X" size={18} />
              </button>
            </div>
            <p className="muted">
              ค่าปัจจุบัน: <span className="badge badge-soft badge-primary">{edit.current || "(ว่าง)"}</span>
            </p>
            <label className="input w-full">
              <Icon name="Search" size={16} className="opacity-60" />
              <input
                className="grow"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || busy) return;
                  if (shown.length === 1) saveName(shown[0]);
                  else if (!isOfficer && value.trim() !== "") saveName(value.trim());
                }}
                placeholder={isOfficer ? "ค้นหาชื่อ…" : "ค้นหา หรือพิมพ์ชื่อใหม่แล้วกด Enter"}
                autoFocus
              />
            </label>
            <div className="namelist" role="listbox" aria-label="รายชื่อ">
              {shown.map((n) => (
                <button key={n} role="option" aria-selected={n === edit.current} className={n === edit.current ? "nl-item cur" : "nl-item"} disabled={busy} onClick={() => saveName(n)}>
                  <span className="av" style={{ background: avColor(n) }}>{Array.from(n.replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, ""))[0] ?? "?"}</span>
                  {n}
                </button>
              ))}
              {shown.length === 0 && <div className="muted small p-2">ไม่พบชื่อ{!isOfficer && value.trim() !== "" ? " — กด Enter เพื่อใช้ชื่อที่พิมพ์" : ""}</div>}
            </div>
            <p className="muted small">
              <Icon name="Info" size={13} /> {p.dupNote ?? "พนักงาน 1 คนอยู่ได้ทีละจุดในแถวเดียวกัน — ถ้าชื่อซ้ำ ระบบจะไม่บันทึก"}
            </p>
            {err && (
              <div className="alert alert-error alert-soft">
                <Icon name="TriangleAlert" size={16} />
                <span>{err}</span>
              </div>
            )}
            <div className="modal-action">
              <button className="btn btn-sm btn-soft btn-success" disabled={busy} onClick={() => saveName(null)}>
                <Icon name="RotateCcw" size={14} />
                {isOfficer ? "คืนค่า จนท." : "คืนค่าตามสูตร"}
              </button>
              {!isOfficer && (
                <button className="btn btn-sm btn-soft btn-error" disabled={busy} onClick={() => saveName("")}>
                  <Icon name="Eraser" size={14} />
                  ล้างให้ว่าง
                </button>
              )}
              <span className="spacer" />
              <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setEdit(null)}>
                ยกเลิก
              </button>
              {!isOfficer && value.trim() !== "" && (
                <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => saveName(value.trim())}>
                  {busy ? <span className="loading loading-spinner loading-xs" /> : <Icon name="Check" size={14} />}
                  {busy ? "กำลังบันทึก…" : `ใช้ชื่อ "${value.trim()}"`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {sumOpen && p.summary && (
        <div className="modal modal-open no-print" onClick={() => setSumOpen(false)}>
          <div className="modal-box sum-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="สรุปเวร">
            <div className="mhead cool">
              <Icon name="ChartColumn" size={20} />
              <h3>
                สรุปเวร · {p.tableTitle} · {p.label}
              </h3>
              <button className="btn btn-sm btn-ghost btn-circle mclose" aria-label="ปิด" onClick={() => setSumOpen(false)}>
                <Icon name="X" size={18} />
              </button>
            </div>
            <p className="muted small">จำนวนเวรที่แต่ละคนได้รับในเดือนนี้ (นับ 1 ช่อง = 1 เวร · ไม่นับช่องที่ลา &quot;⚠&quot; หรือ &quot;→ ไปช่วยจุดอื่น&quot;)</p>
            <div className="sum-groups">
              {p.summary.map((g) => {
                const max = Math.max(1, ...g.rows.map((r) => r.count));
                return (
                  <table key={g.title} className="sum-table">
                    <thead>
                      <tr><th>{g.title}</th><th>จำนวนเวรที่ได้</th></tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r) => {
                        const a = r.count / max;
                        // ไล่สีขาว → ส้ม ตามจำนวนเวร (มากสุด = เข้มสุด)
                        const bg = r.count === 0 ? "#fff" : `rgb(${Math.round(255 - 18 * a)},${Math.round(236 - 80 * a)},${Math.round(214 - 150 * a)})`;
                        return (
                          <tr key={r.name}>
                            <td>{r.name}</td>
                            <td className="num" style={{ background: bg }}>{r.count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })}
            </div>
            <div className="modal-action">
              <span className="spacer" />
              <button className="btn btn-sm btn-primary" onClick={() => setSumOpen(false)}>
                <Icon name="Check" size={14} />
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
      {colorsOpen && (
        <div className="modal modal-open no-print" onClick={() => setColorsOpen(false)}>
          <div className="modal-box wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="สีตามชื่อพนักงาน">
            <div className="mhead warm">
              <Icon name="Palette" size={20} />
              <h3>สีตัวอักษรตามชื่อพนักงาน</h3>
              <button className="btn btn-sm btn-ghost btn-circle mclose" aria-label="ปิด" onClick={() => setColorsOpen(false)}>
                <Icon name="X" size={18} />
              </button>
            </div>
            <p className="muted small">ตั้งสีให้ชื่อใด ชื่อนั้นจะเป็นสีนี้ทุกช่องในทุกตาราง ทุกเดือน (สีที่ตั้งรายช่องจะมาก่อน)</p>
            <div className="colorlist">
              {uniqNames.map((n) => (
                <label key={n}>
                  <span style={{ color: colors[n] ?? "#000" }}>{n}</span>
                  <input type="color" value={colors[n] ?? "#000000"} onChange={(e) => setColors((c) => ({ ...c, [n]: e.target.value }))} />
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() =>
                      setColors((c) => {
                        const x = { ...c };
                        delete x[n];
                        return x;
                      })
                    }
                  >
                    ล้าง
                  </button>
                </label>
              ))}
            </div>
            <div className="modal-action">
              <span className="spacer" />
              <button className="btn btn-sm btn-ghost" onClick={() => setColorsOpen(false)}>ยกเลิก</button>
              <button className="btn btn-sm btn-primary" onClick={savePersonColors}>
                <Icon name="Save" size={14} />
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
