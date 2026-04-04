import { getCanonicalName, getCanonicalPlayerId } from "../../../lib/canonicalPlayers";

interface PitcherSegmentIdentityInput {
  id: string;
  playerId: string | null;
  displayName: string;
}

interface HitterIdentityInput {
  hitterName: string;
}

export interface PitcherLeaderboardIdentity {
  key: string;
  playerId: string | null;
  displayName: string;
  segmentIds: string[];
}

export interface HitterLeaderboardIdentity {
  key: string;
  playerId: string | null;
  displayName: string;
  hitterNames: string[];
}

function normalizeFallbackKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildPitcherLeaderboardIdentities(
  segments: PitcherSegmentIdentityInput[],
): PitcherLeaderboardIdentity[] {
  const grouped = new Map<string, PitcherLeaderboardIdentity>();

  for (const segment of segments) {
    const rawPlayerId = segment.playerId?.trim() || null;
    const displayName = segment.displayName.trim();
    const canonicalPlayerId =
      (rawPlayerId ? getCanonicalPlayerId(rawPlayerId) : null) ??
      getCanonicalPlayerId(displayName);
    const key = canonicalPlayerId ?? rawPlayerId ?? `name:${normalizeFallbackKey(displayName)}`;

    const existing = grouped.get(key);
    if (existing) {
      existing.segmentIds.push(segment.id);
      continue;
    }

    grouped.set(key, {
      key,
      playerId: canonicalPlayerId ?? rawPlayerId,
      displayName: canonicalPlayerId ? getCanonicalName(canonicalPlayerId) : displayName,
      segmentIds: [segment.id],
    });
  }

  return Array.from(grouped.values());
}

export function buildHitterLeaderboardIdentities(
  hitters: HitterIdentityInput[],
): HitterLeaderboardIdentity[] {
  const grouped = new Map<string, HitterLeaderboardIdentity>();

  for (const hitter of hitters) {
    const rawName = hitter.hitterName.trim();
    if (!rawName) {
      continue;
    }

    const canonicalPlayerId = getCanonicalPlayerId(rawName);
    const key = canonicalPlayerId ?? `name:${normalizeFallbackKey(rawName)}`;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.hitterNames.includes(rawName)) {
        existing.hitterNames.push(rawName);
      }
      continue;
    }

    grouped.set(key, {
      key,
      playerId: canonicalPlayerId,
      displayName: canonicalPlayerId ? getCanonicalName(canonicalPlayerId) : rawName,
      hitterNames: [rawName],
    });
  }

  return Array.from(grouped.values());
}
