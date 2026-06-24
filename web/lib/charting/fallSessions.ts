// Server-only — DB imports
import { desc, inArray } from "drizzle-orm";
import { chartingDb as db } from "@/db";
import { chartingGames } from "@/db/schema";
import {
  FALL_SESSION_TYPES,
  type FallSessionType,
} from "./fallSessionTypes";

export { FALL_SESSION_TYPES, FALL_SESSION_LABELS, isFallSessionType } from "./fallSessionTypes";
export type { FallSessionType };

export interface FallChartingSession {
  id: string;
  sessionType: FallSessionType;
  gameDate: string;
  pitcher: string | null;
  status: string;
  notes: string | null;
}

export async function listFallChartingSessions(): Promise<FallChartingSession[]> {
  const rows = await db
    .select({
      id: chartingGames.id,
      sessionType: chartingGames.sessionType,
      gameDate: chartingGames.gameDate,
      pitcher: chartingGames.babsonStartingPitcher,
      status: chartingGames.status,
      notes: chartingGames.notes,
    })
    .from(chartingGames)
    .where(inArray(chartingGames.sessionType, [...FALL_SESSION_TYPES]))
    .orderBy(desc(chartingGames.gameDate));

  return rows.map((r) => ({
    ...r,
    sessionType: r.sessionType as FallSessionType,
  }));
}

export async function listFallChartingSessionsForPitcher(
  pitcherName: string,
): Promise<FallChartingSession[]> {
  const all = await listFallChartingSessions();
  const lower = pitcherName.toLowerCase();
  return all.filter((s) => s.pitcher?.toLowerCase() === lower);
}
