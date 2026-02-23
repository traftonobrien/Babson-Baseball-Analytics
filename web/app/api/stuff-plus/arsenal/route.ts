import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stuffPlusArsenal } from "@/db/schema";

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  if (!playerId?.trim()) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  try {
    const rows = await db
      .select()
      .from(stuffPlusArsenal)
      .where(eq(stuffPlusArsenal.playerId, playerId.trim()));

    const playerName = rows[0]?.playerName ?? null;
    const pitches = rows.map((r) => ({
      pitchType: r.pitchType,
      meanStuffPlus: r.meanStuffPlus,
      avgVeloMph: r.avgVeloMph,
      maxFbVelo: r.maxFbVelo,
      avgExtFt: r.avgExtFt,
      nSessions: r.nSessions,
    }));

    return NextResponse.json({
      playerId: playerId.trim(),
      playerName,
      pitches,
    });
  } catch (err) {
    console.error("stuff-plus arsenal:", err);
    return NextResponse.json({ error: "Failed to fetch arsenal" }, { status: 500 });
  }
}
