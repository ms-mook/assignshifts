// วาดฟอร์มรายเดือน SMC ให้เหมือนชีต
import { onLeave, smcDupCols, type SmcMonth, type SmcSettings } from "./engine";

export const SMC_COL_W = [100, 120, 100, 100, 100, 100, 100, 100, 100, 120, 100, 100, 100, 100, 100, 100, 120, 100, 100, 100];
export const SMC_NATURAL_W = SMC_COL_W.reduce((a, b) => a + b, 0);
const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"];
const Y = "#FFFF99", G = "#CCFFCC", B = "#CCE5FF", O = "#FFD8B2", PK = "#F7CCD6";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const h = (t: string, bg: string, extra = "") => `<td class="h" ${extra} style="background:${bg};font-size:16pt">${esc(t)}</td>`;

export const SMC_CSS = `
.sheet.smc td.h{font-weight:700;border:1px solid #000;white-space:normal;line-height:1.15}
.sheet.smc td.d{font-size:16pt}
.sheet.smc td.a{font-weight:700}
`;

export function renderSmcHtml(
  m: SmcMonth,
  s: SmcSettings,
  o: { editable?: boolean; styles?: Record<string, { bg?: string; fg?: string }>; personColors?: Record<string, string>; today?: number | null } = {},
): string {
  const out: string[] = [];
  out.push(`<table class="sheet smc" style="width:${SMC_NATURAL_W}px"><colgroup>${SMC_COL_W.map((w) => `<col style="width:${w}px">`).join("")}</colgroup>`);
  out.push(`<tr style="height:52px"><td colspan="20" class="t" style="font-size:26pt">${esc(m.title)}</td></tr>`);
  out.push(`<tr style="height:44px"><td colspan="20" class="t" style="background:#A8C9CE;font-size:24pt">${esc(m.subtitle)}</td></tr>`);
  out.push(`<tr style="height:28px">${h("เวลา", "#FFFFFF")}${h("07.00 - 08.30 น.", "#FFFFFF", 'colspan="8"')}${h("08.30 - 12.30 น.", "#FFFFFF", 'colspan="7"')}${h("12.30 - 16.00 น.", "#FFFFFF", 'colspan="4"')}</tr>`);
  out.push(
    `<tr style="height:44px">${h("วันที่", "#FFFFFF", 'rowspan="2"')}${h("Manager/Q", Y)}${h("ลงทะเบียน", G, 'colspan="2"')}${h("ทั่วไป/ตรวจสุขภาพ**", B, 'colspan="2"')}${h("ตรวจสุขภาพ/ทั่วไป**", O, 'colspan="2"')}${h("สูงอายุ/รถเข็น/**", O)}` +
      `${h("Manager/Q", Y)}${h("ลงทะเบียน", G, 'colspan="2"')}${h("ทั่วไป", B)}${h("ตรวจสุขภาพ", B)}${h("ตรวจสุขภาพ+รถเข็น", O, 'colspan="2"')}${h("ลงทะเบียน/Manager/Q", Y)}${h("Manager/เจาะ", Y)}${h("ลงทะเบียน/เจาะ", G)}${h("ทั่วไป+รถเข็น", O)}</tr>`,
  );
  const r5: [string, string][] = [
    ["บัตรคิว", PK], ["Key1", G], ["Key2", G], ["ช่อง1", B], ["ช่อง2", B], ["ช่อง3", O], ["ช่อง4", O], ["ช่อง5", O],
    ["บัตรคิว", PK], ["Key1", G], ["Key2/เจาะ", G], ["ช่อง1", B], ["ช่อง2", B], ["ช่อง3,4", O], ["ช่อง5", O],
    ["ช่อง1/บัตรคิว", PK], ["ช่อง2", PK], ["เจาะ1", G], ["ช่อง2,3,4,5", O],
  ];
  out.push(`<tr style="height:30px">${r5.map(([t, bg]) => h(t, bg)).join("")}</tr>`);
  out.push(`<tr style="height:8px">${COLS.map(() => `<td class="n"></td>`).join("")}</tr>`);
  const WD = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
  for (const r of m.rows) {
    const off = r.date !== null && r.V === 0;
    const dup = r.date === null ? new Set<string>() : smcDupCols(s, r.cells);
    const isToday = o.today != null && r.date === o.today;
    const tds: string[] = [];
    const label = r.date === null ? "" : `${r.day} ${WD[(((r.date - 1) % 7) + 7) % 7]}`;
    tds.push(`<td class="d a" style="background:${isToday ? "#4787E5" : off ? "#BCBCBC" : "#FFFFFF"};color:${isToday ? "#FFF" : "#000"}">${esc(label)}</td>`);
    for (let ci = 1; ci < 20; ci++) {
      const col = COLS[ci];
      const v = r.cells[col] ?? "";
      let bg = "#FFFFFF", fg = "#000", extra = "";
      // ลำดับกฎตามชีต: ชื่อที่ลา (ส้ม ขีดฆ่า) > ชื่อซ้ำในช่วงเวลา (ชมพู แดง) > แถบเทา
      if (r.date !== null && v !== "" && onLeave(s, v, r.date)) { bg = "#FFC659"; fg = "#8C3300"; extra = "font-weight:700;text-decoration:line-through;"; }
      else if (dup.has(col)) { bg = "#F4C1C1"; fg = "#B20000"; extra = "font-weight:700;"; }
      else if (off) bg = "#BCBCBC";
      const key = `m:${col}:${r.day}`;
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
    out.push(`<tr class="dr" style="height:32px">${tds.join("")}</tr>`);
  }
  out.push(`<tr style="height:60px"><td colspan="20" class="n"></td></tr>`);
  out.push(`<tr style="height:27px"><td colspan="16" class="n"></td><td colspan="4" class="sig" style="font-size:14pt">${esc(m.signerName)}</td></tr>`);
  out.push(`<tr style="height:27px"><td colspan="16" class="n"></td><td colspan="4" class="sig" style="font-size:14pt">${esc(m.signerTitle)}</td></tr>`);
  out.push("</table>");
  return out.join("");
}
