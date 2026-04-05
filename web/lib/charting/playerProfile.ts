import { desc, eq, inArray } from "drizzle-orm";
import {
  chartingGames,
  chartingPitcherSegments,
  chartingPitches,
  chartingPlateAppearances,
} from "@/db/schema";
import { getCanonicalName, getCanonicalPlayerId } from "@/lib/canonicalPlayers";
import { playerRegistry } from "@/lib/playerRegistry";
import {
  computeHitterAggregation,
  computePitcherAggregation,
  type AggregatedHitterStats,
  type AggregatedPitcherStats,
} from "./analytics";
import {
  buildHitterPerformanceInsightsData,
  type BatterHand,
  type HitterPerformanceInsightsData,
  type PitcherHand,
} from "./hitterInsights";
import {
  buildPitcherPerformanceInsightsData,
  type PitcherPerformanceInsightsData,
} from "./pitcherInsights";
import { countPitcherInnings } from "./innings";
import {
  legacyChartingPlateAppearances,
  loadPlateAppearancesWithFallback,
  mapLegacyPlateAppearanceRow,
} from "./plateAppearanceStorage";
import {
  isMissingChartingGameMetadataColumnError,
  legacyChartingGames,
  mapLegacyGameRow,
} from "./gameStorage";
import type {
  ChartingMatchupSide,
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
} from "./types";

function normalizeMatchupSide(value: string | null | undefined): ChartingMatchupSide {
  return value === "our" ? "our" : "opponent";
}

function mapSegmentRow(row: typeof chartingPitcherSegments.$inferSelect): ChartingPitcherSegment {
  return {
    ...row,
    playerId: row.playerId ?? null,
    teamSide: normalizeMatchupSide(row.teamSide),
  };
}

export interface ChartingProfileGame {
  id: string;
  gameDate: string;
  opponent: string | null;
  sessionType: "live_ab" | "game";
}

export type ChartingProfileSessionFilter = ChartingProfileGame["sessionType"] | "all";

export interface LiveAbPitcherSession {
  gameId: string;
  gameDate: string;
  opponent: string | null;
  label: string;
  stats: AggregatedPitcherStats | null;
}

export interface LiveAbHitterSession {
  gameId: string;
  gameDate: string;
  opponent: string | null;
  label: string;
  hitterNames: string[];
  stats: AggregatedHitterStats | null;
}

export interface PitcherRawPitchRecord {
  pitchType: string;
  locationCell: number | null;
  pitchResult: string;
  ballsBefore: number;
  strikesBefore: number;
  sessionType: "live_ab" | "game";
}

export interface LiveAbPitcherProfile {
  playerId: string;
  displayName: string;
  stats: AggregatedPitcherStats | null;
  sessions: LiveAbPitcherSession[];
  pitchRecords: PitcherRawPitchRecord[];
  insights: PitcherPerformanceInsightsData | null;
}

export interface LiveAbHitterProfile {
  playerId: string | null;
  displayName: string;
  batterHand: BatterHand;
  matchedHitterNames: string[];
  stats: AggregatedHitterStats | null;
  sessions: LiveAbHitterSession[];
  insights: HitterPerformanceInsightsData | null;
}

export interface ChartingHitterInsightsDirectorySource {
  slug: string;
  name: string;
  bats?: BatterHand;
}

export interface ChartingHitterInsightsDirectoryEntry {
  playerSlug: string;
  playerId: string | null;
  displayName: string;
  batterHand: BatterHand;
  matchedHitterNames: string[];
  sessionCount: number;
  pitchCount: number;
  insights: HitterPerformanceInsightsData;
}

export interface ChartingPlayerProfile {
  playerSlug: string;
  playerId: string | null;
  displayName: string;
  availableRoles: Array<"pitcher" | "hitter">;
  defaultRole: "pitcher" | "hitter" | null;
  pitcher: LiveAbPitcherProfile | null;
  hitter: LiveAbHitterProfile | null;
}

interface BuildChartingPlayerProfileInput {
  playerSlug: string;
  batterHand?: BatterHand;
  games: ChartingProfileGame[];
  segments: ChartingPitcherSegment[];
  plateAppearances: ChartingPlateAppearance[];
  pitches: ChartingPitch[];
}

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildNameCandidates(displayName: string, slug: string): Set<string> {
  const candidates = new Set<string>();
  const trimmedDisplayName = displayName.trim();
  if (trimmedDisplayName) {
    candidates.add(normalizeAlias(trimmedDisplayName));
    const parts = trimmedDisplayName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0]!;
      const last = parts[parts.length - 1]!;
      candidates.add(normalizeAlias(`${last}, ${first}`));
      candidates.add(normalizeAlias(`${last} ${first}`));
      candidates.add(normalizeAlias(`${first}${last}`));
      candidates.add(normalizeAlias(`${last}${first}`));
    }
  }

  const slugParts = slug.split("_").filter(Boolean);
  if (slugParts.length >= 2) {
    const [last, first] = slugParts;
    candidates.add(normalizeAlias(`${first} ${last}`));
    candidates.add(normalizeAlias(`${last}, ${first}`));
    candidates.add(normalizeAlias(`${last} ${first}`));
    candidates.add(normalizeAlias(`${first}${last}`));
    candidates.add(normalizeAlias(`${last}${first}`));
  }

  candidates.add(normalizeAlias(slug));
  return candidates;
}

function buildSessionLabel(game: Pick<ChartingProfileGame, "opponent" | "gameDate">): string {
  return `${game.opponent || "Live AB"} • ${game.gameDate}`;
}

function normalizePitcherHand(value: string | null): PitcherHand {
  return value === "R" || value === "L" ? value : null;
}

const PITCHER_HAND_BY_PLAYER_ID = new Map(
  playerRegistry
    .map((player) => {
      const playerId = getCanonicalPlayerId(player.slug);
      if (!playerId) {
        return null;
      }

      return [playerId, normalizePitcherHand(player.throws)] as const;
    })
    .filter((entry): entry is readonly [string, PitcherHand] => entry !== null)
);

function matchesHitterName(
  hitterName: string,
  playerId: string | null,
  displayName: string,
  playerSlug: string
): boolean {
  const resolvedPlayerId = getCanonicalPlayerId(hitterName);
  if (playerId && resolvedPlayerId === playerId) {
    return true;
  }

  const candidates = buildNameCandidates(displayName, playerSlug);
  return candidates.has(normalizeAlias(hitterName));
}

function sortGamesDescending<T extends { gameDate: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.gameDate.localeCompare(a.gameDate));
}

function filterGamesBySessionType(
  games: ChartingProfileGame[],
  sessionType: ChartingProfileSessionFilter = "all",
): ChartingProfileGame[] {
  if (sessionType === "all") {
    return games;
  }

  return games.filter((game) => game.sessionType === sessionType);
}

async function loadChartingProfileGames(
  db: Awaited<ReturnType<typeof getDb>>,
  gameIds?: string[],
): Promise<ChartingProfileGame[]> {
  const uniqueGameIds = gameIds ? [...new Set(gameIds)] : null;

  try {
    const rawGames = await db
      .select({
        id: chartingGames.id,
        gameDate: chartingGames.gameDate,
        opponent: chartingGames.opponent,
        sessionType: chartingGames.sessionType,
      })
      .from(chartingGames)
      .where(uniqueGameIds ? inArray(chartingGames.id, uniqueGameIds) : undefined)
      .orderBy(desc(chartingGames.gameDate));

    return rawGames.map((game) => ({
      id: game.id,
      gameDate: game.gameDate,
      opponent: game.opponent,
      sessionType: game.sessionType === "game" ? "game" : "live_ab",
    }));
  } catch (error) {
    if (!isMissingChartingGameMetadataColumnError(error)) {
      throw error;
    }

    const legacyRows = await db
      .select()
      .from(legacyChartingGames)
      .where(uniqueGameIds ? inArray(legacyChartingGames.id, uniqueGameIds) : undefined)
      .orderBy(desc(legacyChartingGames.gameDate));

    return legacyRows.map((row) => {
      const game = mapLegacyGameRow(row);
      return {
        id: game.id,
        gameDate: game.gameDate,
        opponent: game.opponent,
        sessionType: game.sessionType,
      } satisfies ChartingProfileGame;
    });
  }
}

async function loadProfilePlateAppearances(
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<ChartingPlateAppearance[]> {
  return loadPlateAppearancesWithFallback({
    loadCurrentRows: () =>
      db
        .select()
        .from(chartingPlateAppearances)
        .orderBy(
          desc(chartingPlateAppearances.gameId),
          desc(chartingPlateAppearances.paOrder),
        ),
    loadLegacyRows: () =>
      db
        .select()
        .from(legacyChartingPlateAppearances)
        .orderBy(
          desc(legacyChartingPlateAppearances.gameId),
          desc(legacyChartingPlateAppearances.paOrder),
        ),
  });
}

function mapPitchRows(rows: typeof chartingPitches.$inferSelect[]): ChartingPitch[] {
  return rows.map(
    (pitch) =>
      ({
        ...pitch,
        pitchType: pitch.pitchType as ChartingPitch["pitchType"],
        pitchResult: pitch.pitchResult as ChartingPitch["pitchResult"],
      }) satisfies ChartingPitch
  );
}

export function buildChartingPlayerProfile({
  playerSlug,
  batterHand = null,
  games,
  segments,
  plateAppearances,
  pitches,
}: BuildChartingPlayerProfileInput): ChartingPlayerProfile {
  const playerId = getCanonicalPlayerId(playerSlug);
  const displayName = getCanonicalName(playerSlug);
  const gameById = new Map(games.map((game) => [game.id, game]));

  // Build lookup: segmentId → gameId → sessionType
  const segmentIdToGameId = new Map(segments.map((segment) => [segment.id, segment.gameId]));
  const gameIdToSessionType = new Map(games.map((game) => [game.id, game.sessionType]));

  const pitcherSegments = playerId
    ? segments.filter((segment) => segment.playerId === playerId)
    : [];
  const pitcherSegmentIds = new Set(pitcherSegments.map((segment) => segment.id));
  const pitcherPas = plateAppearances.filter((pa) => pitcherSegmentIds.has(pa.segmentId));
  const pitcherPaIds = new Set(pitcherPas.map((pa) => pa.id));
  const pitcherPitches = pitches.filter((pitch) => pitcherPaIds.has(pitch.paId));

  // Build lookup: paId → sessionType (via segmentId → gameId → sessionType)
  const paIdToSessionType = new Map(
    pitcherPas.map((pa) => {
      const gameId = segmentIdToGameId.get(pa.segmentId);
      const sessionType = gameId ? (gameIdToSessionType.get(gameId) ?? "live_ab") : "live_ab";
      return [pa.id, sessionType] as const;
    })
  );

  const matchedHitterPas = plateAppearances.filter((pa) =>
    matchesHitterName(pa.hitterName, playerId, displayName, playerSlug)
  );
  const matchedHitterNames = [...new Set(matchedHitterPas.map((pa) => pa.hitterName))];
  const hitterPaIds = new Set(matchedHitterPas.map((pa) => pa.id));
  const hitterPitches = pitches.filter((pitch) => hitterPaIds.has(pitch.paId));

  const pitcher =
    pitcherSegments.length > 0
      ? {
          playerId: playerId ?? pitcherSegments[0]!.playerId ?? "",
          displayName: pitcherSegments[0]!.displayName,
          stats:
            pitcherPas.length > 0 && pitcherPitches.length > 0
              ? computePitcherAggregation(
                  pitcherPitches,
                  pitcherPas,
                  new Set(pitcherSegments.map((segment) => segment.gameId)).size,
                  countPitcherInnings(pitcherSegments, pitcherPas)
                )
              : null,
          sessions: sortGamesDescending(
            [...new Set(pitcherSegments.map((segment) => segment.gameId))]
              .map((gameId) => {
                const game = gameById.get(gameId);
                if (!game) return null;

                const gameSegments = pitcherSegments.filter((segment) => segment.gameId === gameId);
                const gameSegmentIds = new Set(gameSegments.map((segment) => segment.id));
                const gamePas = pitcherPas.filter((pa) => gameSegmentIds.has(pa.segmentId));
                const gamePaIds = new Set(gamePas.map((pa) => pa.id));
                const gamePitches = pitcherPitches.filter((pitch) => gamePaIds.has(pitch.paId));

                return {
                  gameId,
                  gameDate: game.gameDate,
                  opponent: game.opponent,
                  label: buildSessionLabel(game),
                  stats:
                    gamePas.length > 0 && gamePitches.length > 0
                      ? computePitcherAggregation(
                          gamePitches,
                          gamePas,
                          1,
                          countPitcherInnings(gameSegments, gamePas)
                        )
                      : null,
                } satisfies LiveAbPitcherSession;
              })
              .filter((session): session is LiveAbPitcherSession => session !== null)
          ),
          pitchRecords: pitcherPitches.map((pitch) => ({
            pitchType: pitch.pitchType,
            locationCell: pitch.locationCell,
            pitchResult: pitch.pitchResult,
            ballsBefore: pitch.ballsBefore,
            strikesBefore: pitch.strikesBefore,
            sessionType: paIdToSessionType.get(pitch.paId) ?? "live_ab",
          })),
          insights: buildPitcherPerformanceInsightsData({
            pitcherId: playerId,
            pitcherName: displayName,
            games: games.map((g) => ({ id: g.id, gameDate: g.gameDate, opponent: g.opponent })),
            plateAppearances: pitcherPas,
            pitches: pitcherPitches,
          }),
        } satisfies LiveAbPitcherProfile
      : null;

  const hitter =
    matchedHitterPas.length > 0
      ? {
          playerId,
          displayName,
          batterHand,
          matchedHitterNames,
          stats:
            hitterPitches.length > 0
              ? computeHitterAggregation(
                  hitterPitches,
                  matchedHitterPas,
                  new Set(matchedHitterPas.map((pa) => pa.gameId)).size
                )
              : null,
          sessions: sortGamesDescending(
            [...new Set(matchedHitterPas.map((pa) => pa.gameId))]
              .map((gameId) => {
                const game = gameById.get(gameId);
                if (!game) return null;

                const gamePas = matchedHitterPas.filter((pa) => pa.gameId === gameId);
                const gamePaIds = new Set(gamePas.map((pa) => pa.id));
                const gamePitches = hitterPitches.filter((pitch) => gamePaIds.has(pitch.paId));

                return {
                  gameId,
                  gameDate: game.gameDate,
                  opponent: game.opponent,
                  label: buildSessionLabel(game),
                  hitterNames: [...new Set(gamePas.map((pa) => pa.hitterName))],
                  stats:
                    gamePitches.length > 0
                      ? computeHitterAggregation(gamePitches, gamePas, 1)
                      : null,
                } satisfies LiveAbHitterSession;
              })
              .filter((session): session is LiveAbHitterSession => session !== null)
          ),
          insights: buildHitterPerformanceInsightsData({
            hitterId: playerId,
            hitterName: displayName,
            batterHand,
            matchedHitterNames,
            games,
            plateAppearances: matchedHitterPas,
            pitches: hitterPitches,
            pitcherHandBySegmentId: new Map(
              segments.map((segment) => [
                segment.id,
                (segment.playerId ? PITCHER_HAND_BY_PLAYER_ID.get(segment.playerId) : undefined) ?? null,
              ])
            ),
          }),
        } satisfies LiveAbHitterProfile
      : null;

  const availableRoles: Array<"pitcher" | "hitter"> = [];
  if (pitcher) availableRoles.push("pitcher");
  if (hitter) availableRoles.push("hitter");

  return {
    playerSlug,
    playerId,
    displayName,
    availableRoles,
    defaultRole: availableRoles[0] ?? null,
    pitcher,
    hitter,
  };
}

export function buildChartingHitterInsightsDirectory({
  players,
  games,
  segments = [],
  plateAppearances,
  pitches,
}: {
  players: ChartingHitterInsightsDirectorySource[];
  games: ChartingProfileGame[];
  segments?: ChartingPitcherSegment[];
  plateAppearances: ChartingPlateAppearance[];
  pitches: ChartingPitch[];
}): ChartingHitterInsightsDirectoryEntry[] {
  return players
    .map((player) => {
      const profile = buildChartingPlayerProfile({
        playerSlug: player.slug,
        batterHand: player.bats ?? null,
        games,
        segments,
        plateAppearances,
        pitches,
      });

      if (!profile.hitter?.insights) {
        return null;
      }

      return {
        playerSlug: player.slug,
        playerId: profile.playerId,
        displayName: profile.displayName,
        batterHand: profile.hitter.batterHand,
        matchedHitterNames: profile.hitter.matchedHitterNames,
        sessionCount: profile.hitter.sessions.length,
        pitchCount: profile.hitter.insights.pitches.length,
        insights: profile.hitter.insights,
      } satisfies ChartingHitterInsightsDirectoryEntry;
    })
    .filter((entry): entry is ChartingHitterInsightsDirectoryEntry => entry !== null)
    .sort((left, right) => {
      const sessionDiff = right.sessionCount - left.sessionCount;
      if (sessionDiff !== 0) return sessionDiff;

      const pitchDiff = right.pitchCount - left.pitchCount;
      if (pitchDiff !== 0) return pitchDiff;

      return left.displayName.localeCompare(right.displayName);
    });
}

async function getDb() {
  const { db } = await import("@/db");
  return db;
}

export async function loadChartingPlayerProfile(
  playerSlug: string,
  options?: {
    batterHand?: BatterHand;
    sessionType?: ChartingProfileSessionFilter;
  }
): Promise<ChartingPlayerProfile> {
  const playerId = getCanonicalPlayerId(playerSlug);
  const displayName = getCanonicalName(playerSlug);
  const db = await getDb();

  const allPas = await loadProfilePlateAppearances(db);

  const pitcherSegments: ChartingPitcherSegment[] = playerId
    ? (await db
        .select()
        .from(chartingPitcherSegments)
        .where(eq(chartingPitcherSegments.playerId, playerId))).map(mapSegmentRow)
    : [];

  const matchedHitterPas = allPas.filter((pa) =>
    matchesHitterName(pa.hitterName, playerId, displayName, playerSlug)
  );

  const relevantGameIds = [
    ...new Set([
      ...pitcherSegments.map((segment) => segment.gameId),
      ...matchedHitterPas.map((pa) => pa.gameId),
    ]),
  ];

  if (relevantGameIds.length === 0) {
    return buildChartingPlayerProfile({
      playerSlug,
      batterHand: options?.batterHand ?? null,
      games: [],
      segments: [],
      plateAppearances: [],
      pitches: [],
    });
  }

  const games = await loadChartingProfileGames(db, relevantGameIds);
  const filteredGames = filterGamesBySessionType(
    games,
    options?.sessionType ?? "all",
  );
  if (filteredGames.length === 0) {
    return buildChartingPlayerProfile({
      playerSlug,
      batterHand: options?.batterHand ?? null,
      games: [],
      segments: [],
      plateAppearances: [],
      pitches: [],
    });
  }
  const allowedGameIds = new Set(filteredGames.map((game) => game.id));
  const filteredPitcherSegments = pitcherSegments.filter((segment) =>
    allowedGameIds.has(segment.gameId),
  );

  const relevantSegmentIds = new Set(
    filteredPitcherSegments.map((segment) => segment.id),
  );
  const relevantPas = allPas.filter(
    (pa) =>
      allowedGameIds.has(pa.gameId) &&
      (relevantSegmentIds.has(pa.segmentId) ||
        matchesHitterName(pa.hitterName, playerId, displayName, playerSlug))
  );
  const relevantSegments: ChartingPitcherSegment[] =
    relevantPas.length > 0
      ? (await db
          .select()
          .from(chartingPitcherSegments)
          .where(
            inArray(
              chartingPitcherSegments.id,
              [...new Set(relevantPas.map((plateAppearance) => plateAppearance.segmentId))]
            )
          )).map(mapSegmentRow)
      : [];
  const relevantPaIds = [...new Set(relevantPas.map((pa) => pa.id))];
  const pitches =
    relevantPaIds.length > 0
      ? mapPitchRows(
          await db
            .select()
            .from(chartingPitches)
            .where(inArray(chartingPitches.paId, relevantPaIds))
            .orderBy(desc(chartingPitches.gameId), desc(chartingPitches.pitchOrder))
        )
      : [];

  return buildChartingPlayerProfile({
    playerSlug,
    batterHand: options?.batterHand ?? null,
    games: filteredGames,
    segments: relevantSegments,
    plateAppearances: relevantPas,
    pitches,
  });
}

export async function loadChartingHitterInsightsDirectory(
  players: ChartingHitterInsightsDirectorySource[],
  options?: { sessionType?: ChartingProfileSessionFilter },
): Promise<ChartingHitterInsightsDirectoryEntry[]> {
  const db = await getDb();
  const games = await loadChartingProfileGames(db);
  const filteredGames = filterGamesBySessionType(
    games,
    options?.sessionType ?? "all",
  );
  const allowedGameIds = new Set(filteredGames.map((game) => game.id));

  const plateAppearances = (
    await loadProfilePlateAppearances(db)
  )
    .filter((plateAppearance) => allowedGameIds.has(plateAppearance.gameId));

  if (plateAppearances.length === 0) {
    return [];
  }

  const segments: ChartingPitcherSegment[] = (await db
    .select()
    .from(chartingPitcherSegments)
    .orderBy(
      desc(chartingPitcherSegments.gameId),
      desc(chartingPitcherSegments.segmentOrder),
    ))
    .map(mapSegmentRow)
    .filter((segment) => allowedGameIds.has(segment.gameId));

  const paIds = [...new Set(plateAppearances.map((plateAppearance) => plateAppearance.id))];
  const pitches =
    paIds.length > 0
      ? mapPitchRows(
          await db
            .select()
            .from(chartingPitches)
            .where(inArray(chartingPitches.paId, paIds))
            .orderBy(desc(chartingPitches.gameId), desc(chartingPitches.pitchOrder))
        )
      : [];

  return buildChartingHitterInsightsDirectory({
    players,
    games: filteredGames,
    segments,
    plateAppearances,
    pitches,
  });
}
