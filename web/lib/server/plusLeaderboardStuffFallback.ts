import {
  getCanonicalName,
  getCanonicalPlayerId,
  getHand,
} from "@/lib/canonicalPlayers";
import type { StuffPlusOuting } from "@/lib/stuffPlusJson";

export interface LeaderboardStuffRow {
  playerId: string;
  playerName: string | null;
  throws: "R" | "L" | null;
  dateId: string;
  season: number;
  pitchType: string;
  stuffPlus: number;
}

const ONE_OFF_STUFF_FALLBACK_PLAYERS: Record<string, number> = {
  JFinkelstein1: 2026,
};

function normalizeDateId(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/-/g, "_");
}

function normalizeThrow(value: string | null | undefined): "R" | "L" | null {
  return value === "R" || value === "L" ? value : null;
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function buildOneOffStuffFallbackRows({
  seasons,
  existingRows,
  outings,
}: {
  seasons: number[];
  existingRows: LeaderboardStuffRow[];
  outings: StuffPlusOuting[];
}): LeaderboardStuffRow[] {
  const existingSeasonKeys = new Set(
    existingRows.map((row) => `${row.playerId}:${row.season}`),
  );
  const groupedByPlayer = new Map<string, LeaderboardStuffRow[]>();

  for (const outing of outings) {
    const canonicalPlayerId =
      getCanonicalPlayerId(outing.playerSlug) ??
      getCanonicalPlayerId(outing.playerName) ??
      null;
    if (!canonicalPlayerId) continue;

    const targetSeason = ONE_OFF_STUFF_FALLBACK_PLAYERS[canonicalPlayerId];
    if (!targetSeason || !seasons.includes(targetSeason)) continue;
    if (existingSeasonKeys.has(`${canonicalPlayerId}:${targetSeason}`)) continue;

    const dateId = normalizeDateId(outing.date);
    if (!dateId || !isFinitePositiveNumber(outing.stuffPlus)) continue;

    const next = groupedByPlayer.get(canonicalPlayerId) ?? [];
    next.push({
      playerId: canonicalPlayerId,
      playerName: getCanonicalName(canonicalPlayerId) ?? outing.playerName ?? null,
      throws: getHand(canonicalPlayerId) ?? normalizeThrow(outing.throws),
      dateId,
      season: targetSeason,
      pitchType: outing.pitchType,
      stuffPlus: outing.stuffPlus,
    });
    groupedByPlayer.set(canonicalPlayerId, next);
  }

  const fallbackRows: LeaderboardStuffRow[] = [];

  for (const rows of groupedByPlayer.values()) {
    const latestDateId = rows.reduce(
      (latest, row) => (row.dateId > latest ? row.dateId : latest),
      "",
    );
    fallbackRows.push(...rows.filter((row) => row.dateId === latestDateId));
  }

  return fallbackRows;
}
