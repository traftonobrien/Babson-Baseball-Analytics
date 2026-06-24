import { NextRequest, NextResponse } from "next/server";
import { SITE_GATE_CHAIN, requireRequestGates } from "@/lib/auth";
import {
  getPlayerAccountByEmail,
} from "@/lib/accounts/repository";
import { readAccountSessionEmail } from "@/lib/accounts/session";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = requireRequestGates(request, SITE_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  const email = readAccountSessionEmail(request.cookies);

  if (!email) {
    return NextResponse.json({ account: null, needsSetup: true });
  }

  try {
    const account = await getPlayerAccountByEmail(email);

    return NextResponse.json({
      account,
      needsSetup: account === null || account.playerId === null,
    });
  } catch (err) {
    logApiError({
      route: "/api/account/me",
      method: "GET",
      status: 500,
      action: "load current account",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to load account identity" },
      { status: 500 },
    );
  }
}
