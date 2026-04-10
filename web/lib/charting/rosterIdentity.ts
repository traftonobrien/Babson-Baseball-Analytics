import { getCanonicalPlayerId } from "@/lib/canonicalPlayers";
import type { ChartingBootstrapRosterPlayer } from "./types";

function normalizeComparableName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function findRosterPlayerByIdentity(
  rosterPlayers: ChartingBootstrapRosterPlayer[],
  rawValue: string,
): ChartingBootstrapRosterPlayer | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedValue = normalizeComparableName(trimmed);
  const canonicalPlayerId = getCanonicalPlayerId(trimmed);

  return (
    rosterPlayers.find((player) => {
      if (normalizeComparableName(player.name) === normalizedValue) {
        return true;
      }

      if (normalizeComparableName(player.slug) === normalizedValue) {
        return true;
      }

      if (canonicalPlayerId && player.playerId === canonicalPlayerId) {
        return true;
      }

      return false;
    }) ?? null
  );
}

export function canonicalizeRosterPlayerName(
  rosterPlayers: ChartingBootstrapRosterPlayer[],
  rawValue: string,
): string {
  const matchedPlayer = findRosterPlayerByIdentity(rosterPlayers, rawValue);
  if (matchedPlayer) {
    return matchedPlayer.name;
  }

  return rawValue.trim();
}
