import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSessionValue } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/observaciones/login")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (isValidSessionValue(cookie)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/observaciones/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/observaciones/:path*"],
};
