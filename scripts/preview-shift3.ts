// สร้างไฟล์ HTML ตัวอย่างจาก fixture เพื่อตรวจหน้าตา (ไม่ต้องต่อ Google)
declare const require: any;
declare const process: any;
const fs = require("fs");
import { computeMonth } from "../src/lib/shift3/engine";
import { parseSettings, type Grid } from "../src/lib/shift3/parse";
import { renderMonthHtml, SHEET_CSS } from "../src/lib/shift3/render";
import { serialFromYMD } from "../src/lib/sheets-date";

const [fixture, out, yb, m] = process.argv.slice(2);
const book = JSON.parse(fs.readFileSync(fixture, "utf8"));
const g: Grid = book["ตั้งค่า"].map((r: string[]) => [...r]);
const i = g.findIndex((r) => r[0] === "ชื่อผู้จัดทำ");
const tail = g.splice(i - 1, 3); while (g.length < 87) g.push([]); g.push(...tail);
const s = parseSettings(g);
const leaves = [
  { date: serialFromYMD(2027, 1, 5), name: "สาวิลักษณ์", replacement: "", type: "", note: "" },
  { date: serialFromYMD(2027, 1, 6), name: "สาวิลักษณ์", replacement: "กิ่งกาญจน์", type: "", note: "" },
];
const res = computeMonth(s, leaves, { "1:B:7": "ภูมิโชค" }, Number(yb), Number(m));
const html = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet"><style>${SHEET_CSS} body{margin:8px}</style></head><body>${renderMonthHtml(res).join('<div style="height:40px"></div>')}</body></html>`;
fs.writeFileSync(out, html);
