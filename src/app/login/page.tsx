"use client";
import { useEffect, useState } from "react";

// หน้าเข้าสู่ระบบ — ธีมเกมยุค 16 บิต (ฉากกลางคืน ภูเขาพิกเซล และกล่องข้อความแบบ RPG)
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw) {
      setErr("กรุณาใส่รหัสผ่าน");
      setShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      if (!r.ok) {
        setErr((await r.json().catch(() => ({}))).error ?? "เข้าสู่ระบบไม่สำเร็จ");
        setShake((n) => n + 1);
        setBusy(false);
        return;
      }
      const next = new URLSearchParams(location.search).get("next") ?? "/";
      location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch {
      setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setShake((n) => n + 1);
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-sky" aria-hidden="true">
        <span className="moon" />
        <span className="hills far" />
        <span className="hills near" />
      </div>
      <div className="login-box">
        <div className="login-title">
          <div className="login-logo" aria-hidden="true">
            <span />
          </div>
          <div>
            <div className="login-kicker">SHIFT SCHEDULER</div>
            <h1>ระบบจัดตารางเวร</h1>
          </div>
        </div>
        <p className="login-sub">หน่วยเจาะเลือด เก็บสิ่งส่งตรวจและ POCT</p>
        <form key={shake} className={shake ? "login-form shake" : "login-form"} onSubmit={submit}>
          <label htmlFor="pw">รหัสผ่าน</label>
          <div className="pw-row">
            <input
              id="pw"
              type={show ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••"
              autoFocus
              autoComplete="current-password"
              inputMode="text"
            />
            <button type="button" className="pw-eye" onClick={() => setShow((v) => !v)} aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
              {show ? "ซ่อน" : "แสดง"}
            </button>
          </div>
          <button type="submit" className="primary start" disabled={busy}>
            {busy ? "กำลังตรวจสอบ…" : "▶ เข้าสู่ระบบ"}
          </button>
          {err && (
            <div className="login-err" role="alert">
              ✕ {err}
            </div>
          )}
        </form>
        <div className="login-foot">
          <span className="blink">●</span> {today || "พร้อมใช้งาน"}
        </div>
      </div>
    </div>
  );
}
