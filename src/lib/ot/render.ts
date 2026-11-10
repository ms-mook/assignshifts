// วาดฟอร์มรายเดือน OT ให้เหมือนชีต (ความกว้างคอลัมน์ สี ผสานช่อง และกฎสีตามเงื่อนไข)
import type { OtMonth } from "./engine";
import { otDupCols } from "./conflicts";

export const OT_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
export const OT_COL_W = [110, 185, 185, 185, 185, 185, 185, 125, 185, 185, 185, 125, 185, 185, 245];
export const OT_NATURAL_W = OT_COL_W.reduce((a, b) => a + b, 0);
const PINK = "#E6CFDB", BLUE = "#CFDDED", GREEN = "#D6E8D0", YEL = "#FFFF00", GREY = "#D9D9D9", PURPLE = "#B4A7D5", PEACH = "#F8CAAC";

export interface OtCellStyle { bg?: string; fg?: string }
export interface OtRenderOpts {
  editable?: boolean;
  styles?: Record<string, OtCellStyle>; // key "o:COL:day"
  personColors?: Record<string, string>;
  today?: number | null;
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const h = (txt: string, bg: string, extra = "", fg = "#000") =>
  `<td class="h" ${extra} style="background:${bg};color:${fg};font-size:14pt">${esc(txt)}</td>`;

export const OT_CSS = `
.sheet.ot td.h{font-weight:700;border:1px solid #000;white-space:normal;line-height:1.15}
.sheet.ot td.d{font-size:14pt}
.sheet.ot td.a{font-weight:700}
`;

export function renderOtHtml(m: OtMonth, o: OtRenderOpts = {}): string {
  const out: string[] = [];
  out.push(`<table class="sheet ot" style="width:${OT_NATURAL_W}px"><colgroup>`);
  for (const w of OT_COL_W) out.push(`<col style="width:${w}px">`);
  out.push("</colgroup>");
  out.push(`<tr style="height:50px"><td colspan="15" class="t" style="font-size:24pt">${esc(m.title)}</td></tr>`);
  out.push(`<tr style="height:32px"><td colspan="15" class="t" style="background:#A9C4C4;font-size:14pt">${esc(m.subtitle)}</td></tr>`);
  out.push(
    `<tr style="height:32px">${h("วันที่", "#FFFFFF", 'rowspan="3"')}${h("ห้องเจาะเลือด ฯ OPD", PINK, 'colspan="7"')}${h("ห้องเจาะเลือด ฯ กว.", BLUE, 'colspan="4"')}${h("ห้องเจาะเลือด ฯ SMC", GREEN, 'colspan="2"')}${h("", "#FFFFFF", 'rowspan="3"')}</tr>`,
  );
  out.push(
    `<tr style="height:44px">${h("จุดบัตรคิว", PINK, 'colspan="2" rowspan="2"')}${h("จุดตรวจสอบเอกสาร/เก็บ 3 OPD", YEL, 'colspan="2" rowspan="2"')}${h("จุดเก็บ รับ-นำส่ง OPD", PINK, 'colspan="2"')}${h("จุดลงทะเบียน", PINK, 'rowspan="2"')}${h("จุดบัตรคิว กว.", BLUE, 'rowspan="2"')}${h("จุดเก็บ รับ-นำส่ง กว.", BLUE, 'colspan="2" rowspan="2"')}${h("จุดลงทะเบียน", BLUE, 'rowspan="2"')}${h("จุดบัตรคิว SMC", GREEN, 'rowspan="2"')}${h("จุดเก็บ รับ-นำส่ง SMC", GREEN, 'rowspan="2"')}</tr>`,
  );
  out.push(`<tr style="height:30px">${h("คนที่1", PINK)}${h("คนที่2", PINK)}</tr>`);
  const times: [string, string, string][] = [
    ["เวลา", "#FFFFFF", "#000"], ["(06.00-08.30)", "#000000", "#FFF"], ["(08.00-16.30)", PURPLE, "#000"], ["(06.00-08.30)", "#000000", "#FFF"],
    ["(06.00-15.00)", YEL, "#000"], ["(06.00-15.00)", YEL, "#000"], ["(06.00-15.00)", YEL, "#000"], ["(06.00-15.00)", PINK, "#000"],
    ["(06.00-15.00)", YEL, "#000"], ["(06.00-08.30)", "#000000", "#FFF"], ["(07.00-16.00)", PEACH, "#000"], ["(08.00-16.30)", PURPLE, "#000"],
    ["(07.00-16.00)", GREEN, "#000"], ["(07.00-16.00)", GREEN, "#000"], ["หมายเหตุ", "#FFFFFF", "#000"],
  ];
  out.push(`<tr style="height:30px">${times.map(([t, bg, fg]) => h(t, bg, "", fg)).join("")}</tr>`);
  out.push(`<tr style="height:6px">${OT_COLS.map(() => `<td class="n" style="background:${GREY}"></td>`).join("")}</tr>`);

  const WD = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
  for (const r of m.rows) {
    const tds: string[] = [];
    const dows = r.date === null ? "" : `${WD[(((r.date - 1) % 7) + 7) % 7]} ${r.day}`;
    const off = r.date !== null && r.P === 0;
    const dup = r.date === null ? new Set<string>() : otDupCols(r.cells);
    const isToday = o.today != null && r.date === o.today;
    tds.push(
      `<td class="d a" style="background:${isToday ? "#4987E8" : off ? "#BEBEBE" : "#FFFFFF"};color:${isToday ? "#FFF" : "#000"}">${esc(dows)}</td>`,
    );
    for (let ci = 1; ci < 15; ci++) {
      const col = OT_COLS[ci];
      const v = r.cells[col] ?? "";
      let bg = col === "H" || col === "L" ? GREY : "#FFFFFF";
      let fg = col === "H" ? "#808080" : "#000";
      let extra = "";
      // ลำดับกฎตามชีต: ชื่อซ้ำ (ส้ม) > แถบเทา > ⚠ > (แทน > ปิดจุด/→
      if (ci <= 13 && dup.has(col)) { bg = "#FF9900"; fg = "#FFFFFF"; extra = "font-weight:700;"; }
      else if (off) bg = "#BEBEBE";
      else if (v.includes("⚠")) { bg = "#FF7B80"; extra = "font-weight:700;"; }
      else if (v.includes("(แทน")) bg = "#FFD966";
      else if (v.includes("ปิดจุด") || v.includes("→")) { fg = "#808080"; extra = "font-style:italic;"; }
      const key = `o:${col}:${r.day}`;
      const pc = o.personColors?.[v.split(" (แทน")[0]];
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
  out.push(`<tr style="height:21px"><td colspan="15" class="n"></td></tr>`);
  out.push(
    `<tr style="height:21px"><td colspan="15" class="n" style="text-align:left;font-size:12pt">หมายเหตุ: แถบเทา = วันหยุด/เสาร์-อาทิตย์ · (แทน) = ย้ายจากจุดบัตรคิว SMC ไปแทนคนที่ขาด · ⚠ ว่าง = ต้องหาคนเพิ่ม</td></tr>`,
  );
  out.push(`<tr style="height:40px"><td colspan="15" class="n"></td></tr>`);
  out.push(`<tr style="height:27px"><td colspan="11" class="n"></td><td colspan="4" class="sig" style="font-size:14pt">${esc(m.signerName)}</td></tr>`);
  out.push(`<tr style="height:27px"><td colspan="11" class="n"></td><td colspan="4" class="sig" style="font-size:14pt">${esc(m.signerTitle)}</td></tr>`);
  out.push("</table>");
  return out.join("");
}
