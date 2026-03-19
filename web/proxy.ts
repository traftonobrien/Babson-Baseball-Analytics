import { NextRequest, NextResponse } from "next/server";
import {
  buildGateFailureResponse,
  getRequiredGatesForPath,
  hasGateCookie,
} from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow Next.js internals and all public routes
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  for (const gateId of getRequiredGatesForPath(pathname)) {
    if (!hasGateCookie(request, gateId)) {
      return buildGateFailureResponse(request, gateId);
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
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
