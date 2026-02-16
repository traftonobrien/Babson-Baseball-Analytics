import { NextRequest, NextResponse } from "next/server";

/**
 * Public paths that never require authentication.
 * /api/d3db/* — D3 Dashboard proxy (public, server-keyed)
 * /players/*  — Player profile pages (public)
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/login",
  "/api/logout",
  "/api/d3db",
  "/players",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Fast-path: D3 proxy is always public
  if (pathname.startsWith("/api/d3db")) {
    return NextResponse.next();
  }

  // Allow Next.js internals and all public routes
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("pt_auth")?.value;
  if (token !== "authenticated") {
    // API routes get 401 JSON, never a redirect to /login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
