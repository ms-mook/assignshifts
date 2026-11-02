"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

/** สรุป!B2 (ตั้งแต่สัปดาห์ที่เริ่ม) และ B3 (ถึงสัปดาห์ที่เริ่ม) */
export default function OtSummaryRange({ from, to, api = "/api/ot/summary" }: { from: string; to: string; api?: string }) {
  const [a, setA] = useState(from);
  const [b, setB] = useState(to);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    const t = toast.loading("กำลังบันทึกช่วงสรุป…");
    try {
      const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: a, to: b }) });
      if (!r.ok) t.error((await r.json().catch(() => ({}))).error ?? "บันทึกไม่สำเร็จ");
      else {
        t.success("บันทึกช่วงสรุปแล้ว");
        router.refresh();
      }
    } catch {
      t.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  };
  return (
    <p>
      ตั้งแต่สัปดาห์ที่เริ่ม <span className="cellref">B2</span> <input className="y" type="date" value={a} onChange={(e) => setA(e.target.value)} />{" "}
      ถึงสัปดาห์ที่เริ่ม <span className="cellref">B3</span> <input className="y" type="date" value={b} onChange={(e) => setB(e.target.value)} />{" "}
      <button disabled={busy || (a === from && b === to)} onClick={save}>บันทึกช่วง</button>
    </p>
  );
}
