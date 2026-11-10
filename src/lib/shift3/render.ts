// สร้าง HTML ตารางเดือน (3 ส่วน) ให้หน้าตาเหมือนชีต — ใช้ทั้งหน้าเว็บ, หน้าพิมพ์/PDF
// กฎสี (Conditional formatting) ลำดับตามชีต: กฎแรกที่ตรงชนะ

import { COLORS, COL_WIDTH, HEADER_ROWS, ROW_HEIGHT, baseCellStyle, groupColor } from "./layout";
import { colLetter } from "./engine";
import { cellPerson, duplicateCols } from "./conflicts";
import type { MonthResult, MonthRow, MonthSection, SectionNo } from "./types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MANUAL_WHITE_COLS = [1, 3, 4, 5, 18, 19, 20, 28]; // ส่วนที่ 1: B, D:F, S:U, AC

function dataCellStyle(
  sec: MonthSection,
  row: MonthRow,
  col: number,
  over?: CellStyle,
  personFg?: string,
): string {
  const v = row.cells[col];
  const base = baseCellStyle(sec.section, col);
  let bg = base.bg ?? "#FFFFFF";
  let fg = base.fg ?? "#000000";
  let bold = true;
  let italic = false;
  const has = (t: string) => v.includes(t);

  const rules: (() => boolean)[] =
    sec.section === 3
      ? [
          () => (row.workday === 0 ? ((bg = COLORS.grayRow[3]), true) : false),
          () => (has("⚠") ? ((bg = COLORS.warn), (bold = true), true) : false),
          () => (has("(แทน") ? ((bg = COLORS.replace), true) : false),
          () => (has("→") ? ((fg = COLORS.moved), (italic = true), true) : false),
        ]
      : [
          () =>
            sec.section === 1 && MANUAL_WHITE_COLS.includes(col) && v !== "" && v !== "จนท."
              ? ((bg = "#FFFFFF"), (fg = "#000000"), true)
              : false,
          () => (row.workday === 0 ? ((bg = COLORS.grayRow[sec.section]), true) : false),
          () => (has("⚠") ? ((bg = COLORS.warn), (bold = true), true) : false),
          () => (has("(แทน") ? ((bg = COLORS.replace), true) : false),
          () => (has("→") ? ((fg = COLORS.moved), (italic = true), true) : false),
        ];
  for (const r of rules) if (r()) break;
  if (personFg) fg = personFg;
  if (over?.bg) bg = over.bg;
  if (over?.fg) fg = over.fg;
  const size = col === 0 ? 14 : 16;
  return `background:${bg};color:${fg};font-size:${size}pt;font-weight:${bold ? 700 : 400};${italic ? "font-style:italic;" : ""}`;
}

export interface CellStyle {
  bg?: string;
  fg?: string;
}

export interface RenderOptions {
  /** ทำให้ทุกช่องตำแหน่งคลิกเลือก/แก้ได้ */
  editable?: boolean;
  /** รูปแบบรายช่อง (สีพื้น/สีตัวอักษร) key = `${ส่วน}:${คอลัมน์}:${วัน}` */
  styles?: Record<string, CellStyle>;
  /** สีตัวอักษรตามชื่อพนักงาน */
  personColors?: Record<string, string>;
}

export function renderSection(sec: MonthSection, res: MonthResult, opt: RenderOptions = {}): string {
  const s = sec.section as SectionNo;
  const head = HEADER_ROWS[s];
  const hSize = s === 1 ? 18 : 16;
  const out: string[] = [];
  const tableWidth = COL_WIDTH.A + 36 * COL_WIDTH.other;
  out.push(`<table class="sheet" data-section="${s}" style="width:${tableWidth}px"><colgroup><col style="width:${COL_WIDTH.A}px">`);
  for (let i = 1; i < 37; i++) out.push(`<col style="width:${COL_WIDTH.other}px">`);
  out.push(`</colgroup><tbody>`);

  // แถว 1-3
  out.push(
    `<tr style="height:${ROW_HEIGHT.title}px"><td colspan="37" class="t" style="background:${COLORS.title};font-size:28pt">${esc(sec.title)}</td></tr>`,
  );
  out.push(
    `<tr style="height:${ROW_HEIGHT.subtitle}px"><td colspan="37" class="t" style="background:${COLORS.subtitle};font-size:26pt">${esc(sec.subtitle)}</td></tr>`,
  );
  out.push(
    `<tr style="height:${ROW_HEIGHT.time}px"><td colspan="37" class="t" style="background:${COLORS.time};font-size:26pt">${esc(sec.timeLabel)}</td></tr>`,
  );

  // แถว 4: A (merge 3 แถว) + กลุ่มอาคาร
  const r4: string[] = [
    `<td rowspan="3" class="h" style="background:#FFFFFF;font-size:${hSize}pt">${esc(head[0][0])}</td>`,
  ];
  const spans: [number, number][] = [[1, 17], [17, 28], [28, 33], [33, 35], [35, 37]];
  for (const [a, b] of spans)
    r4.push(`<td colspan="${b - a}" class="h" style="background:${groupColor(a)};font-size:${hSize}pt">${esc(head[0][a])}</td>`);
  out.push(`<tr style="height:${ROW_HEIGHT.header[0]}px">${r4.join("")}</tr>`);

  // แถว 5-6
  for (const k of [1, 2]) {
    const cells: string[] = [];
    for (let c = 1; c < 37; c++)
      cells.push(`<td class="h" style="background:${groupColor(c)};font-size:${hSize}pt">${esc(head[k][c])}</td>`);
    out.push(`<tr style="height:${ROW_HEIGHT.header[k]}px">${cells.join("")}</tr>`);
  }
  // แถว 7 (เวลา)
  out.push(
    `<tr style="height:${ROW_HEIGHT.header[3]}px">${head[3]
      .map((v) => `<td class="h" style="background:${COLORS.headRow7};color:#FFFFFF;font-size:${hSize}pt">${esc(v)}</td>`)
      .join("")}</tr>`,
  );

  // ข้อมูล 31 แถว
  const personColors = new Map(Object.entries(opt.personColors ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  for (const row of sec.rows) {
    const dups = row.date !== null ? duplicateCols(row.cells) : new Set<number>();
    const tds = row.cells.map((v, c) => {
      const key = `${s}:${colLetter(c)}:${row.day}`;
      const over = opt.styles?.[key];
      const who = c > 0 ? cellPerson(v) : null;
      const personFg = who ? personColors.get(who.toLowerCase()) : undefined;
      const isDup = dups.has(c);
      const style = dataCellStyle(sec, row, c, over, personFg);
      const cls = `d${opt.editable && c > 0 && row.date !== null ? " e" : ""}${row.manualCols.includes(c) ? " m" : ""}${isDup ? " dup" : ""}`;
      const attr = opt.editable && c > 0 && row.date !== null ? ` data-k="${key}"` : "";
      return `<td${attr} class="${cls}" style="${style}"${isDup ? ' title="ชื่อซ้ำกับช่องอื่นในแถวเดียวกัน"' : ""}>${esc(v)}</td>`;
    });
    out.push(`<tr class="dr" style="height:${ROW_HEIGHT.data}px">${tds.join("")}</tr>`);
  }

  // ช่องลงนาม (X:AK merge)
  const sig = (h: number, text: string) =>
    `<tr style="height:${h}px"><td colspan="23" class="n"></td><td colspan="14" class="sig">${esc(text)}</td></tr>`;
  out.push(sig(ROW_HEIGHT.sigGap, ""));
  out.push(sig(ROW_HEIGHT.sig, `(${res.signerName})`));
  out.push(sig(ROW_HEIGHT.sig, res.signerTitle));
  out.push(`</tbody></table>`);
  return out.join("");
}

export const SHEET_CSS = `
.sheet{border-collapse:collapse;table-layout:fixed;font-family:'Sarabun',sans-serif;color:#000;background:#fff}
.sheet td{padding:0 3px;overflow:hidden;text-align:center;vertical-align:middle}
.sheet td.t{font-weight:700;white-space:normal}
.sheet td.h{font-weight:700;white-space:normal;border:1px solid #000;line-height:1.15}
.sheet td.d{border:1px solid #000;white-space:normal;overflow-wrap:anywhere;line-height:1.1;text-overflow:clip}
.sheet td.n{border:none}
.sheet td.dup{outline:3px solid #C00000;outline-offset:-3px}
.sheet td.sig{font-size:16pt;font-weight:700;white-space:normal;border:none}
`;

export function renderMonthHtml(res: MonthResult, opt: RenderOptions = {}): string[] {
  return res.sections.map((sec) => renderSection(sec, res, opt));
}
