import { NextResponse } from "next/server";
import { getAllArsenal } from "@/lib/stuffPlusJson";

export async function GET() {
  try {
    const all = await getAllArsenal();

    const rows = all
      .filter((r) => r.pitchType !== "Other" && r.meanStuffPlus != null)
      .sort((a, b) => {
        if (a.playerSlug < b.playerSlug) return -1;
        if (a.playerSlug > b.playerSlug) return 1;
        if (a.pitchType < b.pitchType) return -1;
        if (a.pitchType > b.pitchType) return 1;
        return 0;
      })
      .map((r) => ({
        playerId: r.playerSlug,
        playerName: r.playerName,
        pitchType: r.pitchType,
        meanStuffPlus: r.meanStuffPlus,
        avgVeloMph: r.avgVeloMph,
        nSessions: r.nSessions,
      }));

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("stuff-plus leaderboard:", err);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
