// วาดฟอร์มรายเดือน "ตารางเวรนอกเวลา" ให้เหมือนแท็บเดือนในชีต (A1:Z40)
import { OFF_COLS, cfOf, colCounts, OFF_EDIT_COLS, offOnLeave, offRowDupCols, type OffLeave, type OffMonth } from "./engine";

/** ความกว้างคอลัมน์ในชีต (px) A38 · B66 · C–W 82 · X38 · Y/Z 86 — ขยาย 1.2 เท่าให้อ่านง่ายบนแท็บเล็ต */
const SCALE = 1.2;
export const OFF_COL_W = OFF_COLS.map((c) => Math.round((c === "A" || c === "X" ? 38 : c === "B" ? 66 : c === "Y" || c === "Z" ? 86 : 82) * SCALE));
export const OFF_NATURAL_W = OFF_COL_W.reduce((a, b) => a + b, 0);

const GREEN = "#D9EAD2", YEL = "#FFFF00", ORG = "#F6B16B", PINK = "#EAD1DC", BLUE = "#CFE1F3", CREAM = "#FFF1CC", WHITE = "#FFFFFF", RED = "#FF0000";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const OFF_CSS = `
.sheet.off td{font-size:11pt}
.sheet.off td.h{font-weight:700;border:1px solid #000;white-space:normal;line-height:1.15;font-size:10.5pt;text-align:center;vertical-align:middle}
.sheet.off td.t1{font-size:14pt;font-weight:700;text-align:center;border:1px solid #000}
.sheet.off td.t2{font-size:12.5pt;font-weight:700;text-align:center;background:#A1C4C8;border:1px solid #000}
.sheet.off td.d{font-size:11pt;text-align:center;border:1px solid #000}
`;

export function renderOffHtml(
  m: OffMonth,
  o: {
    editable?: boolean;
    styles?: Record<string, { bg?: string; fg?: string }>;
    personColors?: Record<string, string>;
    leaves?: OffLeave[];
    today?: number | null;
  } = {},
): string {
  const H = (k: string) => esc(m.head[k] ?? "");
  const h = (k: string, bg: string, extra = "", fg = "#000") => `<td class="h" ${extra} style="background:${bg};color:${fg}">${H(k)}</td>`;
  const out: string[] = [];
  out.push(`<table class="sheet off" style="width:${OFF_NATURAL_W}px"><colgroup>${OFF_COL_W.map((w) => `<col style="width:${w}px">`).join("")}</colgroup>`);
  out.push(`<tr style="height:40px"><td colspan="26" class="t1">${H("A1")}</td></tr>`);
  out.push(`<tr style="height:30px"><td colspan="26" class="t2">${H("A2")}</td></tr>`);
  // แถว 3
  out.push(
    `<tr style="height:38px">${h("A3", WHITE, 'rowspan="4"')}${h("B3", WHITE, 'rowspan="4"')}${h("C3", GREEN, 'colspan="17"')}${h("T3", YEL, 'colspan="4"')}${h("X3", WHITE, 'rowspan="4"')}${h("Y3", GREEN, 'colspan="2"')}</tr>`,
  );
  // แถว 4
  out.push(`<tr style="height:38px">${h("C4", GREEN, 'colspan="5"')}${h("H4", GREEN, 'colspan="9"')}${h("Q4", GREEN, 'colspan="3"')}${h("T4", YEL, 'colspan="4"')}${h("Y4", GREEN)}${h("Z4", GREEN)}</tr>`);
  // แถว 5
  const r5 = "CDEFGHIJKLMNOPQRS".split("").map((c) => h(`${c}5`, ["C", "D", "H", "J", "Q"].includes(c) ? ORG : WHITE)).join("");
  out.push(`<tr style="height:26px">${r5}${h("T5", YEL, 'colspan="4"', RED)}${h("Y5", WHITE, 'colspan="2"', RED)}</tr>`);
  // แถว 6
  const bg6 = (c: string) => ("CDEFG".includes(c) ? PINK : "HIJKLMNOP".includes(c) ? BLUE : "QRS".includes(c) ? CREAM : c === "T" || c === "Y" ? PINK : c === "W" ? CREAM : BLUE);
  const r6 = "CDEFGHIJKLMNOPQRSTUVW".split("").map((c) => h(`${c}6`, bg6(c), "", c === "H" || c === "T" ? RED : "#000")).join("");
  out.push(`<tr style="height:30px">${r6}${h("Y6", PINK)}${h("Z6", BLUE)}</tr>`);

  const counts = Object.fromEntries(OFF_EDIT_COLS.map((c) => [c, colCounts(m.rows, c)]));
  const dc = (c: string, v: string) => counts[c]?.get(v.trim().toLowerCase()) ?? 0;
  for (const r of m.rows) {
    const rowDup = r.date === null ? new Set<string>() : offRowDupCols(r.cells);
    const tds: string[] = [];
    for (const col of OFF_COLS) {
      if (col === "A" || col === "B" || col === "X") {
        const f = cfOf(r, col, dc);
        const today = o.today != null && r.date === o.today && col !== "B";
        const v = col === "A" ? r.A : col === "B" ? r.B : r.X;
        tds.push(
          `<td class="d" style="background:${today ? "#4787E5" : f?.bg ?? WHITE};color:${today ? "#FFF" : f?.fg ?? "#000"};${f?.bold || today ? "font-weight:700;" : ""}">${esc(v)}</td>`,
        );
        continue;
      }
      const v = r.cells[col] ?? "";
      const f = cfOf(r, col, dc);
      let bg = f?.bg ?? WHITE, fg = f?.fg ?? "#000", extra = f?.bold ? "font-weight:700;" : "";
      // ชื่อที่ งดเวรนอกเวลา วันนั้น (ระบบลา) → ส้ม ขีดฆ่า (เหมือนตารางอื่น) มาก่อนกฎของชีต
      if (r.date !== null && v.trim() !== "" && offOnLeave(o.leaves ?? [], v, r.date)) {
        bg = "#FFC659";
        fg = "#8C3300";
        extra = "font-weight:700;text-decoration:line-through;";
      }
      const key = `w:${col}:${r.day}`;
      const pc = o.personColors?.[v];
      if (pc && fg === "#000") fg = pc;
      const st = o.styles?.[key];
      if (st?.bg) bg = st.bg;
      if (st?.fg) fg = st.fg;
      const cls = ["d"];
      const editable = o.editable && r.date !== null;
      if (editable) cls.push("e");
      if (r.manualCols.includes(col)) cls.push("m");
      // กรอบแดง = คนเดียวอยู่ 2 จุดในวันเดียวกัน (กฎของเว็บ) · สีชมพู = ชื่อซ้ำในคอลัมน์ทั้งเดือน (กฎของชีต)
      if (rowDup.has(col)) cls.push("dup");
      tds.push(`<td class="${cls.join(" ")}"${editable ? ` data-k="${key}"` : ""} style="background:${bg};color:${fg};${extra}">${esc(v)}</td>`);
    }
    out.push(`<tr class="dr" style="height:28px">${tds.join("")}</tr>`);
  }
  out.push(`<tr style="height:24px"><td colspan="26" class="n"></td></tr>`);
  out.push(`<tr style="height:26px"><td colspan="16" class="n"></td><td colspan="7" class="sig" style="font-size:11pt;text-align:center">${esc(m.signerName)}</td><td colspan="3" class="n"></td></tr>`);
  out.push(`<tr style="height:26px"><td colspan="16" class="n"></td><td colspan="7" class="sig" style="font-size:11pt;text-align:center">${esc(m.signerTitle)}</td><td colspan="3" class="n"></td></tr>`);
  out.push("</table>");
  return out.join("");
}
