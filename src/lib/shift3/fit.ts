// ปรับขนาดตัวอักษรตารางเวร 3 ช่วงเวลา (6.00-8.30 / 8.30-12.30 / 12.30-16.30) ให้ใหญ่ขึ้นและพอดีช่อง
// กติกา: เริ่มที่ FIT_MAX_PT แล้วลดทีละ 0.5pt จนข้อความพอดีความกว้าง/ความสูงของช่อง (ไม่ต่ำกว่า FIT_MIN_PT)
//  - ข้อความคำเดียว (ชื่อ) ต้องอยู่บรรทัดเดียวไม่ถูกตัดกลางคำ
//  - ข้อความหลายคำ (เช่น "ชื่อ (แทน ชื่อ)") ขึ้นบรรทัดใหม่ได้ แต่ต้องไม่ล้นความสูงช่อง
// ใช้เฉพาะตารางที่มี data-section (ตารางเวร 3 ช่วงเวลา) — ตาราง Key/SMC/OT ไม่ถูกแตะ
// วัดด้วยกล่องวัดแยก (ไม่เขียน style ลงตารางระหว่างวัด) จึงเร็วและไม่กระตุก

export const FIT_MAX_PT = 22;
export const FIT_MIN_PT = 12;
const STEP = 0.5;

export interface FitOptions {
  /** ความสูงแถวข้อมูล (px) — ไม่ระบุ = อ่านจาก style ของแถว */
  dataRowH?: number;
  /** padding ซ้าย/ขวาของช่องข้อมูล (px) — ค่าเริ่มต้น 3 */
  padDataX?: number;
}

interface Box {
  td: HTMLElement;
  w: number;
  h: number;
  padX: number;
}

function px(v: string | undefined): number {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
}

/** กล่องวัดอยู่ใต้ body (นอกกรอบ zoom ของตาราง) เพื่อให้ขนาด px ตรงกับค่าในตาราง */
function makeRuler(): HTMLDivElement {
  const r = document.createElement("div");
  r.setAttribute("aria-hidden", "true");
  r.style.cssText =
    "position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;box-sizing:content-box;" +
    "font-family:'Sarabun',sans-serif;padding:0;margin:0;border:0;overflow:visible;text-align:center";
  document.body.appendChild(r);
  return r;
}

/** ขนาดตัวอักษรใหญ่สุด (pt) ที่ข้อความพอดีกล่อง availW x availH */
function bestPt(
  ruler: HTMLDivElement,
  cache: Map<string, number>,
  text: string,
  bold: boolean,
  italic: boolean,
  lineH: number,
  availW: number,
  availH: number,
  mode: "auto" | "line",
): number {
  const key = `${text}|${bold ? 1 : 0}${italic ? 1 : 0}|${lineH}|${Math.round(availW)}|${Math.round(availH)}|${mode}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  // auto: ชื่อคำเดียวต้องอยู่บรรทัดเดียว · ข้อความหลายคำขึ้นบรรทัดใหม่ได้ถ้าไม่ล้นความสูง · line: บังคับบรรทัดเดียว
  const oneWord = mode === "line" || !/\s/.test(text);
  ruler.style.fontWeight = bold ? "700" : "400";
  ruler.style.fontStyle = italic ? "italic" : "normal";
  ruler.style.lineHeight = String(lineH);
  ruler.style.whiteSpace = oneWord ? "nowrap" : "normal";
  ruler.style.overflowWrap = "normal";
  ruler.style.width = oneWord ? "auto" : `${availW}px`;
  ruler.textContent = text;
  let pt = FIT_MAX_PT;
  for (; pt > FIT_MIN_PT; pt -= STEP) {
    ruler.style.fontSize = `${pt}pt`;
    const wOk = ruler.scrollWidth <= availW + 0.01;
    const hOk = ruler.scrollHeight <= availH + 0.01;
    if (wOk && hOk) break;
  }
  cache.set(key, pt);
  return pt;
}

/** ช่องข้อมูล: โหมด auto · หัวตาราง: ถ้าบรรทัดเดียวได้ตัวใหญ่พอ (>= 16pt) ใช้บรรทัดเดียว ไม่งั้นให้ขึ้นบรรทัดใหม่เพื่อให้ตัวใหญ่ขึ้น */
function pickPt(
  ruler: HTMLDivElement,
  cache: Map<string, number>,
  text: string,
  bold: boolean,
  italic: boolean,
  isData: boolean,
  availW: number,
  availH: number,
): number {
  if (isData) return bestPt(ruler, cache, text, bold, italic, 1.1, availW, availH, "auto");
  const one = bestPt(ruler, cache, text, bold, italic, 1.15, availW, availH, "line");
  if (one >= 16) return one;
  return Math.max(one, bestPt(ruler, cache, text, bold, italic, 1.15, availW, availH, "auto"));
}

/** ปรับทุกช่องของตารางเวรใน root (เรียกซ้ำได้ — ทุกครั้งคำนวณใหม่จากขนาดสูงสุด) */
export function fitSheetText(root: HTMLElement, opt: FitOptions = {}): void {
  const tables = Array.from(root.querySelectorAll<HTMLTableElement>("table.sheet[data-section]"));
  if (root instanceof HTMLTableElement && root.matches("table.sheet[data-section]")) tables.push(root);
  for (const table of tables) {
    const colW = Array.from(table.querySelectorAll("col")).map((c) => px((c as HTMLElement).style.width));
    if (colW.length === 0) continue;
    const ruler = makeRuler();
    const cache = new Map<string, number>();
    const boxes: Box[] = [];
    const occ: number[] = []; // จำนวนแถวที่ช่อง rowspan ยังกินอยู่ ต่อคอลัมน์
    const rows = Array.from(table.rows);
    const rowH = rows.map((tr) => (tr.classList.contains("dr") && opt.dataRowH ? opt.dataRowH : px(tr.style.height)));
    rows.forEach((tr, ri) => {
      // คอลัมน์ที่ถูกช่อง rowspan จากแถวบนกินอยู่ในแถวนี้
      const blocked = new Set<number>();
      for (let c = 0; c < colW.length; c++)
        if ((occ[c] ?? 0) > 0) {
          blocked.add(c);
          occ[c]--;
        }
      let col = 0;
      for (const td of Array.from(tr.cells)) {
        while (blocked.has(col)) col++;
        const cs = td.colSpan || 1;
        const rs = td.rowSpan || 1;
        if (rs > 1) for (let k = 0; k < cs; k++) occ[col + k] = rs - 1;
        const isData = td.classList.contains("d");
        const isHead = td.classList.contains("h");
        if (isData || isHead) {
          let w = 0;
          for (let k = 0; k < cs; k++) w += colW[col + k] ?? 0;
          let h = 0;
          for (let k = 0; k < rs; k++) h += rowH[ri + k] ?? 0;
          boxes.push({ td, w, h, padX: isData ? opt.padDataX ?? 3 : 3 });
        }
        col += cs;
      }
    });
    const out: [HTMLElement, number][] = [];
    for (const b of boxes) {
      const text = (b.td.textContent ?? "").trim();
      if (!text) continue;
      const isData = b.td.classList.contains("d");
      const bold = b.td.style.fontWeight !== "400";
      const italic = b.td.style.fontStyle === "italic";
      const availW = b.w - b.padX * 2 - 2 - 1; // เส้นขอบ 1px x2 + เผื่อ 1px
      const availH = b.h - 2 - 1;
      if (availW <= 0 || availH <= 0) continue;
      out.push([b.td, pickPt(ruler, cache, text, bold, italic, isData, availW, availH)]);
    }
    ruler.remove();
    for (const [td, pt] of out) td.style.fontSize = `${pt}pt`;
  }
}

/** ปรับเฉพาะช่องเดียว (หลังพิมพ์/แก้ชื่อบนจอ) */
export function fitSheetCell(td: HTMLElement, opt: FitOptions = {}): void {
  const table = td.closest<HTMLTableElement>("table.sheet[data-section]");
  if (!table || !td.classList.contains("d")) return;
  const tr = td.parentElement as HTMLTableRowElement;
  const col = (td as HTMLTableCellElement).cellIndex; // แถวข้อมูล: ช่องที่ i = คอลัมน์ i
  const colW = Array.from(table.querySelectorAll("col")).map((c) => px((c as HTMLElement).style.width));
  const text = (td.textContent ?? "").trim();
  if (!text) {
    td.style.fontSize = `${FIT_MAX_PT}pt`;
    return;
  }
  const ruler = makeRuler();
  const h = opt.dataRowH ?? px(tr.style.height);
  const pt = bestPt(
    ruler,
    new Map(),
    text,
    td.style.fontWeight !== "400",
    td.style.fontStyle === "italic",
    1.1,
    (colW[col] ?? 0) - (opt.padDataX ?? 3) * 2 - 3,
    h - 3,
    "auto",
  );
  ruler.remove();
  td.style.fontSize = `${pt}pt`;
}

/** รอฟอนต์ Sarabun โหลดก่อนวัด (ถ้าวัดตอนยังเป็นฟอนต์สำรอง ขนาดจะเพี้ยน) */
export async function fontsReady(): Promise<void> {
  try {
    if (document.fonts) {
      await Promise.all([document.fonts.load("700 16px Sarabun"), document.fonts.load("400 16px Sarabun")]);
      await document.fonts.ready;
    }
  } catch {
    /* ใช้ฟอนต์สำรอง */
  }
}
