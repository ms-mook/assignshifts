// รหัสผ่านเดียวสำหรับผู้จัดตาราง — เก็บ session เป็น cookie ที่เซ็นด้วย HMAC (ใช้ได้ทั้ง Edge และ Node)
export const COOKIE = "shift_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 วัน

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

export async function verifySession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
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
