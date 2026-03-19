import { NextRequest, NextResponse } from "next/server";

export type AuthGateId = "site" | "charting" | "mechanics";

type AuthGateConfig = Readonly<{
  cookieName: string;
  cookieValue: string;
  passwordEnvName: string;
  loginPath: string;
  apiLoginPath: string;
}>;

export const AUTH_GATE_IDS = ["site", "charting", "mechanics"] as const;
export const SITE_GATE_CHAIN = ["site"] as const satisfies readonly AuthGateId[];
export const CHARTING_GATE_CHAIN = ["site", "charting"] as const satisfies readonly AuthGateId[];
export const MECHANICS_GATE_CHAIN = ["site", "mechanics"] as const satisfies readonly AuthGateId[];

export const AUTH_GATES = {
  site: {
    cookieName: "pt_auth",
    cookieValue: "authenticated",
    passwordEnvName: "PT_PASSWORD",
    loginPath: "/login",
    apiLoginPath: "/api/login",
  },
  charting: {
    cookieName: "pt_charting",
    cookieValue: "authorized",
    passwordEnvName: "CHARTING_PASSWORD",
    loginPath: "/charting-login",
    apiLoginPath: "/api/charting-login",
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
  AUTH_GATES.charting.loginPath,
  AUTH_GATES.charting.apiLoginPath,
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

function readPasswordField(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("password" in body)) {
    return null;
  }

  const { password } = body;
  return typeof password === "string" ? password : null;
}

function gateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 604800, // 7 days
  };
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
    return CHARTING_GATE_CHAIN;
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

export function clearAllGateCookies(response: NextResponse): void {
  for (const gateId of AUTH_GATE_IDS) {
    response.cookies.set(AUTH_GATES[gateId].cookieName, "", {
      ...gateCookieOptions(),
      maxAge: 0,
    });
  }
}

export async function handlePasswordGateLogin(
  request: NextRequest,
  gateId: AuthGateId,
): Promise<NextResponse> {
  const configuredPassword = getConfiguredPassword(gateId);
  if (!configuredPassword) {
    return NextResponse.json(
      { error: buildAuthMisconfiguredMessage(gateId) },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body" },
      { status: 400 },
    );
  }

  const password = readPasswordField(body);
  if (password === null) {
    return NextResponse.json(
      { error: "password is required" },
      { status: 400 },
    );
  }

  if (password !== configuredPassword) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  return buildGateLoginSuccessResponse(gateId);
}
