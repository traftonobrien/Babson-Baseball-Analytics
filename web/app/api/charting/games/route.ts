import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { chartingGames } from "@/db/schema";

export const runtime = "nodejs";

/** GET /api/charting/games — list all charting games, newest first. */
export async function GET() {
  try {
    const rows = await db
      .select()
      .from(chartingGames)
      .orderBy(desc(chartingGames.gameDate));

    return NextResponse.json({ games: rows });
  } catch (err) {
    console.error("charting/games GET:", err);
    return NextResponse.json(
      { error: "Failed to fetch charting games" },
      { status: 500 }
    );
  }
}

/** POST /api/charting/games — create a new charting game record. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { opponent, gameDate } = body as {
      opponent?: string;
      gameDate?: string;
    };

    if (!opponent?.trim()) {
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

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const [game] = await db
      .insert(chartingGames)
      .values({
        id,
        opponent: opponent.trim(),
        gameDate: gameDate.trim(),
        status: "draft",
        revision: 1,
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
    console.error("charting/games POST:", err);
    return NextResponse.json(
      { error: "Failed to create charting game" },
      { status: 500 }
    );
  }
}
