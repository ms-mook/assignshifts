import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, checkSession, createSession } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const { ok, renew } = await checkSession(req.cookies.get(COOKIE)?.value).catch(() => ({ ok: false, renew: false }));
  if (ok) {
    const res = NextResponse.next();
    if (renew) {
      // ยังใช้งานอยู่ → ต่ออายุอีก 3 ชั่วโมงนับจากตอนนี้
      const s = await createSession();
      res.cookies.set(COOKIE, s.value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: s.maxAge });
    }
    return res;
  }
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico|apple-icon).*)"],
};
