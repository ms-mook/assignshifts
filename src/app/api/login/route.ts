import { NextResponse } from "next/server";
import { COOKIE, checkPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!checkPassword(password ?? "")) return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  const s = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, s.value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: s.maxAge });
  return res;
}
