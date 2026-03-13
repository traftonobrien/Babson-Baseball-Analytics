import { NextRequest, NextResponse } from "next/server";
import { getOutings } from "@/lib/stuffPlusJson";

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  const date = request.nextUrl.searchParams.get("date");
  if (!playerId?.trim()) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  try {
    const pid = playerId.trim();
    const rows = await getOutings(pid, date);

    const points = rows
      .filter((r) => r.stuffPlus != null && r.pitchType !== "Other")
      .map((r) => ({
        date: r.date,
        pitchType: r.pitchType,
        stuffPlus: r.stuffPlus,
      }));

    return NextResponse.json({
      playerId: pid,
      points,
    });
  } catch (err) {
    console.error("stuff-plus outings:", err);
    return NextResponse.json({ error: "Failed to fetch outings" }, { status: 500 });
  }
}
