import { NextResponse } from "next/server";
import { loadPlusLeaderboard } from "@/lib/server/plusLeaderboard";

export const runtime = "nodejs";

export async function GET() {
  try {
    const payload = await loadPlusLeaderboard(2026);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("plus-leaderboard:", err);
    return NextResponse.json(
      { error: "Failed to build plus leaderboard" },
      { status: 500 },
    );
  }
}
