import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";

const FIELD_LIMITS: Record<string, number> = {
  opponent: 100,
  babsonStartingPitcher: 100,
  opponentStartingPitcher: 100,
  ourTeamLabel: 100,
  opponentTeamLabel: 100,
  charter: 100,
  weather: 200,
  homeCatcher: 100,
  awayCatcher: 100,
  babsonRecord: 20,
  standing: 100,
  tomorrowStarter: 100,
  tomorrowOpponent: 100,
  notes: 1000,
};

function validateFieldLengths(
  body: Record<string, unknown>
): NextResponse | null {
  for (const [field, max] of Object.entries(FIELD_LIMITS)) {
    const val = body[field];
    if (typeof val === "string" && val.length > max) {
      return NextResponse.json(
        { error: `${field} must be ${max} characters or fewer` },
        { status: 400 }
      );
    }
  }
  return null;
}
import {
  chartingGames,
  chartingPitcherSegments,
  chartingLineupEntries,
  chartingPlateAppearances,
  chartingPitches,
} from "@/db/schema";
import { isValidGameStatus } from "@/lib/charting/domain";
import {
  isMissingPlateAppearanceContextColumnError,
  legacyChartingPlateAppearances,
} from "@/lib/charting/plateAppearanceStorage";
import {
  isMissingVelocityColumnError,
  legacyChartingPitches,
} from "@/lib/charting/pitchStorage";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";
import type { ChartingGameSnapshot } from "@/lib/charting/types";
import { CHARTING_GATE_CHAIN, requireRequestGates } from "@/lib/auth";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/charting/games/[id]
 * Returns a full ChartingGameSnapshot: game + segments + plateAppearances + pitches.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const unauthorized = requireRequestGates(req, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await params;

  try {
    const snapshot = await loadChartingGameSnapshot(id);
    if (!snapshot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(snapshot);
  } catch (err) {
    logApiError({
      route: `/api/charting/games/${id}`,
      method: "GET",
      status: 500,
      action: "fetch game",
      error: err,
      context: { gameId: id },
    });
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
  const unauthorized = requireRequestGates(req, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

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

      const lengthError = validateFieldLengths(
        gamePayload as Record<string, unknown>
      );
      if (lengthError) return lengthError;

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
        "babsonVenueSide",
        "babsonStartingPitcher",
        "opponentStartingPitcher",
        "ourTeamLabel",
        "opponentTeamLabel",
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

      // Pre-compute all row values so they can be referenced in both
      // the happy-path batch and any legacy-schema fallback batch.
      const segmentValues = segmentsPayload.map((s) => ({
        id: s.id,
        gameId: id,
        playerId: s.playerId,
        displayName: s.displayName,
        teamSide: s.teamSide ?? "our",
        segmentOrder: s.segmentOrder,
        enteredInning: s.enteredInning ?? null,
        exitedInning: s.exitedInning ?? null,
        runsOverride: s.runsOverride ?? null,
        earnedRunsOverride: s.earnedRunsOverride ?? null,
      }));

      const lineupValues = lineupPayload.map((e) => ({
        id: e.id,
        gameId: id,
        teamSide: e.teamSide ?? "opponent",
        lineupSlot: e.lineupSlot,
        hitterName: e.hitterName,
      }));

      const plateAppearanceValues = pasPayload.map((pa) => ({
        id: pa.id,
        gameId: id,
        segmentId: pa.segmentId,
        paOrder: pa.paOrder,
        inning: pa.inning,
        isTopInning: pa.isTopInning ?? true,
        teamSide: pa.teamSide ?? "opponent",
        hitterName: pa.hitterName,
        lineupSlot: pa.lineupSlot,
        resultCode: pa.resultCode ?? null,
        initialCount: pa.initialCount ?? "0-0",
        buntContext: pa.buntContext ?? false,
        runnerOnFirst: pa.runnerOnFirst ?? null,
        runnerOnSecond: pa.runnerOnSecond ?? null,
        runnerOnThird: pa.runnerOnThird ?? null,
      }));

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

      // db.transaction() is not supported by drizzle-orm/neon-http.
      // db.batch() sends all queries atomically via Neon's HTTP batch API.
      const happyPathBatch = [
        db.delete(chartingPitcherSegments).where(eq(chartingPitcherSegments.gameId, id)),
        ...(segmentsPayload.length > 0
          ? [db.insert(chartingPitcherSegments).values(segmentValues)]
          : []),
        db.delete(chartingLineupEntries).where(eq(chartingLineupEntries.gameId, id)),
        ...(lineupPayload.length > 0
          ? [db.insert(chartingLineupEntries).values(lineupValues)]
          : []),
        db.delete(chartingPlateAppearances).where(eq(chartingPlateAppearances.gameId, id)),
        ...(pasPayload.length > 0
          ? [db.insert(chartingPlateAppearances).values(plateAppearanceValues)]
          : []),
        db.delete(chartingPitches).where(eq(chartingPitches.gameId, id)),
        ...(pitchesPayload.length > 0
          ? [db.insert(chartingPitches).values(pitchValues)]
          : []),
      ] as const;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.batch(happyPathBatch as [any, ...any[]]);
      } catch (error) {
        if (isMissingPlateAppearanceContextColumnError(error)) {
          warnings.push(
            "Modern plate-appearance context could not be persisted because charting_plate_appearances is missing one or more context columns. Run migrations 0004_charting_pa_initial_count and 0006_charting_pa_context before relying on PA start state, inning half, and baserunner context in exports."
          );
          const legacyPaBatch = [
            db.delete(chartingPitcherSegments).where(eq(chartingPitcherSegments.gameId, id)),
            ...(segmentsPayload.length > 0
              ? [db.insert(chartingPitcherSegments).values(segmentValues)]
              : []),
            db.delete(chartingLineupEntries).where(eq(chartingLineupEntries.gameId, id)),
            ...(lineupPayload.length > 0
              ? [db.insert(chartingLineupEntries).values(lineupValues)]
              : []),
            db.delete(chartingPlateAppearances).where(eq(chartingPlateAppearances.gameId, id)),
            ...(pasPayload.length > 0
              ? [
                  db.insert(legacyChartingPlateAppearances).values(
                    plateAppearanceValues.map((pa) => ({
                      id: pa.id,
                      gameId: pa.gameId,
                      segmentId: pa.segmentId,
                      paOrder: pa.paOrder,
                      inning: pa.inning,
                      hitterName: pa.hitterName,
                      lineupSlot: pa.lineupSlot,
                      resultCode: pa.resultCode,
                      buntContext: pa.buntContext,
                    }))
                  ),
                ]
              : []),
            db.delete(chartingPitches).where(eq(chartingPitches.gameId, id)),
            ...(pitchesPayload.length > 0
              ? [db.insert(chartingPitches).values(pitchValues)]
              : []),
          ] as const;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.batch(legacyPaBatch as [any, ...any[]]);
        } else if (isMissingVelocityColumnError(error)) {
          warnings.push(
            "Velocity could not be persisted because the charting_pitches table is missing the velocity column. Run migration 0003_charting_pitch_velocity before exporting CSV velo."
          );
          const legacyPitchBatch = [
            db.delete(chartingPitcherSegments).where(eq(chartingPitcherSegments.gameId, id)),
            ...(segmentsPayload.length > 0
              ? [db.insert(chartingPitcherSegments).values(segmentValues)]
              : []),
            db.delete(chartingLineupEntries).where(eq(chartingLineupEntries.gameId, id)),
            ...(lineupPayload.length > 0
              ? [db.insert(chartingLineupEntries).values(lineupValues)]
              : []),
            db.delete(chartingPlateAppearances).where(eq(chartingPlateAppearances.gameId, id)),
            ...(pasPayload.length > 0
              ? [db.insert(chartingPlateAppearances).values(plateAppearanceValues)]
              : []),
            db.delete(chartingPitches).where(eq(chartingPitches.gameId, id)),
            ...(pitchesPayload.length > 0
              ? [
                  db.insert(legacyChartingPitches).values(
                    pitchValues.map((p) => ({
                      id: p.id,
                      gameId: p.gameId,
                      paId: p.paId,
                      pitchOrder: p.pitchOrder,
                      pitchType: p.pitchType,
                      locationCell: p.locationCell,
                      pitchResult: p.pitchResult,
                      ballsBefore: p.ballsBefore,
                      strikesBefore: p.strikesBefore,
                    }))
                  ),
                ]
              : []),
          ] as const;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.batch(legacyPitchBatch as [any, ...any[]]);
        } else {
          throw error;
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

    const lengthError = validateFieldLengths(body as Record<string, unknown>);
    if (lengthError) return lengthError;

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
      "babsonVenueSide",
      "babsonStartingPitcher",
      "opponentStartingPitcher",
      "ourTeamLabel",
      "opponentTeamLabel",
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
    logApiError({
      route: `/api/charting/games/${id}`,
      method: "PATCH",
      status: 500,
      action: "update game",
      error: err,
      context: { gameId: id },
    });
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
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const unauthorized = requireRequestGates(req, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

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
    logApiError({
      route: `/api/charting/games/${id}`,
      method: "DELETE",
      status: 500,
      action: "delete game",
      error: err,
      context: { gameId: id },
    });
    return NextResponse.json(
      { error: "Failed to delete charting game" },
      { status: 500 }
    );
  }
}
