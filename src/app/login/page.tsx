"use client";
import { useState } from "react";

export default function LoginPage() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <h1>ระบบจัดตารางเวร</h1>
      <p>หน่วยเจาะเลือด เก็บสิ่งส่งตรวจและ POCT</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
          setBusy(false);
          if (!r.ok) return setErr((await r.json()).error ?? "เข้าสู่ระบบไม่สำเร็จ");
          const next = new URLSearchParams(location.search).get("next") ?? "/";
          location.href = next.startsWith("/") ? next : "/";
        }}
      >
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="รหัสผ่าน" autoFocus />
        <button type="submit" disabled={busy}>{busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
        {err && <div className="error">{err}</div>}
      </form>
    </div>
  );
}
