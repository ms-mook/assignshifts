"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { colIndex, colLetter } from "@/lib/shift3/engine";
import { cellPerson } from "@/lib/shift3/conflicts";
import { pointLabel, type CrossInfo } from "@/lib/shift3/cross";
import type { SectionNo } from "@/lib/shift3/types";
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
  /** ช่องที่ผู้จัดแก้เอง (key ช่อง → ค่า) ใช้ย้อนกลับให้ถูกต้อง */
  manual?: Record<string, string>;
  /** สีที่ตั้งรายช่อง (key ช่อง → สี) */
  cellStyles?: Record<string, CellStyle>;
  /** ตาราง 3 ช่วงเวลา: ข้อมูลตารางอื่นสำหรับ ใส่ชื่อเดียวกันหลายตาราง */
  cross?: CrossInfo;
}
type CellStyle = { bg?: string; fg?: string };
type StylePatch = { bg?: string | null; fg?: string | null; clear?: boolean };

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

// ----- สถานะที่ต้องอยู่รอดเมื่อหน้าโหลดตารางใหม่ (Next อาจสร้างคอมโพเนนต์ใหม่หลัง router.refresh) -----
// เก็บแยกตาม ตาราง+เดือน: คิวบันทึก, ประวัติย้อนกลับ/ทำซ้ำ, ช่องที่เลือก, เวลาบันทึกล่าสุด
interface PageStore {
  queue: Promise<void>;
  pending: number;
  stale: boolean;
  past: unknown[];
  future: unknown[];
  savedAt: string;
  failed: number;
  sel: string[];
  anchor: string | null;
  focus: string | null;
  listeners: Set<() => void>;
  refresh: () => void;
}
const STORES = new Map<string, PageStore>();
function pageStore(k: string): PageStore {
  let st = STORES.get(k);
  if (!st) {
    st = { queue: Promise.resolve(), pending: 0, stale: false, past: [], future: [], savedAt: "", failed: 0, sel: [], anchor: null, focus: null, listeners: new Set(), refresh: () => undefined };
    STORES.set(k, st);
  }
  return st;
}
/** ตัวช่วยให้ใช้ค่าใน store ได้เหมือน useRef (.current) */
function storeRef<K extends keyof PageStore, T = PageStore[K]>(st: PageStore, key: K): { current: T } {
  return {
    get current() {
      return st[key] as unknown as T;
    },
    set current(v: T) {
      (st as unknown as Record<string, unknown>)[key as string] = v;
    },
  };
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
  const store = pageStore(`${p.table}|${p.ym}`);
  store.refresh = () => router.refresh();
  const [sel, setSel] = useState<Set<string>>(() => new Set(store.sel));
  const anchor = useRef<string | null>(store.anchor);
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
    focusKey.current = key; // ลูกศรคีย์บอร์ดเริ่มจากช่องที่คลิกล่าสุด
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

  const onDoubleClick = (e: MouseEvent) => {
    const td = cellOf(e);
    if (td) openEdit(td.dataset.k!);
  };

  // ======================================================================
  // บันทึกแบบไม่ต้องรอ: แสดงผลในตารางทันที แล้วบันทึกลง Google Sheet เบื้องหลังตามลำดับ
  // (กันบันทึกทับกันในแท็บ WEB) และโหลดตารางใหม่ครั้งเดียวเมื่อบันทึกครบทุกรายการ
  // สถานะการบันทึกแสดงเป็นป้ายเล็กบนแถบเครื่องมือ — เด้งแจ้งเตือนเฉพาะตอนผิดพลาด
  // ======================================================================
  const pending = storeRef<"pending">(store, "pending");
  const stale = storeRef<"stale">(store, "stale");
  const [savingN, setSavingN] = useState(store.pending);
  const [savedAt, setSavedAt] = useState<string>(store.savedAt);
  const [failedN, setFailedN] = useState(store.failed);
  useEffect(() => {
    const on = () => {
      setSavingN(store.pending);
      setSavedAt(store.savedAt);
      setFailedN(store.failed);
    };
    store.listeners.add(on);
    on();
    return () => void store.listeners.delete(on);
  }, [store]);
  const notify = () => store.listeners.forEach((f) => f());
  const enqueue = (task: () => Promise<void>) => {
    if (store.pending === 0) store.failed = 0; // รอบบันทึกใหม่
    store.pending += 1;
    notify();
    store.queue = store.queue
      .then(task)
      .catch(() => undefined)
      .finally(() => {
        store.pending -= 1;
        if (store.pending === 0) {
          store.savedAt = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
          store.stale = true;
          setTimeout(() => (store.stale = false), 10_000); // กันค้าง ถ้าตารางที่โหลดใหม่หน้าตาเหมือนเดิม
          store.refresh(); // ใช้ router ของหน้าที่แสดงอยู่ล่าสุด
        }
        notify();
      });
  };
  // ตารางใหม่จาก server มาถึงแล้ว → PDF ใช้ข้อมูลล่าสุดได้
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

  // ----- สถานะปัจจุบันของช่อง (ใช้ย้อนกลับ/ทำซ้ำ และตรวจชื่อซ้ำ) -----
  // manual: ช่องที่ผู้จัดแก้เอง (ไม่มี = เป็นค่าตามสูตร) · styles: สีที่ตั้งรายช่อง · local: ค่าที่เพิ่งใส่ (ยังไม่ได้ตารางใหม่จาก server)
  const manualRef = useRef(new Map<string, string>(Object.entries(p.manual ?? {})));
  const styleRef = useRef(new Map<string, CellStyle>(Object.entries(p.cellStyles ?? {})));
  const localVals = useRef(new Map<string, string>());
  useEffect(() => {
    if (pending.current > 0) return; // ยังมีรายการกำลังบันทึก — ค่าที่จำไว้ในหน้าใหม่กว่า
    manualRef.current = new Map(Object.entries(p.manual ?? {}));
    styleRef.current = new Map(Object.entries(p.cellStyles ?? {}));
    localVals.current = new Map();
  }, [p.manual, p.cellStyles, p.sectionHtml]);

  // ----- ประวัติสำหรับ ย้อนกลับ (Undo) / ทำซ้ำ (Redo) -----
  type NameAct = { kind: "name"; entries: { key: string; before: string | null; after: string | null; beforeText: string | null; afterText: string | null }[] };
  type StyleAct = { kind: "style"; entries: { key: string; before: CellStyle; after: CellStyle }[] };
  type Act = NameAct | StyleAct;
  const past = storeRef<"past", Act[]>(store, "past");
  const future = storeRef<"future", Act[]>(store, "future");
  const [, setHv] = useState(0);
  const bumpHistory = () => setHv((n) => n + 1);
  const dropAct = (a: Act) => {
    past.current = past.current.filter((x) => x !== a);
    future.current = future.current.filter((x) => x !== a);
    bumpHistory();
  };

  const cellEl = (key: string) => {
    ensureIndex();
    return cells.current.find((c) => c.key === key)?.el ?? null;
  };

  /** ใส่ค่าหลายช่อง (null = คืนค่าตามสูตร) แสดงผลทันทีแล้วบันทึกเบื้องหลัง */
  const applyNames = (
    entries: { key: string; value: string | null }[],
    opt: { check?: boolean; record?: boolean; what?: string; display?: (string | null)[] } = {},
  ) => {
    if (entries.length === 0) return;
    const prevText = entries.map((e) => cellEl(e.key)?.textContent ?? null);
    const before = entries.map((e) => (manualRef.current.has(e.key) ? manualRef.current.get(e.key)! : null));
    const shown = new Map<HTMLElement, string>();
    entries.forEach((e, i) => {
      const el = cellEl(e.key);
      if (el) {
        shown.set(el, el.textContent ?? "");
        const txt = e.value ?? opt.display?.[i] ?? null; // คืนค่าตามสูตร: ใช้ค่าที่เคยเห็น (ถ้ามี) หรือรอค่าจริงจากชีต
        if (txt !== null) el.textContent = txt;
        el.classList.add("saving");
      }
      if (e.value === null) {
        manualRef.current.delete(e.key);
        localVals.current.delete(e.key);
      } else {
        manualRef.current.set(e.key, e.value);
        localVals.current.set(e.key, e.value);
      }
    });
    let act: Act | null = null;
    if (opt.record !== false) {
      act = { kind: "name", entries: entries.map((e, i) => ({ key: e.key, before: before[i], after: e.value, beforeText: prevText[i], afterText: e.value })) };
      past.current = [...past.current.slice(-99), act];
      future.current = [];
      bumpHistory();
    }
    // ช่องเดียว: ใช้การตรวจชื่อซ้ำเดิมของแต่ละตาราง · หลายช่องคนละค่า: ส่งแบบ entries
    const body =
      entries.length === 1 && opt.check !== false
        ? { ym: p.ym, key: entries[0].key, value: entries[0].value }
        : { ym: p.ym, entries, check: opt.check === true };
    enqueue(async () => {
      const r = await post(`${API}/manual`, body);
      for (const el of shown.keys()) el.classList.remove("saving");
      if (r.ok) return;
      for (const [el, txt] of shown) el.textContent = txt; // คืนค่าเดิมบนจอ
      entries.forEach((e, i) => {
        const b = before[i];
        if (b === null) manualRef.current.delete(e.key);
        else manualRef.current.set(e.key, b);
        localVals.current.delete(e.key);
      });
      if (act) dropAct(act);
      store.failed += 1;
      toast.error(r.conflict ? `ไม่ได้บันทึก — ชื่อซ้ำ: ${r.error}` : `${opt.what ?? "บันทึก"}ไม่สำเร็จ: ${r.error}`);
    });
  };

  /** ตั้งสีหลายช่อง: patch แบบเดิม (bg/fg = null ล้าง, clear = ล้างทั้งหมด) หรือ states = สีที่ต้องการของแต่ละช่อง (ใช้ย้อนกลับ) */
  const applyStyles = (keys: string[], patch: StylePatch | null, states: Map<string, CellStyle> | null, record = true) => {
    if (keys.length === 0) return;
    const before = new Map(keys.map((k) => [k, styleRef.current.get(k) ?? {}]));
    const after = new Map<string, CellStyle>();
    for (const k of keys) {
      const b = before.get(k)!;
      let a: CellStyle;
      if (states) a = states.get(k) ?? {};
      else if (patch!.clear) a = {};
      else {
        a = { ...b };
        if (patch!.bg !== undefined) patch!.bg === null ? delete a.bg : (a.bg = patch!.bg);
        if (patch!.fg !== undefined) patch!.fg === null ? delete a.fg : (a.fg = patch!.fg);
      }
      after.set(k, a);
    }
    const dom = new Map<HTMLElement, [string, string]>();
    for (const k of keys) {
      const el = cellEl(k);
      const a = after.get(k)!;
      if (!el) continue;
      dom.set(el, [el.style.background, el.style.color]);
      if (a.bg) el.style.background = a.bg;
      if (a.fg) el.style.color = a.fg;
      if (!a.bg || !a.fg) el.classList.add("saving"); // สีเดิมของตารางจะกลับมาเมื่อโหลดตารางใหม่
      if (Object.keys(a).length === 0) styleRef.current.delete(k);
      else styleRef.current.set(k, a);
    }
    let act: Act | null = null;
    if (record) {
      act = { kind: "style", entries: keys.map((k) => ({ key: k, before: before.get(k)!, after: after.get(k)! })) };
      past.current = [...past.current.slice(-99), act];
      future.current = [];
      bumpHistory();
    }
    // คำขอ: patch เดิม 1 ครั้ง หรือรวมกลุ่มช่องที่ต้องการสีเหมือนกัน
    const reqs: Record<string, unknown>[] = [];
    if (!states) reqs.push({ ym: p.ym, keys, ...patch });
    else {
      const groups = new Map<string, string[]>();
      for (const k of keys) {
        const a = after.get(k)!;
        const g = JSON.stringify([a.bg ?? null, a.fg ?? null]);
        groups.set(g, [...(groups.get(g) ?? []), k]);
      }
      for (const [g, ks] of groups) {
        const [bg, fg] = JSON.parse(g) as [string | null, string | null];
        reqs.push(bg === null && fg === null ? { ym: p.ym, keys: ks, clear: true } : { ym: p.ym, keys: ks, bg, fg });
      }
    }
    enqueue(async () => {
      let ok = true;
      let error = "";
      for (const body of reqs) {
        const r = await post(`${API}/style`, body);
        if (!r.ok) {
          ok = false;
          error = r.error;
          break;
        }
      }
      for (const el of dom.keys()) el.classList.remove("saving");
      if (ok) return;
      for (const [el, [bg, fg]] of dom) {
        el.style.background = bg;
        el.style.color = fg;
      }
      for (const [k, b] of before) Object.keys(b).length === 0 ? styleRef.current.delete(k) : styleRef.current.set(k, b);
      if (act) dropAct(act);
      store.failed += 1;
      toast.error(`บันทึกสีไม่สำเร็จ: ${error}`);
    });
  };

  const runAct = (a: Act, dir: "undo" | "redo") => {
    if (a.kind === "name")
      applyNames(
        a.entries.map((e) => ({ key: e.key, value: dir === "undo" ? e.before : e.after })),
        { check: false, record: false, what: dir === "undo" ? "ย้อนกลับ" : "ทำซ้ำ", display: a.entries.map((e) => (dir === "undo" ? e.beforeText : e.afterText)) },
      );
    else applyStyles(a.entries.map((e) => e.key), null, new Map(a.entries.map((e) => [e.key, dir === "undo" ? e.before : e.after])), false);
  };
  const undo = () => {
    const a = past.current.pop();
    if (!a) return;
    future.current.push(a);
    bumpHistory();
    runAct(a, "undo");
  };
  const redo = () => {
    const a = future.current.pop();
    if (!a) return;
    past.current.push(a);
    bumpHistory();
    runAct(a, "redo");
  };

  // ----- ใส่ชื่อเดียวกันลงตาราง 3 ช่วงเวลา (เฉพาะตาราง 6.00-8.30 / 8.30-12.30 / 12.30-16.30) -----
  const rowNow = (sec: number, day: number): string[] | null => {
    const base = p.cross?.sections.find((x) => x.sec === sec)?.rows[day];
    if (!base) return null;
    const r = [...base];
    for (let c = 1; c < r.length; c++) {
      const k = `${sec}:${colLetter(c)}:${day}`;
      if (localVals.current.has(k)) r[c] = localVals.current.get(k)!;
    }
    return r;
  };
  /** ชื่อนี้อยู่ที่จุดอื่นในแถวเดียวกันแล้วหรือไม่ → คืนชื่อจุด */
  const busyAt = (sec: number, day: number, col: string, name: string): string | null => {
    const r = rowNow(sec, day);
    const who = cellPerson(name);
    if (!r || who === null) return null;
    const ci = colIndex(col);
    for (let c = 1; c < r.length; c++) {
      if (c === ci) continue;
      const q = cellPerson(r[c] ?? "");
      if (q !== null && q.toLowerCase() === who.toLowerCase()) return pointLabel(sec as SectionNo, c) || `ช่อง ${colLetter(c)}`;
    }
    return null;
  };
  type CrossTarget = { sec: number; table: string; label: string; current: string };
  const crossTargets = (key: string): CrossTarget[] => {
    if (!p.cross) return [];
    const [secStr, col, dayStr] = key.split(":");
    const sec = Number(secStr);
    const day = Number(dayStr);
    const ci = p.cross.cols.indexOf(col);
    if (ci < 0) return [];
    const me = p.cross.sections.find((x) => x.sec === sec);
    if (!me) return [];
    return p.cross.sections
      .filter((x) => x.sec !== sec && x.points[ci] === me.points[ci] && x.rows[day])
      .map((x) => ({ sec: x.sec, table: x.table, label: x.label, current: (rowNow(x.sec, day) ?? [])[colIndex(col)] ?? "" }));
  };
  const [crossOn, setCrossOn] = useState<Record<number, boolean>>({});
  const [hi, setHi] = useState(-1); // แถวที่ไฮไลต์ในรายชื่อ (ลูกศรขึ้น/ลง)
  const searchRef = useRef<HTMLInputElement>(null);
  // ป๊อปอัปของ daisyUI ค่อย ๆ ปรากฏ (ตอนแรกยังซ่อน) จึงต้องโฟกัสช่องค้นหาหลังเฟรมแรก ไม่ใช่ autoFocus
  const editKey = edit?.key ?? "";
  useEffect(() => {
    if (!editKey) return;
    let n = 0;
    const tryFocus = () => {
      const el = searchRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
      if (document.activeElement !== el && n++ < 10) setTimeout(tryFocus, 30);
    };
    const t = setTimeout(tryFocus, 0);
    return () => clearTimeout(t);
  }, [editKey]);

  /** ช่องถัดไป: ลง/ขึ้น = คอลัมน์เดิมวันถัดไป · ซ้าย/ขวา = วันเดิมคอลัมน์ถัดไป */
  const neighbor = (key: string, dir: "up" | "down" | "left" | "right"): string | null => {
    ensureIndex();
    const cur = cells.current.find((x) => x.key === key);
    if (!cur) return null;
    let best: CellRef | null = null;
    for (const x of cells.current) {
      if (dir === "down" && x.c === cur.c && x.d > cur.d && (!best || x.d < best.d)) best = x;
      if (dir === "up" && x.c === cur.c && x.d < cur.d && (!best || x.d > best.d)) best = x;
      if (dir === "right" && x.d === cur.d && x.c > cur.c && (!best || x.c < best.c)) best = x;
      if (dir === "left" && x.d === cur.d && x.c < cur.c && (!best || x.c > best.c)) best = x;
    }
    return best?.key ?? null;
  };
  const focusKey = useRef<string | null>(store.focus);
  // จำช่องที่เลือก/ตำแหน่งคีย์บอร์ดไว้ใน store (หน้าโหลดใหม่แล้วยังทำต่อได้)
  useEffect(() => {
    store.sel = Array.from(sel);
    store.anchor = anchor.current;
    store.focus = focusKey.current;
  });
  const goTo = (key: string, extend = false) => {
    if (extend && anchor.current) setSel(new Set(rectKeys(anchor.current, key)));
    else {
      setSel(new Set([key]));
      anchor.current = key;
    }
    focusKey.current = key;
    cellEl(key)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  // ----- บันทึกชื่อจากป๊อปอัป -----
  const saveName = (v: string | null) => {
    if (!edit) return;
    const key = edit.key;
    const entries: { key: string; value: string | null }[] = [{ key, value: v }];
    const skipped: string[] = [];
    if (v !== null && v.trim() !== "") {
      for (const t of crossTargets(key)) {
        if (!crossOn[t.sec]) continue;
        if (t.current.trim() === v.trim()) continue; // มีชื่อนี้อยู่แล้ว
        const at = busyAt(t.sec, Number(edit.day), edit.col, v);
        if (at) {
          skipped.push(`ตาราง ${t.label}: อยู่ที่ ${at} แล้ว`);
          continue;
        }
        entries.push({ key: `${t.sec}:${edit.col}:${edit.day}`, value: v });
      }
    }
    setEdit(null);
    setErr("");
    applyNames(entries, { check: entries.length > 1 ? true : undefined });
    if (skipped.length > 0) toast.error(`ไม่ได้ใส่ “${v}” ในตารางอื่นบางช่อง เพราะชื่อซ้ำในช่วงเวลาเดียวกัน — ${skipped.join(" · ")}`);
    // ไปช่องถัดไป (วันถัดไป คอลัมน์เดิม) เพื่อทำต่อได้ทันที
    const nx = neighbor(key, "down");
    if (nx) goTo(nx);
  };

  const selKeys = Array.from(sel);
  const bulkManual = (v: null | "") => {
    if (selKeys.length === 0) return;
    const what = v === null ? "คืนค่าตามสูตร" : "ล้างช่องให้ว่าง";
    if (selKeys.length > 1 && !window.confirm(`${what} ${selKeys.length} ช่อง?`)) return;
    const keys = [...selKeys];
    // หลายช่องค่าเดียวกัน: ส่งแบบ keys เดิม (ตรวจเหมือนเดิม) — ประวัติเก็บค่าก่อนหน้าแยกรายช่อง
    if (keys.length === 1) return applyNames([{ key: keys[0], value: v }], { what });
    applyNames(keys.map((key) => ({ key, value: v })), { check: false, what });
  };

  const applyStyle = (patch: StylePatch) => applyStyles([...selKeys], patch, null);

  function openEdit(key: string, typed = "") {
    ensureIndex();
    const x = cells.current.find((c) => c.key === key);
    if (!x) return;
    const [sec, col, day] = key.split(":");
    const current = x.el.textContent ?? "";
    setEdit({ key, current, sec, col, day });
    setValue(typed); // ช่องค้นหา/พิมพ์ชื่อ (เริ่มว่าง หรือเป็นตัวอักษรที่เพิ่งกด)
    setHi(typed ? 0 : -1);
    setErr("");
    // ตารางอื่นที่ช่องว่างอยู่ → ติ๊กให้อัตโนมัติ · มีชื่อคนอื่นแล้ว → ไม่ติ๊ก (ติ๊กเองได้ถ้าต้องการเขียนทับ)
    setCrossOn(Object.fromEntries(crossTargets(key).map((t) => [t.sec, t.current.trim() === ""])));
    focusKey.current = key;
  }

  // ----- คีย์บอร์ด: ลูกศร = เลื่อนช่อง · พิมพ์ = ค้นหาชื่อ · Enter = เปิดรายชื่อ · Delete = ล้าง · Ctrl+Z / Ctrl+Y -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (edit || colorsOpen || sumOpen || inField) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z" && !e.shiftKey) return void (e.preventDefault(), undo());
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) return void (e.preventDefault(), redo());
      if (e.key === "Escape") return setSel(new Set());
      const cur = focusKey.current ?? anchor.current;
      if (!cur || !sel.has(cur) && sel.size === 0) return;
      const dirs: Record<string, "up" | "down" | "left" | "right"> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      if (e.key in dirs) {
        e.preventDefault();
        const n = neighbor(cur, dirs[e.key]);
        if (n) goTo(n, e.shiftKey);
        return;
      }
      if (e.key === "Enter" || e.key === "F2") return void (e.preventDefault(), openEdit(cur));
      if (e.key === "Delete" || e.key === "Backspace") return void (e.preventDefault(), bulkManual(""));
      if (!mod && !e.altKey && e.key.length === 1 && e.key.trim() !== "") {
        e.preventDefault();
        openEdit(cur, e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


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
  const xTargets = edit ? crossTargets(edit.key) : [];
  /** ชื่อซ้ำกับจุดอื่นในช่วงเวลาเดียวกัน (เฉพาะตาราง 3 ช่วงเวลา) → ไม่ให้บันทึก */
  const blocked = (n: string) => (edit ? n !== edit.current && busyAt(Number(edit.sec), Number(edit.day), edit.col, n) !== null : false);
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
        <div className="join">
          <button className="btn btn-sm join-item" onClick={undo} disabled={past.current.length === 0} title="ย้อนกลับ (Ctrl+Z)" aria-label="ย้อนกลับ">
            <Icon name="Undo2" size={16} />
          </button>
          <button className="btn btn-sm join-item" onClick={redo} disabled={future.current.length === 0} title="ทำซ้ำ (Ctrl+Y)" aria-label="ทำซ้ำ">
            <Icon name="Redo2" size={16} />
          </button>
        </div>
        <span className={savingN > 0 ? "savestat on" : failedN > 0 ? "savestat bad" : "savestat"} role="status" aria-live="polite">
          {savingN > 0 ? (
            <>
              <span className="loading loading-spinner loading-xs" /> กำลังบันทึก{savingN > 1 ? ` ${savingN} รายการ` : "…"}
            </>
          ) : failedN > 0 ? (
            <>
              <Icon name="TriangleAlert" size={14} /> ไม่ได้บันทึก {failedN} รายการ (ดูข้อความแจ้ง)
            </>
          ) : savedAt ? (
            <>
              <Icon name="Check" size={14} /> บันทึกแล้ว {savedAt}
            </>
          ) : (
            <>
              <Icon name="Check" size={14} /> ข้อมูลล่าสุด
            </>
          )}
        </span>
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
        คลิกช่องเพื่อเลือกชื่อ · ลากเมาส์ หรือกด Shift เพื่อเลือกหลายช่อง (ใส่สี/ล้างชื่อ) · Ctrl+คลิกเพื่อเพิ่ม ·
        <span className="kbd-hint">
          <Icon name="Keyboard" size={14} /> ลูกศร เลื่อนช่อง · พิมพ์ชื่อได้เลย · Enter เลือก · Delete ล้าง · Ctrl+Z ย้อนกลับ
        </span>
        ·{" "}
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
                onChange={(e) => {
                  setValue(e.target.value);
                  setHi(e.target.value.trim() ? 0 : -1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") return void (e.preventDefault(), setEdit(null));
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const n = shown.length;
                    if (n === 0) return;
                    const next = e.key === "ArrowDown" ? (hi + 1) % n : (hi <= 0 ? n - 1 : hi - 1);
                    setHi(next);
                    document.getElementById(`nl-${next}`)?.scrollIntoView({ block: "nearest" });
                    return;
                  }
                  if (e.key !== "Enter" || busy) return;
                  e.preventDefault();
                  const pick = hi >= 0 && hi < shown.length ? shown[hi] : shown.length === 1 ? shown[0] : null;
                  const name = pick ?? (!isOfficer && value.trim() !== "" ? value.trim() : null);
                  if (name === null) return;
                  const at = name === edit.current ? null : busyAt(Number(edit.sec), Number(edit.day), edit.col, name);
                  if (at) setErr(`“${name}” อยู่ที่ ${at} ในช่วงเวลานี้แล้ว — เลือกคนอื่น หรือเอาออกจากจุดนั้นก่อน`);
                  else saveName(name);
                }}
                placeholder={isOfficer ? "ค้นหาชื่อ…" : "ค้นหา หรือพิมพ์ชื่อใหม่แล้วกด Enter"}
                ref={searchRef}
              />
            </label>
            <div className="namelist" role="listbox" aria-label="รายชื่อ">
              {shown.map((n, i) => {
                const at = n === edit.current ? null : busyAt(Number(edit.sec), Number(edit.day), edit.col, n);
                return (
                  <button
                    key={n}
                    id={`nl-${i}`}
                    role="option"
                    aria-selected={n === edit.current}
                    className={["nl-item", n === edit.current ? "cur" : "", i === hi ? "hi" : "", at ? "busy" : ""].filter(Boolean).join(" ")}
                    disabled={busy || at !== null}
                    title={at ? `อยู่ที่ ${at} ในช่วงเวลานี้แล้ว` : undefined}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => saveName(n)}
                  >
                    <span className="av" style={{ background: avColor(n) }}>{Array.from(n.replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, ""))[0] ?? "?"}</span>
                    {n}
                    {at && (
                      <span className="nl-busy">
                        <Icon name="CircleAlert" size={13} /> อยู่ที่ {at} แล้ว
                      </span>
                    )}
                  </button>
                );
              })}
              {shown.length === 0 && <div className="muted small p-2">ไม่พบชื่อ{!isOfficer && value.trim() !== "" ? " — กด Enter เพื่อใช้ชื่อที่พิมพ์" : ""}</div>}
            </div>
            {xTargets.length > 0 && (
              <div className="cross-box">
                <div className="cross-title">
                  <Icon name="LayoutGrid" size={15} /> ใส่ชื่อเดียวกันในตารางอื่นด้วย <span className="muted">({pointLabel(Number(edit.sec) as SectionNo, colIndex(edit.col))} · วันที่ {edit.day})</span>
                </div>
                <div className="cross-list">
                  {xTargets.map((t) => (
                    <label key={t.sec} className={`cross-item tone-${t.table}${crossOn[t.sec] ? " on" : ""}`}>
                      <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={!!crossOn[t.sec]} onChange={(e) => setCrossOn((o) => ({ ...o, [t.sec]: e.target.checked }))} />
                      <span className="cross-name">{t.label}</span>
                      <span className={t.current.trim() ? "cross-cur has" : "cross-cur"}>{t.current.trim() ? `มี: ${t.current}` : "ว่าง"}</span>
                    </label>
                  ))}
                </div>
                {xTargets.some((t) => crossOn[t.sec] && t.current.trim() !== "") && (
                  <div className="cross-warn">
                    <Icon name="TriangleAlert" size={13} /> ช่องที่มีชื่ออยู่แล้วจะถูกเขียนทับ
                  </div>
                )}
              </div>
            )}
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
                <button className="btn btn-sm btn-primary" disabled={busy || blocked(value.trim())} onClick={() => saveName(value.trim())}>
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
