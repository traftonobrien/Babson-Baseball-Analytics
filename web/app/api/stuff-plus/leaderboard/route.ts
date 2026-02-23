import { NextResponse } from "next/server";
import { asc, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { stuffPlusArsenal } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db
      .select({
        playerId: stuffPlusArsenal.playerId,
        playerName: stuffPlusArsenal.playerName,
        pitchType: stuffPlusArsenal.pitchType,
        meanStuffPlus: stuffPlusArsenal.meanStuffPlus,
        avgVeloMph: stuffPlusArsenal.avgVeloMph,
        nSessions: stuffPlusArsenal.nSessions,
      })
      .from(stuffPlusArsenal)
      .where(isNotNull(stuffPlusArsenal.meanStuffPlus))
      .orderBy(asc(stuffPlusArsenal.playerId), asc(stuffPlusArsenal.pitchType));

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("stuff-plus leaderboard:", err);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
