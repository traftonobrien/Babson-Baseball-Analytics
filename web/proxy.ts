import { NextRequest, NextResponse } from "next/server";

/**
 * Public paths that never require authentication.
 * /players/*  — Player profile pages (public)
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/login",
  "/api/logout",
  "/players",
  "/mechanics-login",
  "/api/mechanics-login",
  "/api/charting",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ],
};
