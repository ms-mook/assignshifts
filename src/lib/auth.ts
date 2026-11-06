// รหัสผ่านเดียวสำหรับผู้จัดตาราง — เก็บ session เป็น cookie ที่เซ็นด้วย HMAC (ใช้ได้ทั้ง Edge และ Node)
export const COOKIE = "shift_session";
// ออกจากระบบอัตโนมัติเมื่อไม่ได้ใช้งานครบ 3 ชั่วโมง (ผู้ใช้กำหนด 6 พ.ย. 69 — กันเปิดค้างแล้วลืมปิด)
// ระหว่างที่ยังใช้งานอยู่ ต่ออายุให้อัตโนมัติ (ดู middleware)
export const MAX_AGE = 60 * 60 * 3;
/** ต่ออายุเมื่อใช้ไปแล้วเกิน 5 นาที (ไม่ต้องเซ็นคุกกี้ใหม่ทุกคำขอ) */
const RENEW_AFTER = 60 * 5;

async function hmac(data: string): Promise<string> {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 16) throw new Error("SESSION_SECRET ต้องยาวอย่างน้อย 16 ตัวอักษร");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  return { value: `${exp}.${await hmac(String(exp))}`, maxAge: MAX_AGE };
}

/** ตรวจ session · คืนค่าว่าควรต่ออายุหรือไม่ */
export async function checkSession(value: string | undefined): Promise<{ ok: boolean; renew: boolean }> {
  const ok = await verifySession(value);
  if (!ok) return { ok, renew: false };
  const left = Number(value!.split(".")[0]) - Date.now() / 1000;
  return { ok, renew: left < MAX_AGE - RENEW_AFTER };
}

export async function verifySession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  const now = Date.now() / 1000;
  if (!exp || !sig || Number(exp) < now) return false;
  // คุกกี้รุ่นเก่า (อายุ 14 วัน) ใช้ไม่ได้แล้ว ต้องเข้าสู่ระบบใหม่
  if (Number(exp) - now > MAX_AGE + 60) return false;
  const expect = await hmac(exp);
  if (expect.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function checkPassword(input: string): boolean {
  const pw = process.env.APP_PASSWORD ?? "";
  if (pw === "") return false;
  if (input.length !== pw.length) return false;
  let diff = 0;
  for (let i = 0; i < pw.length; i++) diff |= pw.charCodeAt(i) ^ input.charCodeAt(i);
  return diff === 0;
}
