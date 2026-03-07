import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chartingGames } from "@/db/schema";
import { isValidGameStatus } from "@/lib/charting/domain";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/charting/games/[id]
 * Returns a full ChartingGameSnapshot: game + segments + plateAppearances + pitches.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const snapshot = await loadChartingGameSnapshot(id);
    if (!snapshot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error(`charting/games/${id} GET:`, err);
    return NextResponse.json(
      { error: "Failed to fetch charting game" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/charting/games/[id]
 * Updates game metadata. Requires `revision` in the request body matching the
 * current stored revision (optimistic locking). Returns 409 on mismatch.
 *
 * Body shape (all fields optional except revision):
 * {
 *   revision: number,       // required — must match current DB revision
 *   opponent?: string,
 *   gameDate?: string,      // yyyy-mm-dd
 *   status?: "draft" | "active" | "final",
 *   charter?: string | null,
 *   weather?: string | null,
 *   homeCatcher?: string | null,
 *   awayCatcher?: string | null,
 *   babsonRecord?: string | null,
 *   standing?: string | null,
 *   tomorrowStarter?: string | null,
 *   tomorrowOpponent?: string | null,
 *   notes?: string | null,
 * }
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const body = await req.json();

    const clientRevision = body.revision;
    if (typeof clientRevision !== "number") {
      return NextResponse.json(
        { error: "revision (number) is required" },
        { status: 400 }
      );
    }

    if (body.status !== undefined && !isValidGameStatus(body.status)) {
      return NextResponse.json(
        { error: `Invalid status: ${body.status}` },
        { status: 400 }
      );
    }

    if (
      body.gameDate !== undefined &&
      !/^\d{4}-\d{2}-\d{2}$/.test(body.gameDate)
    ) {
      return NextResponse.json(
        { error: "gameDate must be in yyyy-mm-dd format" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Build the partial update, excluding revision and id from the body.
    const patch: Record<string, unknown> = { updatedAt: now };
    const allowed = [
      "opponent",
      "gameDate",
      "status",
      "charter",
      "weather",
      "homeCatcher",
      "awayCatcher",
      "babsonRecord",
      "standing",
      "tomorrowStarter",
      "tomorrowOpponent",
      "notes",
    ] as const;
    for (const key of allowed) {
      if (key in body) patch[key] = body[key];
    }

    // Atomic conditional update: only succeeds when revision matches.
    const updated = await db
      .update(chartingGames)
      .set({ ...patch, revision: clientRevision + 1 })
      .where(
        and(
          eq(chartingGames.id, id),
          eq(chartingGames.revision, clientRevision)
        )
      )
      .returning();

    if (updated.length === 0) {
      // Either the game does not exist or revision was stale.
      const [existing] = await db
        .select({ id: chartingGames.id })
        .from(chartingGames)
        .where(eq(chartingGames.id, id));

      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Stale revision — fetch the latest game and retry" },
        { status: 409 }
      );
    }

    return NextResponse.json({ game: updated[0] });
  } catch (err) {
    console.error(`charting/games/${id} PATCH:`, err);
    return NextResponse.json(
      { error: "Failed to update charting game" },
      { status: 500 }
    );
  }
}
