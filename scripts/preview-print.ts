// สร้าง HTML ตัวอย่างหน้าพิมพ์ (ใช้ CSS/ตัวคำนวณขนาดเดียวกับหน้าเว็บ) เพื่อตรวจ PDF ด้วย Playwright
// รัน: tsx scripts/preview-print.ts fixtures/shift3-sheet.json out.html <paper a4|legal> <section 1|2|3> <ปี พ.ศ.> <เดือน>
declare const require: any;
declare const process: any;
const fs = require("fs");
import { computeMonth } from "../src/lib/shift3/engine";
import { parseSettings, type Grid } from "../src/lib/shift3/parse";
import { renderMonthHtml, SHEET_CSS } from "../src/lib/shift3/render";
import { COL_WIDTH, ROW_HEIGHT } from "../src/lib/shift3/layout";
import { serialFromYMD } from "../src/lib/sheets-date";

const [fixture, out, paper = "a4", sec = "1", yb = "2570", m = "1"] = process.argv.slice(2);
const book = JSON.parse(fs.readFileSync(fixture, "utf8"));
const g: Grid = book["ตั้งค่า"].map((r: string[]) => [...r]);
const i = g.findIndex((r) => r[0] === "ชื่อผู้จัดทำ");
const tail = g.splice(i - 1, 3);
while (g.length < 87) g.push([]);
g.push(...tail);
const s = parseSettings(g);
const leaves = [
  { date: serialFromYMD(2027, 1, 5), name: "สาวิลักษณ์", replacement: "", type: "", note: "" },
  { date: serialFromYMD(2027, 1, 6), name: "สาวิลักษณ์", replacement: "กิ่งกาญจน์", type: "", note: "" },
];
const styles: Record<string, { bg?: string; fg?: string }> = {
  [`${sec}:K:8`]: { bg: "#7F7F7F" }, [`${sec}:L:8`]: { bg: "#7F7F7F" }, [`${sec}:M:9`]: { bg: "#FFF2CC", fg: "#C00000" },
};
const res = computeMonth(s, leaves, { "1:B:7": "ภูมิโชค" }, Number(yb), Number(m));
const html = renderMonthHtml(res, { editable: true, styles, personColors: { "ภัทรสุดา": "#1F4E9E" } })[Number(sec) - 1];

const MM = 96 / 25.4, MARGIN = 5;
const P: Record<string, any> = { a4: { css: "A4 landscape", w: 297 * MM, h: 210 * MM }, legal: { css: "legal landscape", w: 14 * 96, h: 8.5 * 96 } };
const pg = P[paper];
const NW = COL_WIDTH.A + 36 * COL_WIDTH.other;
const FIXED = ROW_HEIGHT.title + ROW_HEIGHT.subtitle + ROW_HEIGHT.time + ROW_HEIGHT.header.reduce((a: number, b: number) => a + b, 0) + ROW_HEIGHT.sigGap + ROW_HEIGHT.sig * 2 + 40;
const pw = pg.w - 2 * MARGIN * MM, ph = pg.h - 2 * MARGIN * MM;
const zoomPrint = (pw / NW) * 0.995;
const rowH = Math.max(70, Math.min(160, (NW * (ph / pw) - FIXED) / 31));
const css = fs.readFileSync("src/app/globals.css", "utf8");
fs.writeFileSync(
  out,
  `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>${css}</style><style>${SHEET_CSS}</style><style>@page{size:${pg.css};margin:${MARGIN}mm}</style></head><body><main><div class="schedule"><div class="sections" style="--print-zoom:${zoomPrint};--print-row-h:${rowH}px"><div class="print-page"><div class="screen-zoom" style="zoom:0.35">${html}</div></div></div></div></main></body></html>`,
);
console.log(JSON.stringify({ zoomPrint, rowH }));
