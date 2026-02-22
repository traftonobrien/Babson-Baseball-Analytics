/**
 * Server-only mechanics registry reader.
 * Import ONLY from server components or server actions — never from client components.
 * Reads public/mechanics/index.json at request time via fs/promises.
 */
import { readFile } from "fs/promises";
import path from "path";
import type { HubPlayerEntry, HubSessionEntry, MechanicsIndex } from "./hub";

export type { HubPlayerEntry as MechanicsPlayerEntry, HubSessionEntry as MechanicsSessionEntry };

// ---------------------------------------------------------------------------
// Normalizer (strips punctuation and lowercases — used for name matching)
// ---------------------------------------------------------------------------
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// readMechanicsIndex — tolerates missing/malformed JSON
// ---------------------------------------------------------------------------
export async function readMechanicsIndex(): Promise<MechanicsIndex> {
  try {
    const filePath = path.join(process.cwd(), "public", "mechanics", "index.json");
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as MechanicsIndex;
    if (!Array.isArray(parsed?.players)) return { players: [] };
    return parsed;
  } catch {
    return { players: [] };
  }
}

// ---------------------------------------------------------------------------
// getMechanicsForPlayer — three-tier slug/name matching
// ---------------------------------------------------------------------------
export function getMechanicsForPlayer(
  index: MechanicsIndex,
  opts: {
    /** The slug used by /players/[slug] — e.g. "obrien_trafton" */
    profileSlug?: string;
    /** Player display name from the profile registry — e.g. "Trafton OBrien" */
    playerName?: string;
  },
): HubPlayerEntry | null {
  if (!index.players?.length) return null;
  const { profileSlug, playerName } = opts;

  for (const entry of index.players) {
    // 1. Explicit profile_slug field (most reliable; add to index.json for new players)
    if (profileSlug && entry.profile_slug != null && entry.profile_slug === profileSlug) {
      return entry;
    }
    // 2. Direct slug match (covers the case where slugs coincidentally align)
    if (profileSlug && entry.slug === profileSlug) return entry;
  }

  // 3. Normalized name fallback — strips apostrophes/spaces/case so
  //    "Trafton O'Brien" === "Trafton OBrien" === "traftonobrien"
  // TODO: prefer adding explicit profile_slug to index.json to avoid name-drift bugs.
  if (playerName) {
    const target = norm(playerName);
    for (const entry of index.players) {
      if (norm(entry.name) === target) return entry;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// getLatestMechanicsSession
// ---------------------------------------------------------------------------
export function getLatestMechanicsSession(entry: HubPlayerEntry): HubSessionEntry | null {
  if (!entry.sessions?.length) return null;
  return [...entry.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
}

// ---------------------------------------------------------------------------
// getNeedsAttentionCount — used by homepage to surface a quick count
// A player "needs attention" if their latest session has:
//   efficiency_score < 5   OR  fail_count >= 2  OR  >50% low-confidence metrics
// ---------------------------------------------------------------------------
export function getNeedsAttentionCount(players: HubPlayerEntry[]): number {
  return players.filter((p) => {
    if (!p.sessions?.length) return false;
    const latest = [...p.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
    const total = (latest.pass_count ?? 0) + (latest.fail_count ?? 0);
    const lowConfFrac =
      total > 0 && latest.low_confidence_count != null
        ? latest.low_confidence_count / total
        : 0;
    return latest.efficiency_score < 5 || (latest.fail_count ?? 0) >= 2 || lowConfFrac > 0.5;
  }).length;
}
