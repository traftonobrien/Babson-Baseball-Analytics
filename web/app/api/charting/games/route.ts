import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { chartingDb as db } from "@/db";
import { chartingGames } from "@/db/schema";
import { CHARTING_GATE_CHAIN, requireRequestGates } from "@/lib/auth";
import { logApiError } from "@/lib/server/logger";
import { FALL_SESSION_TYPES } from "@/lib/charting/fallSessionTypes";

const ALL_VALID_SESSION_TYPES = new Set<string>(["game", "live_ab", ...FALL_SESSION_TYPES]);

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

export const runtime = "nodejs";

/** GET /api/charting/games — list all charting games, newest first. */
export async function GET(request: NextRequest) {
  const unauthorized = requireRequestGates(request, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const rows = await db
      .select()
      .from(chartingGames)
      .orderBy(desc(chartingGames.gameDate));

    return NextResponse.json({ games: rows });
  } catch (err) {
    logApiError({
      route: "/api/charting/games",
      method: "GET",
      status: 500,
      action: "list games",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to fetch charting games" },
      { status: 500 }
    );
  }
}

/** POST /api/charting/games — create a new charting game record. */
export async function POST(request: NextRequest) {
  const unauthorized = requireRequestGates(request, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = await request.json();

    const {
      opponent,
      gameDate,
      sessionType,
      babsonVenueSide,
      babsonStartingPitcher,
      opponentStartingPitcher,
      ourTeamLabel,
      opponentTeamLabel,
    } = body as {
      opponent?: string;
      gameDate?: string;
      sessionType?: string;
      babsonVenueSide?: string;
      babsonStartingPitcher?: string | null;
      opponentStartingPitcher?: string | null;
      ourTeamLabel?: string | null;
      opponentTeamLabel?: string | null;
    };

    const isFallSession = sessionType?.startsWith("fall_") ?? false;

    // opponent required for game/live_ab, optional for fall sessions
    if (!isFallSession && !opponent?.trim()) {
      return NextResponse.json(
        { error: "opponent is required" },
        { status: 400 }
      );
    }
    if (!gameDate?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(gameDate.trim())) {
      return NextResponse.json(
        { error: "gameDate is required in yyyy-mm-dd format" },
        { status: 400 }
      );
    }

    const lengthError = validateFieldLengths(body as Record<string, unknown>);
    if (lengthError) return lengthError;

    const resolvedSessionType = ALL_VALID_SESSION_TYPES.has(sessionType ?? "")
      ? (sessionType as string)
      : "live_ab";
    const resolvedOpponent = opponent?.trim() || (isFallSession ? "Fall Practice" : "");

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const [game] = await db
      .insert(chartingGames)
      .values({
        id,
        opponent: resolvedOpponent,
        gameDate: gameDate.trim(),
        status: "draft",
        revision: 1,
        sessionType: resolvedSessionType,
        babsonVenueSide: babsonVenueSide === "away" ? "away" : "home",
        babsonStartingPitcher: babsonStartingPitcher?.trim() || null,
        opponentStartingPitcher: opponentStartingPitcher?.trim() || null,
        ourTeamLabel:
          resolvedSessionType === "game" ? (ourTeamLabel?.trim() || "Babson") : null,
        opponentTeamLabel:
          resolvedSessionType === "game"
            ? (opponentTeamLabel?.trim() || resolvedOpponent)
            : null,
        charter: body.charter ?? null,
        weather: body.weather ?? null,
        homeCatcher: body.homeCatcher ?? null,
        awayCatcher: body.awayCatcher ?? null,
        babsonRecord: body.babsonRecord ?? null,
        standing: body.standing ?? null,
        tomorrowStarter: body.tomorrowStarter ?? null,
        tomorrowOpponent: body.tomorrowOpponent ?? null,
        notes: body.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ game }, { status: 201 });
  } catch (err) {
    logApiError({
      route: "/api/charting/games",
      method: "POST",
      status: 500,
      action: "create game",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to create charting game" },
      { status: 500 }
    );
  }
}
