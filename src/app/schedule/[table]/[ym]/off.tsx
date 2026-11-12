// หน้า ตารางเวรนอกเวลา (เสาร์-อาทิตย์ ห้องเจาะเลือด OPD/SMC + นอกเวลา จ.-ศ. OPD)
import { shiftYm } from "@/lib/config";
import { OFF_ROW_GROUPS, offDupDays, offLeaveHits, offNamesByCol, offSummary } from "@/lib/off/engine";
import { loadOffBookingGuide } from "@/lib/off/booking";
import { loadOffLeaves, loadOffMonth } from "@/lib/off/repo";
import { OFF_COL_W, OFF_CSS, renderOffHtml } from "@/lib/off/render";
import { SHEET_CSS } from "@/lib/shift3/render";
import type { TableDef } from "@/lib/tables";
import ScheduleView from "@/components/ScheduleView";

const todaySerial = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000) + 25569;
};

/** ชื่อจุดของแต่ละคอลัมน์ (แถว 6 ของแท็บเดือน) */
const label = (head: Record<string, string>, c: string) => head[`${c}6`] ?? c;

export default async function OffSchedule({ tdef, ym, yearBE, month }: { tdef: TableDef; ym: string; yearBE: number; month: number }) {
  const [st, lv] = await Promise.all([loadOffMonth(yearBE, month), loadOffLeaves()]);
  const mo = st.month;
  const html = `<style>${OFF_CSS}</style>` + renderOffHtml(mo, { editable: st.hasTab, styles: st.styles, personColors: st.personColors, leaves: lv.leaves, today: todaySerial() });
  const byCol = offNamesByCol(st.lists);
  const names = Array.from(new Set(Object.values(byCol).flat()));
  const guide = await loadOffBookingGuide(yearBE, month, names);
  const hits = offLeaveHits(mo, lv.leaves);
  const summary = offSummary(mo, st.lists).filter((g) => g.rows.length > 0);
  const colLabels = Object.fromEntries("CDEFGHIJKLMNOPQRSTUVWYZ".split("").map((c) => [c, label(mo.head, c)]));
  const warn: string[] = [];
  if (!st.hasTab) warn.push("ชีตไม่มีแท็บของเดือนนี้ (ตารางนี้ครอบคลุม ธ.ค. 69 – พ.ย. 70)");
  if (lv.error) warn.push(`อ่านระบบลาไม่สำเร็จ (ไม่ได้ตรวจวันงดเวรนอกเวลา): ${lv.error}`);
  if (hits.length > 0)
    warn.push(
      `งดเวรนอกเวลา (ระบบลา) แต่มีชื่อในตาราง ${hits.length} ช่อง — วันที่ ${Array.from(new Set(hits.map((h) => h.day))).join(", ")} (ช่องสีส้มขีดฆ่า)`,
    );
  return (
    <ScheduleView
      table={tdef.id}
      tableTitle={tdef.title}
      ym={ym}
      prevYm={shiftYm(yearBE, month, -1)}
      nextYm={shiftYm(yearBE, month, 1)}
      label={mo.head.A2 ?? ""}
      tabName={st.tab ?? ""}
      manualSource="web-tab"
      sectionHtml={html}
      names={names}
      namesByCol={byCol}
      personColors={st.personColors}
      manual={Object.fromEntries(Object.entries(st.manual).map(([k, v]) => [`w:${k}`, v]))}
      cellStyles={st.styles}
      dupDays={offDupDays(mo)}
      rowGroups={OFF_ROW_GROUPS}
      dupNote="พนักงาน 1 คนอยู่ได้ 1 จุดต่อวัน"
      summary={summary}
      warning={warn.join(" · ")}
      api="/api/off"
      officerCols={[]}
      colLabels={colLabels}
      guide={guide}
      hint={
        "Key 4, Key 5, ช่อง 9, เก็บ 1, เก็บ 2, บัตรคิว, เก็บ SMC (ส.-อา.) บันทึกลงแท็บ ตารางเวร ส-อา ในชีตโดยตรง · ช่องที่เป็นสูตรหมุนเวรเก็บในแท็บ WEB-ช่องเลือกเอง (ไม่แตะสูตร) · คืนค่าสูตร = กลับไปใช้ค่าจากชีต · " +
        "1 คนอยู่ได้ 1 จุดต่อวัน (กรอบแดง = ซ้ำ) · ชมพู = ชื่อซ้ำในคอลัมน์เดียวกันทั้งเดือน (กฎของชีต) · ส้มขีดฆ่า = งดเวรนอกเวลาวันนั้น (ระบบลา)"
      }
      pdf={{ colA: OFF_COL_W[0], colW: 110, keepCols: [1, 23], sheetCss: SHEET_CSS + OFF_CSS }}
    />
  );
}
