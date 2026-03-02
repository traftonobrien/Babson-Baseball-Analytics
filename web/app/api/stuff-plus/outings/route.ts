import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { stuffPlusOutings } from "@/db/schema";

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  const date = request.nextUrl.searchParams.get("date");
  if (!playerId?.trim()) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  try {
    const dateNorm = date?.trim()?.replace(/-/g, "_");
    const conditions = dateNorm
      ? and(eq(stuffPlusOutings.playerId, playerId.trim()), eq(stuffPlusOutings.date, dateNorm))
      : eq(stuffPlusOutings.playerId, playerId.trim());

    const rows = await db
      .select({
        date: stuffPlusOutings.date,
        pitchType: stuffPlusOutings.pitchType,
        stuffPlus: stuffPlusOutings.stuffPlus,
      })
      .from(stuffPlusOutings)
      .where(conditions)
      .orderBy(asc(stuffPlusOutings.date));

    const points = rows
      .filter((r) => r.stuffPlus != null && r.pitchType !== "Other")
      .map((r) => ({
        date: r.date,
        pitchType: r.pitchType,
        stuffPlus: r.stuffPlus as number,
      }));

    return NextResponse.json({
      playerId: playerId.trim(),
      points,
    });
  } catch (err) {
    console.error("stuff-plus outings:", err);
    return NextResponse.json({ error: "Failed to fetch outings" }, { status: 500 });
  }
}
