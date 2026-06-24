import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fallPitcherOutings } from "@/db/schema";
import type { PlayerAccountRecord } from "@/lib/accounts/repository";
import {
  summarizeFallPitcherOuting,
  type FallPitcherOutingSummary,
  type FallPitcherOutingType,
} from "./outingStats";

export interface FallPitcherOutingRecord {
  id: string;
  teamId: string;
  accountEmail: string;
  playerId: string;
  playerName: string;
  outingType: FallPitcherOutingType;
  outingDate: string;
  innings: number | null;
  earnedRuns: number;
  strikeouts: number;
  walks: number;
  hits: number;
  pitchTokens: string;
  resultTokens: string;
  fpsTokens: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  summary: FallPitcherOutingSummary;
}

export interface CreateFallPitcherOutingInput {
  outingType: FallPitcherOutingType;
  outingDate: string;
  innings: number | null;
  earnedRuns: number;
  strikeouts: number;
  walks: number;
  hits: number;
  pitchTokens: string;
  resultTokens: string;
  fpsTokens: string;
  notes: string | null;
}

type FallPitcherOutingRow = typeof fallPitcherOutings.$inferSelect;

function toOutingRecord(row: FallPitcherOutingRow): FallPitcherOutingRecord {
  const outing = {
    ...row,
    outingType: row.outingType as FallPitcherOutingType,
  };

  return {
    ...outing,
    summary: summarizeFallPitcherOuting({
      pitchTokens: row.pitchTokens,
      resultTokens: row.resultTokens,
      fpsTokens: row.fpsTokens,
      innings: row.innings,
      earnedRuns: row.earnedRuns,
      strikeouts: row.strikeouts,
      walks: row.walks,
      hits: row.hits,
    }),
  };
}

export interface FallPitcherRosterEntry {
  playerId: string;
  playerName: string;
  outings: FallPitcherOutingRecord[];
  season: FallPitcherSeasonSummary;
}

export async function listAllFallPitcherOutingsForTeam(): Promise<{
  allOutings: FallPitcherOutingRecord[];
  byPlayer: FallPitcherRosterEntry[];
}> {
  const rows = await db
    .select()
    .from(fallPitcherOutings)
    .where(eq(fallPitcherOutings.teamId, "babson"))
    .orderBy(desc(fallPitcherOutings.outingDate), desc(fallPitcherOutings.createdAt));

  const allOutings = rows.map(toOutingRecord);

  const playerMap = new Map<string, FallPitcherOutingRecord[]>();
  for (const o of allOutings) {
    const list = playerMap.get(o.playerId) ?? [];
    list.push(o);
    playerMap.set(o.playerId, list);
  }

  const byPlayer: FallPitcherRosterEntry[] = [];
  for (const [playerId, outings] of playerMap) {
    byPlayer.push({
      playerId,
      playerName: outings[0].playerName,
      outings,
      season: aggregateFallPitcherOutings(outings),
    });
  }

  byPlayer.sort((a, b) => b.season.pitchCount - a.season.pitchCount);

  return { allOutings, byPlayer };
}

export async function listFallPitcherOutingsForAccount(
  account: PlayerAccountRecord,
): Promise<FallPitcherOutingRecord[]> {
  if (!account.playerId) {
    return [];
  }

  const rows = await db
    .select()
    .from(fallPitcherOutings)
    .where(
      and(
        eq(fallPitcherOutings.teamId, "babson"),
        eq(fallPitcherOutings.playerId, account.playerId),
      ),
    )
    .orderBy(desc(fallPitcherOutings.outingDate), desc(fallPitcherOutings.createdAt));

  return rows.map(toOutingRecord);
}

export interface FallPitcherSeasonSummary {
  outingCount: number;
  inningsPitched: number;
  pitchCount: number;
  strikeCount: number;
  strikePct: number | null;
  firstPitchStrikeCount: number;
  fpsPct: number | null;
  strikeouts: number;
  walks: number;
  hits: number;
  earnedRuns: number;
  whip: number | null;
  era: number | null;
  byType: Record<FallPitcherOutingType, { outings: number; pitches: number; innings: number }>;
}

export function aggregateFallPitcherOutings(
  outings: FallPitcherOutingRecord[],
): FallPitcherSeasonSummary {
  let inningsPitched = 0;
  let pitchCount = 0;
  let strikeCount = 0;
  let firstPitchStrikeCount = 0;
  let fpsDenominator = 0;
  let strikeouts = 0;
  let walks = 0;
  let hits = 0;
  let earnedRuns = 0;

  const byType: FallPitcherSeasonSummary["byType"] = {
    bullpen: { outings: 0, pitches: 0, innings: 0 },
    live_ab: { outings: 0, pitches: 0, innings: 0 },
    intersquad: { outings: 0, pitches: 0, innings: 0 },
    scrimmage: { outings: 0, pitches: 0, innings: 0 },
    game: { outings: 0, pitches: 0, innings: 0 },
    other: { outings: 0, pitches: 0, innings: 0 },
  };

  for (const o of outings) {
    const inn = o.innings ?? 0;
    inningsPitched += inn;
    pitchCount += o.summary.pitchCount;
    strikeCount += o.summary.strikeCount;
    firstPitchStrikeCount += o.summary.firstPitchStrikeCount;
    if (o.summary.firstPitchStrikePct !== null) {
      // count FPS attempts only when fpsTokens were provided
      const splitWorkbookTokens = (v: string) => v.split(/[\s,;|]+/g).map(t => t.trim()).filter(Boolean);
      fpsDenominator += splitWorkbookTokens(o.fpsTokens).length;
    }
    strikeouts += o.strikeouts;
    walks += o.walks;
    hits += o.hits;
    earnedRuns += o.earnedRuns;

    const slot = byType[o.outingType];
    slot.outings += 1;
    slot.pitches += o.summary.pitchCount;
    slot.innings += inn;
  }

  return {
    outingCount: outings.length,
    inningsPitched,
    pitchCount,
    strikeCount,
    strikePct: pitchCount > 0 ? (strikeCount / pitchCount) * 100 : null,
    firstPitchStrikeCount,
    fpsPct: fpsDenominator > 0 ? (firstPitchStrikeCount / fpsDenominator) * 100 : null,
    strikeouts,
    walks,
    hits,
    earnedRuns,
    whip: inningsPitched > 0 ? (walks + hits) / inningsPitched : null,
    era: inningsPitched > 0 ? (earnedRuns * 9) / inningsPitched : null,
    byType,
  };
}

export async function getFallPitcherOutingById(
  id: string,
): Promise<FallPitcherOutingRecord | null> {
  const [row] = await db
    .select()
    .from(fallPitcherOutings)
    .where(eq(fallPitcherOutings.id, id))
    .limit(1);
  return row ? toOutingRecord(row) : null;
}

export async function createFallPitcherOutingForAccount({
  account,
  input,
}: {
  account: PlayerAccountRecord;
  input: CreateFallPitcherOutingInput;
}): Promise<FallPitcherOutingRecord> {
  if (!account.playerId || !account.playerName) {
    throw new Error("Account must be linked to a roster player before logging outings");
  }

  const now = new Date().toISOString();
  const [row] = await db
    .insert(fallPitcherOutings)
    .values({
      id: crypto.randomUUID(),
      teamId: "babson",
      accountEmail: account.email,
      playerId: account.playerId,
      playerName: account.playerName,
      outingType: input.outingType,
      outingDate: input.outingDate,
      innings: input.innings,
      earnedRuns: input.earnedRuns,
      strikeouts: input.strikeouts,
      walks: input.walks,
      hits: input.hits,
      pitchTokens: input.pitchTokens,
      resultTokens: input.resultTokens,
      fpsTokens: input.fpsTokens,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toOutingRecord(row);
}
