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
  "/mechanics-login",
  "/api/mechanics-login",
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

  // Mechanics pages require a separate password (remove this gate when ready to launch)
  if (pathname.startsWith("/mechanics")) {
    const mechanicsToken = request.cookies.get("pt_mechanics")?.value;
    if (mechanicsToken !== "authorized") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const gateUrl = request.nextUrl.clone();
      gateUrl.pathname = "/mechanics-login";
      gateUrl.search = "";
      return NextResponse.redirect(gateUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
