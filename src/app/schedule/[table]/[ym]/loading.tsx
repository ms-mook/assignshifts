export default function Loading() {
  return (
    <div className="pageload" role="status">
      <span className="spin big" />
      <div>กำลังโหลดตารางจาก Google Sheet… (รอสักครู่)</div>
    </div>
  );
}
