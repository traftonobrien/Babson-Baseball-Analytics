import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { normalizeAccountEmail } from "./identity";

export const PLAYER_ACCOUNT_SESSION_COOKIE = "pt_account_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

function getSessionSecret(): string {
  const secret =
    process.env.ACCOUNT_SESSION_SECRET?.trim() ||
    process.env.PT_PASSWORD?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "pitch-tracker-dev-account-session");

  if (!secret) {
    throw new Error("ACCOUNT_SESSION_SECRET is required for account sessions");
  }

  return secret;
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createAccountVerificationToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashAccountVerificationToken(token),
  };
}

export function hashAccountVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildAccountSessionCookieValue(email: string): string {
  const normalizedEmail = normalizeAccountEmail(email);
  if (!normalizedEmail) {
    throw new Error("Cannot build account session for invalid email");
  }

  const payload = base64Url(
    JSON.stringify({
      email: normalizedEmail,
      iat: Math.floor(Date.now() / 1000),
    }),
  );
  return `${payload}.${signPayload(payload)}`;
}

export function readAccountSessionEmail(cookies: CookieReader): string | null {
  const value = cookies.get(PLAYER_ACCOUNT_SESSION_COOKIE)?.value ?? "";
  const [payload, signature, ...rest] = value.split(".");
  if (!payload || !signature || rest.length > 0) {
    return null;
  }

  if (!safeEqual(signPayload(payload), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
    };
    return typeof parsed.email === "string" ? normalizeAccountEmail(parsed.email) : null;
  } catch {
    return null;
  }
}

export function setAccountSessionCookie(response: NextResponse, email: string): void {
  response.cookies.set(
    PLAYER_ACCOUNT_SESSION_COOKIE,
    buildAccountSessionCookieValue(email),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  );
}
