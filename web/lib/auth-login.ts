import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkLoginRateLimit } from "@/lib/rateLimit";
import {
  type AuthGateId,
  buildAuthMisconfiguredMessage,
  buildGateLoginSuccessResponse,
  getConfiguredPassword,
} from "@/lib/auth-gates";

function readPasswordField(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("password" in body)) {
    return null;
  }

  const { password } = body;
  return typeof password === "string" ? password : null;
}

function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function handlePasswordGateLogin(
  request: NextRequest,
  gateId: AuthGateId,
): Promise<NextResponse> {
  const ip = getRequestIp(request);
  const { allowed } = await checkLoginRateLimit(ip, gateId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts — try again in 15 minutes" },
      {
        status: 429,
        headers: { "Retry-After": "900" },
      },
    );
  }

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

  const a = Buffer.from(password);
  const b = Buffer.from(configuredPassword);
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (!match) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  return buildGateLoginSuccessResponse(gateId);
}
