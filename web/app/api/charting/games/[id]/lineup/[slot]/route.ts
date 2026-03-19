import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chartingGames, chartingLineupEntries } from "@/db/schema";
import { CHARTING_GATE_CHAIN, requireRequestGates } from "@/lib/auth";
import { isValidLineupSlot } from "@/lib/charting/domain";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; slot: string }> };

/**
 * PATCH /api/charting/games/[id]/lineup/[slot]
 * Update the hitter name for a single lineup slot. Creates the entry if it
 * does not yet exist (upsert).
 *
 * Body: { hitterName: string }
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const unauthorized = requireRequestGates(req, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  const { id, slot: slotParam } = await params;
  const slot = parseInt(slotParam, 10);

  if (!isValidLineupSlot(slot)) {
    return NextResponse.json(
      { error: `Invalid slot: ${slotParam} (must be 1-9)` },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const hitterName: string = body.hitterName?.trim() ?? "";
    if (
      body.teamSide !== undefined &&
      body.teamSide !== "our" &&
      body.teamSide !== "opponent"
    ) {
      return NextResponse.json(
        { error: "teamSide must be either 'our' or 'opponent'" },
        { status: 400 }
      );
    }

    const teamSide = body.teamSide === "our" ? "our" : "opponent";

    if (!hitterName) {
      return NextResponse.json(
        { error: "hitterName must not be empty" },
        { status: 400 }
      );
    }

    const [game] = await db
      .select({ id: chartingGames.id })
      .from(chartingGames)
      .where(eq(chartingGames.id, id));

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Upsert: update if exists, insert if not
    const [existing] = await db
      .select({ id: chartingLineupEntries.id })
      .from(chartingLineupEntries)
      .where(
        and(
          eq(chartingLineupEntries.gameId, id),
          eq(chartingLineupEntries.teamSide, teamSide),
          eq(chartingLineupEntries.lineupSlot, slot)
        )
      );

    let entry: typeof chartingLineupEntries.$inferSelect;

    if (existing) {
      const [updated] = await db
        .update(chartingLineupEntries)
        .set({ hitterName })
        .where(eq(chartingLineupEntries.id, existing.id))
        .returning();
      entry = updated;
    } else {
      const [inserted] = await db
        .insert(chartingLineupEntries)
        .values({
          id: crypto.randomUUID(),
          gameId: id,
          teamSide,
          lineupSlot: slot,
          hitterName,
        })
        .returning();
      entry = inserted;
    }

    return NextResponse.json({ entry });
  } catch (err) {
    console.error(`charting/games/${id}/lineup/${slot} PATCH:`, err);
    return NextResponse.json(
      { error: "Failed to update lineup slot" },
      { status: 500 }
    );
  }
}
