// วาดฟอร์มรายเดือน Key ให้เหมือนชีต (ความกว้างคอลัมน์ สี ผสานช่อง และกฎสีตามเงื่อนไข)
import type { KeyMonth, KeySettings } from "./engine";

export const KEY_COL_W = [110, 100, 125, 100, 100, 100, 105, 100, 100, 125, 100, 100, 100, 100, 100, 170];
export const KEY_NATURAL_W = KEY_COL_W.reduce((a, b) => a + b, 0);
const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
const PINK = "#EAD1DC", ROSE = "#F4CCD8", BLUE = "#CCDDF2", YEL = "#FFFF00";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const h = (t: string, bg: string, extra = "") => `<td class="h" ${extra} style="background:${bg};font-size:16pt">${esc(t)}</td>`;

export const KEY_CSS = `
.sheet.key td.h{font-weight:700;border:1px solid #000;white-space:normal;line-height:1.15}
.sheet.key td.d{font-size:16pt}
.sheet.key td.a{font-weight:700}
`;
export interface KeyCellStyle { bg?: string; fg?: string }

/** แถวที่เป็นชื่อซ้ำในแถว (กฎสีส้มของชีต: B:F และ H:O ไม่นับ MT full-time/ลา) */
export function keyDupCols(cells: Record<string, string>): Set<string> {
  const area = ["B", "C", "D", "E", "F", "H", "I", "J", "K", "L", "M", "N", "O"];
  const out = new Set<string>();
  for (const c of area) {
    const v = cells[c] ?? "";
    if (v === "" || v === "MT full-time" || v === "ลา") continue;
    const n = area.filter((x) => (cells[x] ?? "").toLowerCase() === v.toLowerCase()).length;
    if (n > 1) out.add(c);
  }
  return out;
}

export function renderKeyHtml(
  m: KeyMonth,
  s: KeySettings,
  o: { editable?: boolean; styles?: Record<string, KeyCellStyle>; personColors?: Record<string, string>; today?: number | null } = {},
): string {
  const out: string[] = [];
  out.push(`<table class="sheet key" style="width:${KEY_NATURAL_W}px"><colgroup>${KEY_COL_W.map((w) => `<col style="width:${w}px">`).join("")}</colgroup>`);
  out.push(`<tr style="height:34px"><td colspan="16" class="t" style="font-size:18pt">${esc(m.title)}</td></tr>`);
  out.push(`<tr style="height:28px"><td colspan="16" class="t" style="background:#A3C1C1;font-size:16pt">${esc(m.subtitle)}</td></tr>`);
  out.push(
    `<tr style="height:30px">${h("วันที่", "#FFFFFF", 'rowspan="2"')}${h("ห้องเจาะเลือด ฯ อาคารผู้ป่วยนอก OPD (OPD ชั้น 1)", PINK, 'colspan="6"')}${h("จนท.แทน", ROSE)}${h("จนท.แทน", ROSE)}${h("ห้องเจาะเลือด ฯ อาคารกัลยาณิวัฒนา (กว.)", BLUE, 'colspan="4"')}${h("จนท.แทน", BLUE)}${h("จนท.แทน", BLUE)}${h("หมายเหตุ", "#BFBFBF", 'rowspan="2"')}</tr>`,
  );
  const r4: [string, string][] = [
    ["Key1", ROSE], ["Key2", "#999999"], ["Key3(E)", ROSE], ["Key4**", ROSE], ["Key5**", ROSE], ["หัวหน้าเวร(R/A)", YEL],
    ["OPD key(เสริม2)", YEL], ["OPD เก็บ 1", YEL], ["Key1", BLUE], ["Key2", BLUE], ["Key3(E)", BLUE], ["Key4 (SMC)", BLUE], ["กว. คิว/เก็บ", YEL], ["OPD คิว", YEL],
  ];
  out.push(`<tr style="height:50px">${r4.map(([t, bg]) => h(t, bg)).join("")}</tr>`);

  const WD = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
  for (const r of m.rows) {
    const off = r.date !== null && r.Q === 0;
    const dup = r.date === null ? new Set<string>() : keyDupCols(r.cells);
    const isToday = o.today != null && r.date === o.today;
    const tds: string[] = [];
    const label = r.date === null ? "" : `${WD[(((r.date - 1) % 7) + 7) % 7]} ${r.day}`;
    tds.push(`<td class="d a" style="background:${isToday ? "#4886E7" : off ? "#BDBDBD" : "#FFFFFF"};color:${isToday ? "#FFF" : "#000"}">${esc(label)}</td>`);
    for (let ci = 1; ci < 16; ci++) {
      const col = COLS[ci];
      const v = r.cells[col] ?? "";
      let bg = "#FFFFFF", fg = "#000", extra = col === "P" ? "font-size:14pt;" : "";
      const subCell = r.date !== null && ["D", "E", "F", "G", "L", "M"].includes(col) && v !== "" && v !== "ลา" && s.leaves.some((l) => l.date === r.date && l.sub === v);
      // ลำดับกฎตามชีต: ลา > ผู้แทน (เขียว) > ชื่อซ้ำ (ส้ม) > แถบเทา
      if (["D", "E", "F", "G", "L", "M"].includes(col) && v === "ลา") { bg = "#FFD799"; fg = "#B14B00"; extra += "font-weight:700;"; }
      else if (subCell) bg = "#D1EED1";
      else if (dup.has(col)) { bg = "#FF9900"; fg = "#FFFFFF"; extra += "font-weight:700;"; }
      else if (off) bg = "#BDBDBD";
      const key = `k:${col}:${r.day}`;
      const pc = o.personColors?.[v];
      if (pc && fg === "#000") fg = pc;
      const st = o.styles?.[key];
      if (st?.bg) bg = st.bg;
      if (st?.fg) fg = st.fg;
      const cls = ["d"];
      if (o.editable && r.date !== null) cls.push("e");
      if (r.manualCols.includes(col)) cls.push("m");
      if (dup.has(col)) cls.push("dup");
      const k = o.editable && r.date !== null ? ` data-k="${key}"` : "";
      tds.push(`<td class="${cls.join(" ")}"${k} style="background:${bg};color:${fg};${extra}">${esc(v)}</td>`);
    }
    out.push(`<tr class="dr" style="height:27px">${tds.join("")}</tr>`);
  }
  out.push(`<tr style="height:21px"><td colspan="16" class="n"></td></tr>`);
  out.push(`<tr style="height:21px"><td colspan="16" class="n" style="text-align:left;font-size:12pt">หมายเหตุ: แถบเทา = วันหยุด/เสาร์-อาทิตย์</td></tr>`);
  out.push(`<tr style="height:40px"><td colspan="16" class="n"></td></tr>`);
  out.push(`<tr style="height:27px"><td colspan="11" class="n"></td><td colspan="5" class="sig" style="font-size:14pt">${esc(m.signerName)}</td></tr>`);
  out.push(`<tr style="height:27px"><td colspan="11" class="n"></td><td colspan="5" class="sig" style="font-size:14pt">${esc(m.signerTitle)}</td></tr>`);
  out.push("</table>");
  return out.join("");
}
