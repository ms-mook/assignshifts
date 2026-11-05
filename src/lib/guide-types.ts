// ไกด์ชื่อในป๊อปอัปเลือกชื่อ (เช่น จากระบบจองเวร) — ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และหน้าเว็บ
export interface GuideItem {
  /** ชื่อที่จะใส่ลงตาราง (จับคู่กับรายชื่อในตารางแล้ว) */
  name: string;
  /** ชื่อ-นามสกุลตามระบบจอง */
  booked: string;
  /** ช่วงเวลาที่จอง */
  slot?: string;
  /** หมายเหตุการจับคู่ชื่อ */
  note?: string;
}
export interface BookingGuide {
  /** คอลัมน์ที่แสดงไกด์ */
  cols: string[];
  title: string;
  /** วันที่ (1–31) → รายชื่อที่จอง */
  byDay: Record<number, GuideItem[]>;
  error?: string;
}
