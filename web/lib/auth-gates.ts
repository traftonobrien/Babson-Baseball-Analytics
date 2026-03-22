import { NextRequest, NextResponse } from "next/server";

export type AuthGateId = "site" | "mechanics";

type AuthGateConfig = Readonly<{
  cookieName: string;
  cookieValue: string;
  passwordEnvName: string;
  loginPath: string;
  apiLoginPath: string;
}>;

const LEGACY_CHARTING_COOKIE_NAME = "pt_charting";
const LEGACY_CHARTING_LOGIN_PATH = "/charting-login";
const LEGACY_CHARTING_API_LOGIN_PATH = "/api/charting-login";

export const AUTH_GATE_IDS = ["site", "mechanics"] as const;
export const SITE_GATE_CHAIN = ["site"] as const satisfies readonly AuthGateId[];
export const CHARTING_GATE_CHAIN = SITE_GATE_CHAIN;
export const MECHANICS_GATE_CHAIN = ["site", "mechanics"] as const satisfies readonly AuthGateId[];

export const AUTH_GATES = {
  site: {
    cookieName: "pt_auth",
    cookieValue: "authenticated",
    passwordEnvName: "PT_PASSWORD",
    loginPath: "/login",
    apiLoginPath: "/api/login",
  },
  mechanics: {
    cookieName: "pt_mechanics",
    cookieValue: "authorized",
    passwordEnvName: "MECHANICS_PASSWORD",
    loginPath: "/mechanics-login",
    apiLoginPath: "/api/mechanics-login",
  },
} as const satisfies Record<AuthGateId, AuthGateConfig>;

const PUBLIC_PREFIXES = [
  AUTH_GATES.site.loginPath,
  AUTH_GATES.site.apiLoginPath,
  "/api/logout",
  "/players",
  LEGACY_CHARTING_LOGIN_PATH,
  LEGACY_CHARTING_API_LOGIN_PATH,
  AUTH_GATES.mechanics.loginPath,
  AUTH_GATES.mechanics.apiLoginPath,
] as const;

type CookieCarrier = {
  cookies: {
    get(name: string): { value: string } | undefined;
  };
};

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveConfiguredPassword(rawValue: string | undefined): string | null {
  const password = rawValue?.trim();
  return password ? password : null;
}

export function getConfiguredPassword(gateId: AuthGateId): string | null {
  return resolveConfiguredPassword(process.env[AUTH_GATES[gateId].passwordEnvName]);
}

export function buildAuthMisconfiguredMessage(gateId: AuthGateId): string {
  return `Server auth misconfigured: missing ${AUTH_GATES[gateId].passwordEnvName}`;
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
}

export function isChartingPath(pathname: string): boolean {
  return (
    matchesPathPrefix(pathname, "/charting") ||
    matchesPathPrefix(pathname, "/api/charting")
  );
}

export function isMechanicsPath(pathname: string): boolean {
  return matchesPathPrefix(pathname, "/mechanics");
}

export function getRequiredGatesForPath(pathname: string): readonly AuthGateId[] {
  if (isPublicPath(pathname)) {
    return [];
  }
  if (isChartingPath(pathname)) {
    return SITE_GATE_CHAIN;
  }
  if (isMechanicsPath(pathname)) {
    return MECHANICS_GATE_CHAIN;
  }
  return SITE_GATE_CHAIN;
}

export function hasGateCookie(
  requestLike: CookieCarrier,
  gateId: AuthGateId,
): boolean {
  const gate = AUTH_GATES[gateId];
  return requestLike.cookies.get(gate.cookieName)?.value === gate.cookieValue;
}

export function unauthorizedApiResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function buildGateFailureResponse(
  request: NextRequest,
  gateId: AuthGateId,
): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return unauthorizedApiResponse();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = AUTH_GATES[gateId].loginPath;
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}

export function requireRequestGates(
  request: NextRequest,
  gateIds: readonly AuthGateId[],
): NextResponse | null {
  for (const gateId of gateIds) {
    if (!hasGateCookie(request, gateId)) {
      return unauthorizedApiResponse();
    }
  }
  return null;
}

export function buildGateLoginSuccessResponse(gateId: AuthGateId): NextResponse {
  const gate = AUTH_GATES[gateId];
  const response = NextResponse.json({ ok: true });
  response.cookies.set(gate.cookieName, gate.cookieValue, gateCookieOptions());
  return response;
}

function gateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 7200, // 2 hours
  };
}

export function clearAllGateCookies(response: NextResponse): void {
  for (const gateId of AUTH_GATE_IDS) {
    response.cookies.set(AUTH_GATES[gateId].cookieName, "", {
      ...gateCookieOptions(),
      maxAge: 0,
    });
  }
  response.cookies.set(LEGACY_CHARTING_COOKIE_NAME, "", {
    ...gateCookieOptions(),
    maxAge: 0,
  });
}
