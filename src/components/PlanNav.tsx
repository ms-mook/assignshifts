// แถบเลื่อนช่วงของหน้าแผน/สรุป (ลิงก์ล้วน ใช้ได้ทั้ง server component)
import Link from "next/link";
import Icon from "./Icon";

export function WeeksNav({ base, n, current }: { base: string; n: number; current: number }) {
  return (
    <div className="plan-nav">
      <span className="badge badge-soft badge-primary">แสดงสัปดาห์ที่ 1–{n}</span>
      {current > 0 && current <= n && (
        <a className="btn btn-sm btn-soft btn-accent" href="#week-now">
          <Icon name="CalendarCheck" size={14} /> ไปสัปดาห์นี้ (สัปดาห์ที่ {current})
        </a>
      )}
      <Link className="btn btn-sm btn-ghost" href={`${base}?weeks=${n + 26}`} scroll={false}>
        <Icon name="Plus" size={14} /> แสดงเพิ่มอีก 26 สัปดาห์
      </Link>
      <span className="muted small">ช่วงที่แสดงเลื่อนตามวันที่ปัจจุบันเอง (ต่อไปอีก 1 ปีเสมอ)</span>
    </div>
  );
}

export function MonthsNav({ base, from, label }: { base: string; from: { y: number; m: number }; label: string }) {
  const ym = (k: number) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;
  const k = from.y * 12 + from.m - 1;
  return (
    <div className="plan-nav">
      <Link className="btn btn-sm" href={`${base}?from=${ym(k - 12)}`}>
        <Icon name="ChevronLeft" size={14} /> 12 เดือนก่อน
      </Link>
      <span className="badge badge-soft badge-primary">{label}</span>
      <Link className="btn btn-sm" href={`${base}?from=${ym(k + 12)}`}>
        12 เดือนถัดไป <Icon name="ChevronRight" size={14} />
      </Link>
      <Link className="btn btn-sm btn-ghost" href={base}>
        <Icon name="CalendarCheck" size={14} /> ช่วงปัจจุบัน
      </Link>
    </div>
  );
}
