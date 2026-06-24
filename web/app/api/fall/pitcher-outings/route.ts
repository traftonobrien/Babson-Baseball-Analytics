import { NextRequest, NextResponse } from "next/server";
import { SITE_GATE_CHAIN, requireRequestGates } from "@/lib/auth";
import { getPlayerAccountFromRequest } from "@/lib/accounts/repository";
import {
  createFallPitcherOutingForAccount,
  listFallPitcherOutingsForAccount,
  type CreateFallPitcherOutingInput,
} from "@/lib/fall/pitcherOutings";
import type { FallPitcherOutingType } from "@/lib/fall/outingStats";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

const OUTING_TYPES = new Set<FallPitcherOutingType>([
  "bullpen",
  "live_ab",
  "intersquad",
  "scrimmage",
  "game",
  "other",
]);

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

function readInteger(body: Record<string, unknown>, key: string): number {
  const value = body[key];
  const numberValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(numberValue) ? Math.max(0, Math.trunc(numberValue)) : 0;
}

function readNullableNumber(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseCreateInput(body: unknown): CreateFallPitcherOutingInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const outingType = readString(record, "outingType") as FallPitcherOutingType;
  const outingDate = readString(record, "outingDate");

  if (!OUTING_TYPES.has(outingType) || !/^\d{4}-\d{2}-\d{2}$/.test(outingDate)) {
    return null;
  }

  return {
    outingType,
    outingDate,
    innings: readNullableNumber(record, "innings"),
    earnedRuns: readInteger(record, "earnedRuns"),
    strikeouts: readInteger(record, "strikeouts"),
    walks: readInteger(record, "walks"),
    hits: readInteger(record, "hits"),
    pitchTokens: readString(record, "pitchTokens"),
    resultTokens: readString(record, "resultTokens"),
    fpsTokens: readString(record, "fpsTokens"),
    notes: readString(record, "notes") || null,
  };
}

export async function GET(request: NextRequest) {
  const unauthorized = requireRequestGates(request, SITE_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const account = await getPlayerAccountFromRequest(request);
    if (!account?.playerId) {
      return NextResponse.json(
        { error: "Set your player identity before viewing fall outings" },
        { status: 409 },
      );
    }

    const outings = await listFallPitcherOutingsForAccount(account);
    return NextResponse.json({ outings });
  } catch (err) {
    logApiError({
      route: "/api/fall/pitcher-outings",
      method: "GET",
      status: 500,
      action: "list fall pitcher outings",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to load fall pitcher outings" },
      { status: 500 },
    );
  }
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

  const input = parseCreateInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "Provide a valid outing type and date" },
      { status: 400 },
    );
  }

  try {
    const account = await getPlayerAccountFromRequest(request);
    if (!account?.playerId) {
      return NextResponse.json(
        { error: "Set your player identity before logging fall outings" },
        { status: 409 },
      );
    }

    const outing = await createFallPitcherOutingForAccount({ account, input });
    return NextResponse.json({ outing }, { status: 201 });
  } catch (err) {
    logApiError({
      route: "/api/fall/pitcher-outings",
      method: "POST",
      status: 500,
      action: "create fall pitcher outing",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to save fall pitcher outing" },
      { status: 500 },
    );
  }
}
