import { NextRequest, NextResponse } from "next/server";
import { getArsenal } from "@/lib/stuffPlusJson";

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  if (!playerId?.trim()) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  try {
    const pid = playerId.trim();
    const rows = await getArsenal(pid);

    const playerName = rows[0]?.playerName ?? null;
    const pitches = rows
      .filter((r) => r.pitchType !== "Other")
      .map((r) => ({
        pitchType: r.pitchType,
        meanStuffPlus: r.meanStuffPlus,
        avgVeloMph: r.avgVeloMph,
        maxFbVelo: r.maxFbVelo,
        avgExtFt: r.avgExtFt,
        nSessions: r.nSessions,
      }));

    return NextResponse.json({
      playerId: pid,
      playerName,
      pitches,
    });
  } catch (err) {
    console.error("stuff-plus arsenal:", err);
    return NextResponse.json({ error: "Failed to fetch arsenal" }, { status: 500 });
  }
}
