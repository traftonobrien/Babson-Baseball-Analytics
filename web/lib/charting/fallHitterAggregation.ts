// Server-only — DB imports. Do not import in vitest tests.
import { and, inArray, isNotNull, notInArray } from "drizzle-orm";
import { chartingDb as db } from "@/db";
import { chartingGames, chartingPlateAppearances } from "@/db/schema";
import { FALL_SESSION_TYPES } from "./fallSessionTypes";
import { CANONICAL_BY_PLAYER_ID, SLUG_BY_PLAYER_ID } from "@/lib/canonicalPlayersData";
import { listAllHitterStats } from "@/lib/fall/hitterStats";
import {
  buildAggregateMap,
  computeSlash,
  BASERUNNER_ONLY_CODES,
  type FallHitterAggregate,
  type HitterAccumulator,
} from "./fallHitterAggregationUtils";

export type { FallHitterAggregate } from "./fallHitterAggregationUtils";

// name (lowercase) → playerId, derived from canonical registry
const NAME_TO_PLAYER_ID: Record<string, string> = {};
for (const [playerId, canonicalName] of Object.entries(CANONICAL_BY_PLAYER_ID)) {
  NAME_TO_PLAYER_ID[canonicalName.toLowerCase()] = playerId;
}

function resolveIdentity(hitterName: string): { playerId: string | null; playerSlug: string | null } {
  const playerId = NAME_TO_PLAYER_ID[hitterName.toLowerCase()] ?? null;
  const playerSlug = playerId ? (SLUG_BY_PLAYER_ID[playerId] ?? null) : null;
  return { playerId, playerSlug };
}

function accToAggregate(
  acc: HitterAccumulator,
  source: FallHitterAggregate["source"],
  woba: number | null = null,
): FallHitterAggregate {
  const { playerId, playerSlug } = resolveIdentity(acc.hitterName);
  const slash = computeSlash(acc);
  return { ...acc, playerId, playerSlug, ...slash, woba, source };
}

async function fetchFallPARows(): Promise<Array<{ hitterName: string; resultCode: string }>> {
  // 1. Get all fall game IDs
  const games = await db
    .select({ id: chartingGames.id })
    .from(chartingGames)
    .where(inArray(chartingGames.sessionType, [...FALL_SESSION_TYPES]));

  if (games.length === 0) return [];

  const gameIds = games.map((g) => g.id);

  // 2. Fetch PAs with a closed result code, excluding baserunner-only events
  const rows = await db
    .select({
      hitterName: chartingPlateAppearances.hitterName,
      resultCode: chartingPlateAppearances.resultCode,
    })
    .from(chartingPlateAppearances)
    .where(
      and(
        inArray(chartingPlateAppearances.gameId, gameIds),
        isNotNull(chartingPlateAppearances.resultCode),
        notInArray(chartingPlateAppearances.resultCode, [...BASERUNNER_ONLY_CODES]),
      ),
    );

  return rows as Array<{ hitterName: string; resultCode: string }>;
}

/**
 * Derives season batting stats for every hitter from charted fall sessions.
 * Falls back to `fall_hitter_stats` (Excel import) for players with no charted PAs.
 */
export async function deriveFallHitterStats(): Promise<FallHitterAggregate[]> {
  const [paRows, excelRows] = await Promise.all([
    fetchFallPARows(),
    listAllHitterStats().catch(() => []),
  ]);

  // Aggregate charting PAs
  const accMap = buildAggregateMap(paRows);

  // Build charting aggregates
  const chartingAggregates: FallHitterAggregate[] = Array.from(accMap.values()).map((acc) =>
    accToAggregate(acc, "charting"),
  );

  // Build set of playerIds + normalized names already covered by charting
  const coveredPlayerIds = new Set<string>();
  const coveredNames = new Set<string>();
  for (const agg of chartingAggregates) {
    if (agg.playerId) coveredPlayerIds.add(agg.playerId);
    coveredNames.add(agg.hitterName.toLowerCase());
  }

  // Merge Excel fallback rows for players not in charting data
  const excelFallback: FallHitterAggregate[] = [];
  for (const row of excelRows) {
    const alreadyCovered =
      (row.playerId && coveredPlayerIds.has(row.playerId)) ||
      coveredNames.has(row.playerName.toLowerCase());
    if (alreadyCovered) continue;

    const { playerId, playerSlug } = row.playerId
      ? { playerId: row.playerId, playerSlug: SLUG_BY_PLAYER_ID[row.playerId] ?? null }
      : resolveIdentity(row.playerName);

    excelFallback.push({
      hitterName: row.playerName,
      playerId,
      playerSlug,
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
      sacFly: 0,
      sacBunt: 0,
      avg: row.avg,
      obp: row.obp,
      slg: row.slg,
      ops: row.ops,
      woba: row.woba,
      source: "excel_import",
    });
  }

  return [...chartingAggregates, ...excelFallback];
}

/**
 * Derives fall batting stats for a single player by playerId.
 * Falls back to `fall_hitter_stats` if no charted PAs exist.
 */
export async function deriveFallHitterStatsForPlayer(
  playerId: string,
): Promise<FallHitterAggregate | null> {
  const canonicalName = CANONICAL_BY_PLAYER_ID[playerId];
  if (!canonicalName) return null;

  const nameLower = canonicalName.toLowerCase();

  const paRows = await fetchFallPARows();
  const playerRows = paRows.filter((r) => r.hitterName.toLowerCase() === nameLower);

  if (playerRows.length > 0) {
    const accMap = buildAggregateMap(playerRows);
    const acc = accMap.get(canonicalName) ?? accMap.values().next().value;
    if (!acc) return null;
    return accToAggregate(acc, "charting");
  }

  // Fallback: Excel import
  const excelRows = await listAllHitterStats().catch(() => []);
  const excelRow = excelRows.find(
    (r) => r.playerId === playerId || r.playerName.toLowerCase() === nameLower,
  );
  if (!excelRow) return null;

  const playerSlug = SLUG_BY_PLAYER_ID[playerId] ?? null;
  return {
    hitterName: excelRow.playerName,
    playerId,
    playerSlug,
    pa: excelRow.pa,
    ab: excelRow.ab,
    hits: excelRow.hits,
    singles: excelRow.singles,
    doubles: excelRow.doubles,
    triples: excelRow.triples,
    hr: excelRow.hr,
    bb: excelRow.bb,
    hbp: excelRow.hbp,
    k: excelRow.k,
    sacFly: 0,
    sacBunt: 0,
    avg: excelRow.avg,
    obp: excelRow.obp,
    slg: excelRow.slg,
    ops: excelRow.ops,
    woba: excelRow.woba,
    source: "excel_import",
  };
}
