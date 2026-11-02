"use client";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";

const FEATURES: { tone: string; icon: IconName; title: string; text: string }[] = [
  { tone: "s1", icon: "Sunrise", title: "6.00-8.30", text: "เวรเช้ามืด" },
  { tone: "s2", icon: "Sun", title: "8.30-12.30", text: "เวรช่วงเช้า" },
  { tone: "s3", icon: "Sunset", title: "12.30-16.30", text: "เวรช่วงบ่าย" },
  { tone: "key", icon: "KeyRound", title: "Key", text: "ตาราง Key" },
  { tone: "smc", icon: "Stethoscope", title: "SMC", text: "ตาราง SMC" },
  { tone: "ot", icon: "Timer", title: "OT", text: "ตาราง OT" },
];

// หน้าเข้าสู่ระบบ — daisyUI + glassmorphism (ซ้าย: ข้อมูลระบบ · ขวา: แบบฟอร์ม)
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
          <span className="brand-mark" aria-hidden="true">
            <Icon name="CalendarDays" size={24} />
          </span>
          <span>หน่วยเจาะเลือด เก็บสิ่งส่งตรวจและ POCT</span>
        </div>
        <div className="login-hero">
          <h2>
            ระบบจัด<span className="grad-text">ตารางเวร</span>
          </h2>
          <p>จัดตารางปฏิบัติงานรายเดือน บันทึกการลา/แลกเวร และดาวน์โหลดตารางเป็น PDF ขนาด A4 หน้าเดียว — คำนวณตามสูตรเดียวกับ Google Sheet</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.tone} className={`feature tone-${f.tone}`}>
              <span className="fi">
                <Icon name={f.icon} size={20} />
              </span>
              <b>{f.title}</b>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </aside>
      <section className="login-panel">
        <div className="orbit" aria-hidden="true">
          <i style={{ ["--r" as string]: "260px", ["--t" as string]: "38s", ["--d" as string]: "0s", background: "linear-gradient(135deg,#a8643a,#c48a5f)" }}><Icon name="Syringe" size={20} /></i>
          <i style={{ ["--r" as string]: "260px", ["--t" as string]: "38s", ["--d" as string]: "-12.6s", background: "linear-gradient(135deg,#2f6694,#5a8cb8)" }}><Icon name="TestTubeDiagonal" size={20} /></i>
          <i style={{ ["--r" as string]: "260px", ["--t" as string]: "38s", ["--d" as string]: "-25.3s", background: "linear-gradient(135deg,#2f7660,#5a9a84)" }}><Icon name="HeartPulse" size={20} /></i>
        </div>
        <div className="login-box">
          <span className="login-lock">
            <Icon name="LockKeyhole" size={28} />
          </span>
          <h1>เข้าสู่ระบบ</h1>
          <p className="login-sub">กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน</p>
          <form key={shake} className={shake ? "login-form shake" : "login-form"} onSubmit={submit} noValidate>
            <label className="input input-lg w-full" htmlFor="pw">
              <Icon name="ShieldCheck" size={20} className="opacity-60" />
              <input
                id="pw"
                className="grow"
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="รหัสผ่าน"
                aria-label="รหัสผ่าน"
                autoFocus
                autoComplete="current-password"
              />
              <button type="button" className="btn btn-ghost btn-circle btn-sm" onClick={() => setShow((v) => !v)} aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} title={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                <Icon name={show ? "EyeOff" : "Eye"} size={18} />
              </button>
            </label>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-sm" /> : <Icon name="Sparkles" size={20} />}
              {busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
            </button>
            {err && (
              <div className="alert alert-error alert-soft" role="alert">
                <Icon name="TriangleAlert" size={18} />
                <span>{err}</span>
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
