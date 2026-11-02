# เว็บจัดตารางเวร — หน่วยเจาะเลือด เก็บสิ่งส่งตรวจและ POCT

Next.js (App Router) · Google Sheet เป็นฐานข้อมูลเหมือนเดิม · deploy บน Vercel

## ขั้นที่ 1 (ชุดนี้)
- ตาราง **6.00-8.30 / 8.30-12.30 / 12.30-16.30** (ชีต FM-CL-05-002-00) — คำนวณด้วยสูตรเดียวกับชีตทุกขั้น
  (`src/lib/shift3/engine.ts` มีสูตรต้นฉบับกำกับทุกจุด)
- หน้าตาราง 3 ส่วน: หัวตาราง/สี/ความกว้างคอลัมน์/merge ตามชีต ม.ค.70, กฎสี (⚠ ลา, แทน, → ไปช่วยจุดอื่น, แถววันหยุดสีเทา)
- คลิกช่อง จนท. / เวชกรรมสังคม / SHE เพื่อเลือกชื่อ (บันทึกลงแท็บเดือนในชีต หรือแท็บ `WEB-ช่องเลือกเอง` ถ้ายังไม่มีแท็บเดือน)
- หน้า **ตั้งค่า** รวม (เขียนกลับเฉพาะช่องกรอกของชีต ตั้งค่า / รายชื่อ MT-RN — ไม่แตะช่องสูตร)
- หน้า **ลา-แลกเวร**
- พิมพ์ / บันทึก PDF ขนาด **Legal แนวนอน** ตารางละ 1 หน้า (เลือกพิมพ์ทีละส่วนได้)

ยังไม่รวม: ตาราง Key / SMC / OT (ขั้นถัดไป), เมนู Apps Script (สร้างเดือนถัดไป, สลับเวียน ฯลฯ)

## ตรวจความถูกต้องเทียบกับชีต
`fixtures/shift3-sheet.json` = ค่าจริงที่ export จากชีต (แผนรายสัปดาห์ 58 สัปดาห์ + ฟอร์ม ธ.ค.69 – พ.ย.70 + สรุป)

```bash
npm run verify:shift3   # เทียบทุกช่อง (46,870 รายการ) ต้องได้ "ตรงกับชีต 100%"
npm run test:shift3     # กรณีลา / คนแทน / เลือกช่อง จนท. / วันหยุด / ลาออก
```

## ติดตั้งครั้งแรก
1. **Service Account**: Google Cloud Console → สร้างโปรเจกต์ → เปิด *Google Sheets API* → สร้าง Service Account → สร้าง key (JSON)
2. **แชร์ชีต** ทั้ง 4 ไฟล์ให้อีเมล Service Account เป็น *ผู้แก้ไข*
3. **GitHub**: สร้าง repo ใหม่ แล้ว push โฟลเดอร์นี้
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
4. **Vercel**: Import repo → ตั้ง Environment Variables ตาม `.env.example`
   (`APP_PASSWORD`, `SESSION_SECRET`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) → Deploy

รันในเครื่อง: `cp .env.example .env.local` แล้วกรอกค่า → `npm install` → `npm run dev`

## โครงสร้าง
```
src/lib/sheets-date.ts      วันที่แบบ serial ของ Google Sheets, WEEKDAY, EOMONTH
src/lib/shift3/engine.ts    สูตร แผนรายสัปดาห์ + ฟอร์มเดือน + ลา-แลกเวร
src/lib/shift3/parse.ts     แปลงค่าจากชีต → ข้อมูล (ตำแหน่งเซลล์ตรงกับชีต)
src/lib/shift3/layout.ts    หัวตาราง/สี/ขนาด จากชีต ม.ค.70
src/lib/shift3/render.ts    สร้าง HTML ตาราง + กฎสี
src/lib/shift3/repo.ts      อ่าน/เขียน Google Sheet
src/app/...                 หน้าเว็บ + API
```

## หมายเหตุ
- แผนรายสัปดาห์ในชีตมีสูตรถึงสัปดาห์ 58 (3 ม.ค. 2028) เว็บคำนวณต่อไปได้เรื่อยๆ เท่ากับ "ลากสูตรลงไป" ตามวิธีใช้ข้อ 8
- หัวตารางส่วนที่ 2 ช่อง B:Q (แถว 45) ในชีตไม่มีข้อความ — เว็บคงไว้ตามชีต
