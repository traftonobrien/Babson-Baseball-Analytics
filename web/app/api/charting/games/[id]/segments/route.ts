import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { chartingDb as db } from "@/db";
import { chartingGames, chartingPitcherSegments } from "@/db/schema";
import { CHARTING_GATE_CHAIN, requireRequestGates } from "@/lib/auth";
import { nextSegmentOrder } from "@/lib/charting/domain";
import { CANONICAL_BY_PLAYER_ID } from "@/lib/canonicalPlayersData";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/charting/games/[id]/segments
 * Add a Babson pitcher to the game. segmentOrder is assigned automatically
 * as max(existing) + 1 so callers cannot accidentally create ordering gaps.
 *
 * Body: {
 *   playerId: string,        // canonical Babson player ID, e.g. "DJames1"
 *   displayName?: string,    // defaults to canonical name from roster
 *   enteredInning?: number,
 * }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const unauthorized = requireRequestGates(req, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await params;

  try {
    const [game] = await db
      .select({ id: chartingGames.id })
      .from(chartingGames)
      .where(eq(chartingGames.id, id));

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const body = await req.json();
    const playerId: string = body.playerId?.trim() ?? "";

    if (!playerId) {
      return NextResponse.json(
        { error: "playerId is required" },
        { status: 400 }
      );
    }

    const canonicalName = CANONICAL_BY_PLAYER_ID[playerId];
    if (!canonicalName) {
      return NextResponse.json(
        { error: `Unknown playerId: ${playerId}` },
        { status: 400 }
      );
    }

    const displayName: string =
      (body.displayName?.trim() ?? canonicalName);

    // Compute next order atomically
    const existing = await db
      .select({ segmentOrder: chartingPitcherSegments.segmentOrder })
      .from(chartingPitcherSegments)
      .where(eq(chartingPitcherSegments.gameId, id))
      .orderBy(asc(chartingPitcherSegments.segmentOrder));

    const segmentOrder = nextSegmentOrder(existing);

    const [segment] = await db
      .insert(chartingPitcherSegments)
      .values({
        id: crypto.randomUUID(),
        gameId: id,
        playerId,
        displayName,
        segmentOrder,
        enteredInning: body.enteredInning ?? null,
        exitedInning: null,
        runsOverride: null,
        earnedRunsOverride: null,
      })
      .returning();

    return NextResponse.json({ segment }, { status: 201 });
  } catch (err) {
    logApiError({
      route: `/api/charting/games/${id}/segments`,
      method: "POST",
      status: 500,
      action: "create segment",
      error: err,
      context: { gameId: id },
    });
    return NextResponse.json(
      { error: "Failed to add pitcher segment" },
      { status: 500 }
    );
  }
}
