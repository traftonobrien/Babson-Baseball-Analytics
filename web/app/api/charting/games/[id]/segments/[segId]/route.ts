import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { chartingDb as db } from "@/db";
import { chartingPitcherSegments } from "@/db/schema";
import { CHARTING_GATE_CHAIN, requireRequestGates } from "@/lib/auth";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; segId: string }> };

/**
 * PATCH /api/charting/games/[id]/segments/[segId]
 * Update mutable fields on a pitcher segment.
 *
 * Updatable fields:
 *   displayName, enteredInning, exitedInning, runsOverride, earnedRunsOverride
 *
 * segmentOrder and playerId are intentionally not updatable after creation.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const unauthorized = requireRequestGates(req, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  const { id, segId } = await params;

  try {
    const body = await req.json();

    const [existing] = await db
      .select({ id: chartingPitcherSegments.id })
      .from(chartingPitcherSegments)
      .where(
        and(
          eq(chartingPitcherSegments.id, segId),
          eq(chartingPitcherSegments.gameId, id)
        )
      );

    if (!existing) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};
    const allowed = [
      "displayName",
      "enteredInning",
      "exitedInning",
      "runsOverride",
      "earnedRunsOverride",
    ] as const;
    for (const key of allowed) {
      if (key in body) patch[key] = body[key];
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(chartingPitcherSegments)
      .set(patch)
      .where(eq(chartingPitcherSegments.id, segId))
      .returning();

    return NextResponse.json({ segment: updated });
  } catch (err) {
    logApiError({
      route: `/api/charting/games/${id}/segments/${segId}`,
      method: "PATCH",
      status: 500,
      action: "update segment",
      error: err,
      context: { gameId: id, segmentId: segId },
    });
    return NextResponse.json(
      { error: "Failed to update segment" },
      { status: 500 }
    );
  }
}
