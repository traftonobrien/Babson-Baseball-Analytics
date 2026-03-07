import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { chartingGames } from "@/db/schema";
import {
  CANONICAL_BY_PLAYER_ID,
  HAND_BY_PLAYER_ID,
} from "@/lib/canonicalPlayersData";

export const runtime = "nodejs";

/**
 * GET /api/charting/bootstrap
 * Returns the canonical Babson pitcher roster and the 10 most recent charting
 * games. Intended as the first request an iPad client makes after login.
 */
export async function GET() {
  try {
    const pitchers = Object.entries(CANONICAL_BY_PLAYER_ID)
      .map(([playerId, name]) => ({
        playerId,
        name,
        throws: HAND_BY_PLAYER_ID[playerId] ?? "R",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const recentGames = await db
      .select()
      .from(chartingGames)
      .orderBy(desc(chartingGames.gameDate))
      .limit(10);

    return NextResponse.json({ pitchers, recentGames });
  } catch (err) {
    console.error("charting/bootstrap GET:", err);
    return NextResponse.json(
      { error: "Failed to load bootstrap data" },
      { status: 500 }
    );
  }
}
