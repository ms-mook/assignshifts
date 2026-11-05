// หน้าตาราง Key (จุดลงทะเบียน)
import { shiftYm, monthTabName } from "@/lib/config";
import { computeKeyMonth } from "@/lib/key/engine";
import { loadKey, loadKeyMonthState } from "@/lib/key/repo";
import { KEY_COL_W, KEY_CSS, keyDupCols, renderKeyHtml } from "@/lib/key/render";
import { SHEET_CSS } from "@/lib/shift3/render";
import type { TableDef } from "@/lib/tables";
import { syncAllLeaves } from "@/lib/leave-sync";
import { loadKeyBookingGuide } from "@/lib/key/booking";
import ScheduleView from "@/components/ScheduleView";

const todaySerial = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000) + 25569;
};

export default async function KeySchedule({ tdef, ym, yearBE, month }: { tdef: TableDef; ym: string; yearBE: number; month: number }) {
  await syncAllLeaves(ym); // การลาที่ Approve ในระบบลา เฉพาะเดือนนี้ → ทั้ง 4 ชีต (ดึงซ้ำไม่เกินนาทีละครั้ง)
  const s = await loadKey();
  const st = await loadKeyMonthState(s, yearBE, month);
  const res = computeKeyMonth(s, st.manual, yearBE, month);
  const html = `<style>${KEY_CSS}</style>` + renderKeyHtml(res, s, { editable: true, styles: st.styles, personColors: st.personColors, today: todaySerial() });
  const dupDays = res.rows.filter((r) => r.date !== null && keyDupCols(r.cells).size > 0).map((r) => r.day);
  const names = Array.from(new Set([...s.dropdown, ...s.heads, "MT full-time", "ลา"].filter((n) => n.trim() !== "")));
  // ไกด์ชื่อจากระบบจองเวร (จุดลงทะเบียนรายการตรวจ · ช่วงเช้า) — แสดงข้างรายชื่อในป๊อปอัป ช่องตำแหน่ง Key
  const guide = await loadKeyBookingGuide(yearBE, month, [...s.dropdown, ...s.rot, ...s.heads, s.key4Name, s.head]);
  const c = res.checks;
  const checkText =
    c.status === "✓ ปกติ"
      ? ""
      : `ตรวจสอบตาราง: ชื่อซ้ำ ${c.dup} · ตำแหน่งว่าง/ลายังไม่มีผู้แทน ${c.vacancy} · มีชื่อในวันหยุด ${c.onHoliday} · ชื่อไม่อยู่ในรายชื่อ ${c.unknown}`;
  return (
    <ScheduleView
      table={tdef.id}
      tableTitle={tdef.title}
      ym={ym}
      prevYm={shiftYm(yearBE, month, -1)}
      nextYm={shiftYm(yearBE, month, 1)}
      label={res.subtitle}
      tabName={monthTabName(yearBE, month)}
      manualSource={st.hasTab ? "month-tab" : "web-tab"}
      sectionHtml={html}
      names={names}
      personColors={st.personColors}
      manual={Object.fromEntries(Object.entries(st.manual).map(([k, v]) => [`k:${k}`, v]))}
      cellStyles={st.styles}
      dupDays={dupDays}
      summary={[{ title: "สรุปวันทำงานเดือนนี้", rows: res.dayCounts }]}
      warning={checkText}
      api="/api/key"
      officerCols={[]}
      guide={guide}
      hint="ช่องที่แก้เอง/พิมพ์ทับเก็บในแท็บ WEB-ช่องเลือกเอง (ไม่แตะสูตรในแท็บเดือน) · คนลา/ผู้แทน ให้บันทึกที่หน้า ลา-แลกเวร (Key)"
      pdf={{ colA: KEY_COL_W[0], colW: 125, keepCols: [15], sheetCss: SHEET_CSS + KEY_CSS }}
    />
  );
}
