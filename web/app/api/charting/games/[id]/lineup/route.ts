import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chartingGames, chartingLineupEntries } from "@/db/schema";
import { isValidLineupSlot } from "@/lib/charting/domain";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/charting/games/[id]/lineup — return the opponent lineup. */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const lineup = await db
      .select()
      .from(chartingLineupEntries)
      .where(eq(chartingLineupEntries.gameId, id))
      .orderBy(asc(chartingLineupEntries.lineupSlot));

    return NextResponse.json({ lineup });
  } catch (err) {
    console.error(`charting/games/${id}/lineup GET:`, err);
    return NextResponse.json(
      { error: "Failed to fetch lineup" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/charting/games/[id]/lineup
 * Idempotent full lineup replace. Accepts an array of up to 9 entries.
 *
 * Body: { entries: Array<{ lineupSlot: number; hitterName: string }> }
 *
 * All existing entries for this game are deleted and replaced. lineupSlot
 * must be an integer 1-9.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
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
    const entries: Array<{ lineupSlot: number; hitterName: string }> =
      body.entries ?? [];

    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { error: "entries must be an array" },
        { status: 400 }
      );
    }
    if (entries.length > 9) {
      return NextResponse.json(
        { error: "lineup cannot have more than 9 slots" },
        { status: 400 }
      );
    }

    for (const e of entries) {
      if (!isValidLineupSlot(e.lineupSlot)) {
        return NextResponse.json(
          { error: `Invalid lineupSlot: ${e.lineupSlot} (must be 1-9)` },
          { status: 400 }
        );
      }
      if (!e.hitterName?.trim()) {
        return NextResponse.json(
          { error: "hitterName must not be empty" },
          { status: 400 }
        );
      }
    }

    // Check for duplicate slots
    const slots = entries.map((e) => e.lineupSlot);
    if (new Set(slots).size !== slots.length) {
      return NextResponse.json(
        { error: "Duplicate lineupSlot values" },
        { status: 400 }
      );
    }

    // Delete existing and insert new entries in a transaction-like sequence
    await db
      .delete(chartingLineupEntries)
      .where(eq(chartingLineupEntries.gameId, id));

    let lineup: typeof chartingLineupEntries.$inferSelect[] = [];
    if (entries.length > 0) {
      lineup = await db
        .insert(chartingLineupEntries)
        .values(
          entries.map((e) => ({
            id: crypto.randomUUID(),
            gameId: id,
            lineupSlot: e.lineupSlot,
            hitterName: e.hitterName.trim(),
          }))
        )
        .returning();
      lineup.sort((a, b) => a.lineupSlot - b.lineupSlot);
    }

    return NextResponse.json({ lineup });
  } catch (err) {
    console.error(`charting/games/${id}/lineup PUT:`, err);
    return NextResponse.json(
      { error: "Failed to update lineup" },
      { status: 500 }
    );
  }
}
