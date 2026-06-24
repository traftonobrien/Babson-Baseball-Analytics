import { NextRequest, NextResponse } from "next/server";
import { SITE_GATE_CHAIN, requireRequestGates } from "@/lib/auth";
import { buildBootstrapRosterPlayers } from "@/lib/charting/bootstrapRoster";
import { buildPlayerAccountIdentity } from "@/lib/accounts/identity";
import {
  PLAYER_ACCOUNT_EMAIL_COOKIE,
  getPlayerAccountFromRequest,
  upsertPlayerAccountIdentity,
} from "@/lib/accounts/repository";
import { setAccountSessionCookie } from "@/lib/accounts/session";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

function readStringField(body: unknown, field: string): string | null {
  if (typeof body !== "object" || body === null || !(field in body)) {
    return null;
  }

  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function accountCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export async function POST(request: NextRequest) {
  const unauthorized = requireRequestGates(request, SITE_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const playerId = readStringField(body, "playerId");

  if (!playerId) {
    return NextResponse.json(
      { error: "playerId is required" },
      { status: 400 },
    );
  }

  const rosterPlayer =
    buildBootstrapRosterPlayers().find((player) => player.playerId === playerId) ??
    null;

  if (!rosterPlayer) {
    return NextResponse.json(
      { error: "Select a valid Babson roster player" },
      { status: 400 },
    );
  }

  try {
    const verifiedAccount = await getPlayerAccountFromRequest(request);
    if (!verifiedAccount) {
      return NextResponse.json(
        { error: "Confirm your email before selecting a player" },
        { status: 401 },
      );
    }

    const identity = buildPlayerAccountIdentity({
      email: verifiedAccount.email,
      rosterPlayer,
    });
    if (!identity) {
      return NextResponse.json(
        { error: "Use a valid Babson email address" },
        { status: 400 },
      );
    }

    const account = await upsertPlayerAccountIdentity(identity);
    const response = NextResponse.json({ account, needsSetup: false });
    response.cookies.set(
      PLAYER_ACCOUNT_EMAIL_COOKIE,
      account.email,
      accountCookieOptions(),
    );
    setAccountSessionCookie(response, account.email);
    return response;
  } catch (err) {
    logApiError({
      route: "/api/account/identity",
      method: "POST",
      status: 500,
      action: "save account identity",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to save account identity" },
      { status: 500 },
    );
  }
}
