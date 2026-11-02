export default function Loading() {
  return (
    <div className="pageload" role="status">
      <span className="loading loading-ring loading-lg" />
      <div className="msg grad-text">กำลังโหลดตารางจาก Google Sheet… (รอสักครู่)</div>
      <div className="skel-row" />
      <div className="skel-row s" />
    </div>
  );
}
