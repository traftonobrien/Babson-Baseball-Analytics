import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fallHitterStats } from "@/db/schema";
export { formatHitterAvg, formatHitterStat } from "./hitterStatsFmt";

export interface FallHitterStatsRecord {
  id: string;
  teamId: string;
  playerName: string;
  playerId: string | null;
  pa: number;
  ab: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  woba: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertFallHitterStatsInput {
  playerName: string;
  playerId: string | null;
  pa: number;
  ab: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  woba: number | null;
}

type FallHitterStatsRow = typeof fallHitterStats.$inferSelect;

function toRecord(row: FallHitterStatsRow): FallHitterStatsRecord {
  return {
    id: row.id,
    teamId: row.teamId,
    playerName: row.playerName,
    playerId: row.playerId ?? null,
    pa: row.pa,
    ab: row.ab,
    hits: row.hits,
    singles: row.singles,
    doubles: row.doubles,
    triples: row.triples,
    hr: row.hr,
    bb: row.bb,
    hbp: row.hbp,
    k: row.k,
    avg: row.avg ?? null,
    obp: row.obp ?? null,
    slg: row.slg ?? null,
    ops: row.ops ?? null,
    woba: row.woba ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getHitterStatsByPlayerId(
  playerId: string,
): Promise<FallHitterStatsRecord | null> {
  const [row] = await db
    .select()
    .from(fallHitterStats)
    .where(
      and(
        eq(fallHitterStats.teamId, "babson"),
        eq(fallHitterStats.playerId, playerId),
      ),
    )
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function getHitterStatsByPlayerName(
  playerName: string,
): Promise<FallHitterStatsRecord | null> {
  const [row] = await db
    .select()
    .from(fallHitterStats)
    .where(
      and(
        eq(fallHitterStats.teamId, "babson"),
        eq(fallHitterStats.playerName, playerName),
      ),
    )
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function listAllHitterStats(): Promise<FallHitterStatsRecord[]> {
  const rows = await db
    .select()
    .from(fallHitterStats)
    .where(eq(fallHitterStats.teamId, "babson"))
    .orderBy(fallHitterStats.playerName);
  return rows.map(toRecord);
}

export async function upsertHitterStats(
  input: UpsertFallHitterStatsInput,
): Promise<FallHitterStatsRecord> {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(fallHitterStats)
    .values({
      id: crypto.randomUUID(),
      teamId: "babson",
      playerName: input.playerName,
      playerId: input.playerId,
      pa: input.pa,
      ab: input.ab,
      hits: input.hits,
      singles: input.singles,
      doubles: input.doubles,
      triples: input.triples,
      hr: input.hr,
      bb: input.bb,
      hbp: input.hbp,
      k: input.k,
      avg: input.avg,
      obp: input.obp,
      slg: input.slg,
      ops: input.ops,
      woba: input.woba,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [fallHitterStats.teamId, fallHitterStats.playerName],
      set: {
        playerId: input.playerId,
        pa: input.pa,
        ab: input.ab,
        hits: input.hits,
        singles: input.singles,
        doubles: input.doubles,
        triples: input.triples,
        hr: input.hr,
        bb: input.bb,
        hbp: input.hbp,
        k: input.k,
        avg: input.avg,
        obp: input.obp,
        slg: input.slg,
        ops: input.ops,
        woba: input.woba,
        updatedAt: now,
      },
    })
    .returning();
  return toRecord(row);
}

