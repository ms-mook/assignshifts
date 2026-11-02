// สร้างไฟล์ PDF 1 หน้า (ภาพตารางเต็มหน้า) ในเบราว์เซอร์ แล้วดาวน์โหลดทันที — ไม่ต้องใช้หน้าต่างพิมพ์/พรีวิว
// วิธี: วาดตารางเป็น SVG(foreignObject) → canvas → JPEG → ห่อเป็น PDF หน้าเดียว (เขียนเองไม่พึ่งไลบรารี)

const PT = 72 / 96; // px(96dpi) → pt

export type PdfPaper = { wPt: number; hPt: number };
export const PAPER_PT: Record<"a4" | "legal", PdfPaper> = {
  a4: { wPt: 841.89, hPt: 595.28 },
  legal: { wPt: 1008, hPt: 612 },
};

let fontCss: Promise<string> | null = null;
/** ฝังฟอนต์ Sarabun (จาก Google Fonts) เป็น data URL เพื่อให้ภาพที่วาดใช้ฟอนต์เดียวกับหน้าจอ; ถ้าโหลดไม่ได้ใช้ฟอนต์สำรอง */
function loadFontCss(): Promise<string> {
  if (fontCss) return fontCss;
  fontCss = (async () => {
    try {
      const css = await (await fetch("https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap")).text();
      const urls = Array.from(new Set(Array.from(css.matchAll(/url\((https:[^)]+)\)/g)).map((m) => m[1])));
      const map = new Map<string, string>();
      await Promise.all(
        urls.map(async (u) => {
          const buf = await (await fetch(u)).arrayBuffer();
          let bin = "";
          const b = new Uint8Array(buf);
          for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
          map.set(u, `data:font/woff2;base64,${btoa(bin)}`);
        }),
      );
      return css.replace(/url\((https:[^)]+)\)/g, (_, u) => `url(${map.get(u) ?? u})`);
    } catch {
      fontCss = null; // ลองใหม่ครั้งหน้า
      return "";
    }
  })();
  return fontCss;
}

function pdfFromJpeg(jpeg: Uint8Array, imgW: number, imgH: number, page: PdfPaper, marginPt: number): Uint8Array {
  const availW = page.wPt - 2 * marginPt;
  const availH = page.hPt - 2 * marginPt;
  const s = Math.min(availW / imgW, availH / imgH);
  const w = imgW * s;
  const h = imgH * s;
  const x = (page.wPt - w) / 2;
  const y = (page.hPt - h) / 2;
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offs: number[] = [];
  let len = 0;
  const push = (d: Uint8Array | string) => {
    const u = typeof d === "string" ? enc.encode(d) : d;
    chunks.push(u);
    len += u.length;
  };
  const obj = (n: number, body: string | Uint8Array[]) => {
    offs[n] = len;
    push(`${n} 0 obj\n`);
    if (typeof body === "string") push(body);
    else body.forEach((b) => push(b));
    push("\nendobj\n");
  };
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.wPt.toFixed(2)} ${page.hPt.toFixed(2)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
  obj(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(5, [
    enc.encode(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    enc.encode("\nendstream"),
  ]);
  const xref = len;
  let t = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) t += `${String(offs[i]).padStart(10, "0")} 00000 n \n`;
  t += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  push(t);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export type ExportOpts = {
  sectionHtml: string;
  sheetCss: string;
  colA: number; // px คอลัมน์วันที่
  colW: number; // px คอลัมน์อื่น (ค่าสูงสุด)
  /** คอลัมน์ (index) ที่คงความกว้างเดิมและให้ตัดบรรทัดได้ เช่น หมายเหตุ */
  keepCols?: number[];
  rowH: number; // px ความสูงแถวข้อมูลตอนพิมพ์ (ค่าเริ่มต้น จะคำนวณใหม่ให้เต็มหน้า)
  paper: "a4" | "legal";
  marginMm: number;
  fileName: string;
};

export async function downloadTablePdf(o: ExportOpts): Promise<void> {
  const fonts = await loadFontCss();
  const host = document.createElement("div");
  host.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  host.style.cssText = `position:fixed;left:-100000px;top:0;background:#fff`;
  host.innerHTML = o.sectionHtml;
  // ตัดสถานะหน้าจอ (เลือก/ซ้ำ/โฮเวอร์) ออก ให้เหลือเฉพาะเนื้อตาราง
  host.querySelectorAll("td").forEach((td) => td.classList.remove("sel", "dup", "e"));
  document.body.appendChild(host);
  const css = `${fonts}${o.sheetCss}
.sheet{font-family:'Sarabun',sans-serif}
.sheet td.d{padding:0 2px}
.sheet td.dup{outline:none}`;
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const table = host.querySelector("table") as HTMLTableElement;
    const probe = document.createElement("style");
    probe.textContent = css.replace(/url\([^)]*\)/g, "url()");
    host.prepend(probe);

    // 1) บีบความกว้างคอลัมน์ให้พอดีชื่อที่ยาวที่สุด (ชื่อเต็มไม่ตกบรรทัด) → ตัวหนังสือในหน้ากระดาษใหญ่ขึ้น
    const special = (t: string) => /[⚠→]|\(แทน/.test(t);
    const dcells = Array.from(table.querySelectorAll<HTMLElement>("tr.dr td.d"));
    const ruler = document.createElement("span");
    ruler.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
    host.appendChild(ruler);
    let maxText = 0;
    for (const td of dcells) {
      const tx = (td.textContent ?? "").trim();
      if (!tx || special(tx) || (o.keepCols ?? []).includes((td as HTMLTableCellElement).cellIndex)) continue;
      const cs = getComputedStyle(td);
      ruler.style.font = cs.font;
      ruler.textContent = tx;
      maxText = Math.max(maxText, ruler.getBoundingClientRect().width);
      td.style.whiteSpace = "nowrap";
    }
    ruler.remove();
    const colW = Math.max(90, Math.min(o.colW, Math.ceil(maxText) + 12));
    const cols = Array.from(table.querySelectorAll("col"));
    const keep = new Set(o.keepCols ?? []);
    const widths = cols.map((c, i) => (i === 0 ? o.colA : keep.has(i) ? parseFloat((c as HTMLElement).style.width) || colW : colW));
    cols.forEach((c, i) => ((c as HTMLElement).style.width = `${widths[i]}px`));
    const W = widths.reduce((a, b) => a + b, 0);
    table.style.width = `${W}px`;
    host.style.width = `${W}px`;

    // 2) ปรับความสูงแถวข้อมูลให้ตารางมีสัดส่วนเท่ากระดาษพอดี (เต็มหน้า)
    const nRows = table.querySelectorAll("tr.dr").length || 1;
    const pg = PAPER_PT[o.paper];
    const mPt = (o.marginMm / 25.4) * 72;
    const aspect = (pg.hPt - 2 * mPt) / (pg.wPt - 2 * mPt);
    const rowStyle = document.createElement("style");
    host.prepend(rowStyle);
    const setRow = (h: number) => (rowStyle.textContent = `.sheet tr.dr{height:${h}px !important}`);
    setRow(o.rowH);
    const fixedH = table.getBoundingClientRect().height - nRows * o.rowH;
    const rowH = Math.max(22, (W * aspect - fixedH) / nRows);
    setRow(rowH);
    const H = Math.ceil(table.getBoundingClientRect().height);
    probe.remove();

    // เผื่อขอบ: เส้นตารางแบบ border-collapse ล้นออกนอกความกว้างตาราง ~1px (ไม่เผื่อ = เส้นขวาสุด/ล่างสุดหาย)
    const PAD = 4;
    const SW = W + PAD * 2, SH = H + PAD * 2;
    const scale = Math.min(2.5, Math.sqrt(16_000_000 / (SW * SH)));
    const xml = new XMLSerializer().serializeToString(host);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><foreignObject width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="padding:${PAD}px;background:#fff"><style>${css.replace(/</g, "&lt;")}</style>${xml.replace(/^<div[^>]*>/, "<div>")}</div></foreignObject></svg>`;
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("วาดภาพตารางไม่สำเร็จ"));
      img.src = url;
    });
    const cv = document.createElement("canvas");
    cv.width = Math.round(SW * scale);
    cv.height = Math.round(SH * scale);
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const blob: Blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("สร้างภาพไม่สำเร็จ"))), "image/jpeg", 0.93));
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    const pdf = pdfFromJpeg(jpeg, cv.width, cv.height, PAPER_PT[o.paper], (o.marginMm / 25.4) * 72);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
    a.download = o.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  } finally {
    host.remove();
  }
}
