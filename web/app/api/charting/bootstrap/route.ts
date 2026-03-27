import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { chartingDb as db } from "@/db";
import { chartingGames } from "@/db/schema";
import { buildBootstrapPitchers } from "@/lib/charting/bootstrapPitchers";
import { buildBootstrapRosterPlayers } from "@/lib/charting/bootstrapRoster";
import { CHARTING_GATE_CHAIN, requireRequestGates } from "@/lib/auth";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

/**
 * GET /api/charting/bootstrap
 * Returns the canonical Babson pitcher roster and the 10 most recent charting
 * games. Intended as the first request an iPad client makes after login.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireRequestGates(request, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const pitchers = await buildBootstrapPitchers();
    const rosterPlayers = buildBootstrapRosterPlayers();

    const recentGames = await db
      .select()
      .from(chartingGames)
      .orderBy(desc(chartingGames.gameDate))
      .limit(10);

    return NextResponse.json({ pitchers, rosterPlayers, recentGames });
  } catch (err) {
    logApiError({
      route: "/api/charting/bootstrap",
      method: "GET",
      status: 500,
      action: "load bootstrap data",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to load bootstrap data" },
      { status: 500 }
    );
  }
}
