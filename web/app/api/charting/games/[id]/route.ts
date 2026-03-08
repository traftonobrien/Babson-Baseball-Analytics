import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  chartingGames,
  chartingPitcherSegments,
  chartingLineupEntries,
  chartingPlateAppearances,
  chartingPitches,
} from "@/db/schema";
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
 *
 * Accepts either:
 *   1. A simple metadata update (legacy): { revision, opponent?, status?, ... }
 *   2. A full ChartingGameSnapshot sync from the iPad app:
 *      { game: {...}, segments: [...], lineup: [...], plateAppearances: [...], pitches: [...], revision }
 *
 * In both cases `revision` (number) is required for optimistic locking.
 * When the snapshot form is detected (body.game exists), the handler replaces
 * all relational children for this game inside a single transaction.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const body = await req.json();

    // ---------------------------------------------------------------
    // Detect snapshot sync vs. simple metadata update
    // ---------------------------------------------------------------
    const isSnapshotSync = body.game !== undefined;

    // Resolve revision from either body.revision or body.game.revision
    const clientRevision: number | undefined = isSnapshotSync
      ? body.game?.revision ?? body.revision
      : body.revision;

    if (typeof clientRevision !== "number") {
      return NextResponse.json(
        { error: "revision (number) is required" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------
    // Snapshot sync — full game payload from iPad SyncQueueManager
    // ---------------------------------------------------------------
    if (isSnapshotSync) {
      const gamePayload = body.game;
      const segmentsPayload: unknown[] = body.segments ?? [];
      const lineupPayload: unknown[] = body.lineup ?? [];
      const pasPayload: unknown[] = body.plateAppearances ?? [];
      const pitchesPayload: unknown[] = body.pitches ?? [];

      // Validate status if present
      if (
        gamePayload.status !== undefined &&
        !isValidGameStatus(gamePayload.status)
      ) {
        return NextResponse.json(
          { error: `Invalid status: ${gamePayload.status}` },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();

      // Run everything in a transaction for atomicity
      const result = await db.transaction(async (tx) => {
        // 1. Conditional update on the game row (optimistic lock)
        const gamePatch: Record<string, unknown> = { updatedAt: now };
        const gameFields = [
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
        for (const key of gameFields) {
          if (key in gamePayload) gamePatch[key] = gamePayload[key];
        }

        const updated = await tx
          .update(chartingGames)
          .set({ ...gamePatch, revision: clientRevision + 1 })
          .where(
            and(
              eq(chartingGames.id, id),
              eq(chartingGames.revision, clientRevision)
            )
          )
          .returning();

        if (updated.length === 0) {
          return { conflict: true };
        }

        // 2. Replace segments
        await tx
          .delete(chartingPitcherSegments)
          .where(eq(chartingPitcherSegments.gameId, id));

        if (segmentsPayload.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await tx.insert(chartingPitcherSegments).values(
            segmentsPayload.map((s: any) => ({
              id: s.id,
              gameId: id,
              playerId: s.playerId,
              displayName: s.displayName,
              segmentOrder: s.segmentOrder,
              enteredInning: s.enteredInning ?? null,
              exitedInning: s.exitedInning ?? null,
              runsOverride: s.runsOverride ?? null,
              earnedRunsOverride: s.earnedRunsOverride ?? null,
            }))
          );
        }

        // 3. Replace lineup
        await tx
          .delete(chartingLineupEntries)
          .where(eq(chartingLineupEntries.gameId, id));

        if (lineupPayload.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await tx.insert(chartingLineupEntries).values(
            lineupPayload.map((e: any) => ({
              id: e.id,
              gameId: id,
              lineupSlot: e.lineupSlot,
              hitterName: e.hitterName,
            }))
          );
        }

        // 4. Replace plate appearances
        await tx
          .delete(chartingPlateAppearances)
          .where(eq(chartingPlateAppearances.gameId, id));

        if (pasPayload.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await tx.insert(chartingPlateAppearances).values(
            pasPayload.map((pa: any) => ({
              id: pa.id,
              gameId: id,
              segmentId: pa.segmentId,
              paOrder: pa.paOrder,
              inning: pa.inning,
              hitterName: pa.hitterName,
              lineupSlot: pa.lineupSlot,
              resultCode: pa.resultCode ?? null,
              buntContext: pa.buntContext ?? false,
            }))
          );
        }

        // 5. Replace pitches (including velocity)
        await tx
          .delete(chartingPitches)
          .where(eq(chartingPitches.gameId, id));

        if (pitchesPayload.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await tx.insert(chartingPitches).values(
            pitchesPayload.map((p: any) => ({
              id: p.id,
              gameId: id,
              paId: p.paId,
              pitchOrder: p.pitchOrder,
              pitchType: p.pitchType,
              locationCell: p.locationCell ?? null,
              pitchResult: p.pitchResult,
              ballsBefore: p.ballsBefore,
              strikesBefore: p.strikesBefore,
              velocity: p.velocity ?? null,
            }))
          );
        }

        return { conflict: false, game: updated[0] };
      });

      if (result.conflict) {
        // Check existence vs. stale revision
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

      return NextResponse.json({ game: result.game });
    }

    // ---------------------------------------------------------------
    // Simple metadata-only update (legacy / non-snapshot)
    // ---------------------------------------------------------------

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
