// ทดสอบอายุ session: หมดอายุเมื่อไม่ได้ใช้งาน 3 ชั่วโมง · ต่ออายุระหว่างใช้งาน · คุกกี้ 14 วันรุ่นเก่าใช้ไม่ได้
// รัน: npx tsx scripts/test-auth.ts
declare const process: any;
process.env.SESSION_SECRET = "test-secret-1234567890";
import { MAX_AGE, checkSession, createSession, verifySession } from "../src/lib/auth";
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => (c ? pass++ : (fail++, console.log("  ✗ " + m)));
const realNow = Date.now;
const at = (sec: number) => (Date.now = () => realNow() + sec * 1000);
(async () => {
  at(0);
  const s = await createSession();
  ok(s.maxAge === 3 * 3600 && MAX_AGE === 3 * 3600, "อายุคุกกี้ 3 ชั่วโมง");
  ok(await verifySession(s.value), "เพิ่งเข้าสู่ระบบ ใช้ได้");
  ok(!(await checkSession(s.value)).renew, "เพิ่งเข้าสู่ระบบ ยังไม่ต้องต่ออายุ");
  at(10 * 60);
  ok((await checkSession(s.value)).renew, "ใช้งานไป 10 นาที → ต่ออายุ");
  at(2 * 3600 + 59 * 60);
  ok(await verifySession(s.value), "ไม่ได้ใช้งาน 2 ชม. 59 นาที ยังใช้ได้");
  at(3 * 3600 + 1);
  ok(!(await verifySession(s.value)), "ไม่ได้ใช้งานเกิน 3 ชั่วโมง → หมดอายุ");
  // ใช้งานต่อเนื่อง: ต่ออายุทุก 1 ชม. ตลอด 8 ชม. ไม่หลุด
  at(0);
  let cur = (await createSession()).value, alive = true;
  for (let h = 1; h <= 8; h++) {
    at(h * 3600);
    const c = await checkSession(cur);
    if (!c.ok) alive = false;
    if (c.renew) cur = (await createSession()).value;
  }
  ok(alive, "ใช้งานต่อเนื่อง 8 ชั่วโมง ไม่ถูกเด้งออก");
  // คุกกี้รุ่นเก่า 14 วัน
  at(0);
  const exp = Math.floor(Date.now() / 1000) + 14 * 86400;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(process.env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(exp)))), (b) => b.toString(16).padStart(2, "0")).join("");
  ok(!(await verifySession(`${exp}.${sig}`)), "คุกกี้ 14 วันรุ่นเก่า ต้องเข้าสู่ระบบใหม่");
  ok(!(await verifySession(`${exp}.bad`)), "ลายเซ็นปลอม ใช้ไม่ได้");
  ok(!(await verifySession(undefined)), "ไม่มีคุกกี้ ใช้ไม่ได้");
  Date.now = realNow;
  console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
  if (fail) process.exit(1);
})();
