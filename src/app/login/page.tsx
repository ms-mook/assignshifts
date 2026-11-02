"use client";
import { useEffect, useState } from "react";

// หน้าเข้าสู่ระบบ — ธีมทางการ (ซ้าย: ข้อมูลหน่วยงาน · ขวา: แบบฟอร์ม)
export default function LoginPage() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(0);
  const [today, setToday] = useState("");
  useEffect(() => {
    try {
      setToday(new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    } catch {}
  }, []);

  const fail = (m: string) => {
    setErr(m);
    setShake((n) => n + 1);
    setBusy(false);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw) return fail("กรุณากรอกรหัสผ่าน");
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      if (!r.ok) return fail((await r.json().catch(() => ({}))).error ?? "เข้าสู่ระบบไม่สำเร็จ");
      const next = new URLSearchParams(location.search).get("next") ?? "/";
      location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch {
      fail("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  return (
    <div className="login-screen">
      <aside className="login-brand">
        <div className="login-org">
          <span className="login-mark" aria-hidden="true" />
          <span>หน่วยเจาะเลือด เก็บสิ่งส่งตรวจและ POCT</span>
        </div>
        <div className="login-hero">
          <h2>ระบบจัดตารางเวร</h2>
          <p>จัดตารางปฏิบัติงานรายเดือน บันทึกการลา/แลกเวร และพิมพ์เอกสารตารางเวรจากที่เดียว</p>
          <ul className="login-points">
            <li>ตาราง 3 ช่วงเวลา · Key · SMC · OT</li>
            <li>คำนวณตามสูตรเดียวกับ Google Sheet</li>
            <li>ส่งออก PDF ขนาด A4 หน้าเดียว</li>
          </ul>
        </div>
        <div className="login-copy">สำหรับผู้จัดตารางเวรเท่านั้น</div>
      </aside>
      <section className="login-panel">
        <div className="login-box">
          <h1>เข้าสู่ระบบ</h1>
          <p className="login-sub">กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน</p>
          <form key={shake} className={shake ? "login-form shake" : "login-form"} onSubmit={submit} noValidate>
            <label htmlFor="pw">รหัสผ่าน</label>
            <div className="pw-row">
              <input
                id="pw"
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                autoFocus
                autoComplete="current-password"
              />
              <button type="button" className="pw-eye" onClick={() => setShow((v) => !v)} aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                {show ? "ซ่อน" : "แสดง"}
              </button>
            </div>
            <button type="submit" className="primary start" disabled={busy}>
              {busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
            </button>
            {err && (
              <div className="login-err" role="alert">
                {err}
              </div>
            )}
          </form>
          <div className="login-foot">
            <span className="dot" aria-hidden="true" />
            {today || "พร้อมใช้งาน"}
          </div>
        </div>
      </section>
    </div>
  );
}
