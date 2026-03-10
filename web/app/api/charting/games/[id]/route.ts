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
import {
  isMissingInitialCountColumnError,
  legacyChartingPlateAppearances,
} from "@/lib/charting/plateAppearanceStorage";
import {
  isMissingVelocityColumnError,
  legacyChartingPitches,
} from "@/lib/charting/pitchStorage";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";
import type { ChartingGameSnapshot } from "@/lib/charting/types";

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
      const snapshotBody = body as {
        game: Partial<ChartingGameSnapshot["game"]>;
        segments?: ChartingGameSnapshot["segments"];
        lineup?: ChartingGameSnapshot["lineup"];
        plateAppearances?: ChartingGameSnapshot["plateAppearances"];
        pitches?: ChartingGameSnapshot["pitches"];
        revision?: number;
      };
      const gamePayload = snapshotBody.game;
      const segmentsPayload = snapshotBody.segments ?? [];
      const lineupPayload = snapshotBody.lineup ?? [];
      const pasPayload = snapshotBody.plateAppearances ?? [];
      const pitchesPayload = snapshotBody.pitches ?? [];
      const warnings: string[] = [];

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

      const updated = await db
        .update(chartingGames)
        .set({ ...gamePatch, revision: clientRevision + 1 })
        .where(
          and(
            eq(chartingGames.id, id),
            eq(chartingGames.revision, clientRevision)
          )
        )
        .returning();

      const result =
        updated.length === 0
          ? { conflict: true as const, game: null }
          : { conflict: false as const, game: updated[0] };

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

      await db
        .delete(chartingPitcherSegments)
        .where(eq(chartingPitcherSegments.gameId, id));

      if (segmentsPayload.length > 0) {
        await db.insert(chartingPitcherSegments).values(
          segmentsPayload.map((s) => ({
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

      await db
        .delete(chartingLineupEntries)
        .where(eq(chartingLineupEntries.gameId, id));

      if (lineupPayload.length > 0) {
        await db.insert(chartingLineupEntries).values(
          lineupPayload.map((e) => ({
            id: e.id,
            gameId: id,
            lineupSlot: e.lineupSlot,
            hitterName: e.hitterName,
          }))
        );
      }

      await db
        .delete(chartingPlateAppearances)
        .where(eq(chartingPlateAppearances.gameId, id));

      if (pasPayload.length > 0) {
        const plateAppearanceValues = pasPayload.map((pa) => ({
          id: pa.id,
          gameId: id,
          segmentId: pa.segmentId,
          paOrder: pa.paOrder,
          inning: pa.inning,
          hitterName: pa.hitterName,
          lineupSlot: pa.lineupSlot,
          resultCode: pa.resultCode ?? null,
          initialCount: pa.initialCount ?? "0-0",
          buntContext: pa.buntContext ?? false,
        }));

        try {
          await db.insert(chartingPlateAppearances).values(plateAppearanceValues);
        } catch (error) {
          if (!isMissingInitialCountColumnError(error)) {
            throw error;
          }

          warnings.push(
            "Initial count could not be persisted because the charting_plate_appearances table is missing the initial_count column. Run migration 0004_charting_pa_initial_count before relying on PA start state in CSV exports."
          );

          await db.insert(legacyChartingPlateAppearances).values(
            plateAppearanceValues.map((plateAppearance) => ({
              id: plateAppearance.id,
              gameId: plateAppearance.gameId,
              segmentId: plateAppearance.segmentId,
              paOrder: plateAppearance.paOrder,
              inning: plateAppearance.inning,
              hitterName: plateAppearance.hitterName,
              lineupSlot: plateAppearance.lineupSlot,
              resultCode: plateAppearance.resultCode,
              buntContext: plateAppearance.buntContext,
            }))
          );
        }
      }

      await db
        .delete(chartingPitches)
        .where(eq(chartingPitches.gameId, id));

      if (pitchesPayload.length > 0) {
        const pitchValues = pitchesPayload.map((p) => ({
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
        }));

        try {
          await db.insert(chartingPitches).values(pitchValues);
        } catch (error) {
          if (!isMissingVelocityColumnError(error)) {
            throw error;
          }

          warnings.push(
            "Velocity could not be persisted because the charting_pitches table is missing the velocity column. Run migration 0003_charting_pitch_velocity before exporting CSV velo."
          );

          await db.insert(legacyChartingPitches).values(
            pitchValues.map((pitch) => ({
              id: pitch.id,
              gameId: pitch.gameId,
              paId: pitch.paId,
              pitchOrder: pitch.pitchOrder,
              pitchType: pitch.pitchType,
              locationCell: pitch.locationCell,
              pitchResult: pitch.pitchResult,
              ballsBefore: pitch.ballsBefore,
              strikesBefore: pitch.strikesBefore,
            }))
          );
        }
      }

      return NextResponse.json({ game: result.game, warnings });
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

/**
 * DELETE /api/charting/games/[id]
 * Permanently removes a charting game and all child rows.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const [existing] = await db
      .select({ id: chartingGames.id })
      .from(chartingGames)
      .where(eq(chartingGames.id, id));

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .delete(chartingPitches)
      .where(eq(chartingPitches.gameId, id));

    await db
      .delete(chartingPlateAppearances)
      .where(eq(chartingPlateAppearances.gameId, id));

    await db
      .delete(chartingLineupEntries)
      .where(eq(chartingLineupEntries.gameId, id));

    await db
      .delete(chartingPitcherSegments)
      .where(eq(chartingPitcherSegments.gameId, id));

    await db
      .delete(chartingGames)
      .where(eq(chartingGames.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`charting/games/${id} DELETE:`, err);
    return NextResponse.json(
      { error: "Failed to delete charting game" },
      { status: 500 }
    );
  }
}
