import { NextResponse, type NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  // Only protect /portal routes
  if (!req.nextUrl.pathname.startsWith("/portal")) {
    return NextResponse.next()
  }

  const hasSbCookie =
    req.cookies.get("sb-access-token") ||
    req.cookies.get("sb-refresh-token")

  if (!hasSbCookie) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("next", req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/portal/:path*"],
}