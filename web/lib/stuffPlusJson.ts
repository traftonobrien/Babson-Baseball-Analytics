/**
 * Stuff+ static JSON loader.
 * Reads from public/trackman/stuff_plus.json and caches the result for the
 * process lifetime (one load per server restart).
 */

import path from "path";
import { promises as fs } from "fs";

// ---------- Types ----------

export interface StuffPlusOuting {
  playerSlug: string;
  playerName: string;
  throws: string;
  date: string; // "2026_02_06"
  pitchType: string;
  stuffPlus: number;
  avgVeloMph: number;
  avgIvbIn: number;
  avgHbIn: number;
  avgSpinRpm: number | null;
  avgExtFt: number;
  maxFbVelo: number | null;
}

export interface StuffPlusArsenalEntry {
  playerSlug: string;
  playerName: string;
  throws: string;
  pitchType: string;
  meanStuffPlus: number;
  sdStuffPlus: number | null;
  avgVeloMph: number;
  maxFbVelo: number | null;
  avgExtFt: number;
  nSessions: number;
}

export interface StuffPlusData {
  computedAt: string;
  outings: StuffPlusOuting[];
  arsenal: StuffPlusArsenalEntry[];
}

// ---------- Loader ----------

const JSON_PATH = path.join(process.cwd(), "public", "trackman", "stuff_plus.json");

let cache: StuffPlusData | null = null;
let loadError = false; // true if file is missing/unparseable

export async function loadStuffPlusData(): Promise<StuffPlusData> {
  if (cache) return cache;
  if (loadError) return { computedAt: "", outings: [], arsenal: [] };

  try {
    const raw = await fs.readFile(JSON_PATH, "utf-8");
    const parsed = JSON.parse(raw) as StuffPlusData;
    cache = {
      computedAt: parsed.computedAt ?? "",
      outings: Array.isArray(parsed.outings) ? parsed.outings : [],
      arsenal: Array.isArray(parsed.arsenal) ? parsed.arsenal : [],
    };
    return cache;
  } catch {
    // File missing or unreadable — degrade gracefully
    loadError = true;
    return { computedAt: "", outings: [], arsenal: [] };
  }
}

// ---------- Slug matching ----------

/**
 * Resolve an inbound `id` (may be a slug like "burrows_chase" or a canonical
 * ID like "CBurrows1") to the playerSlug used inside the JSON file.
 *
 * Resolution order:
 *   1. Exact match against playerSlug
 *   2. Case-insensitive match against playerSlug
 *   3. Match last-name prefix: first component before "_" in slug vs first
 *      component before "_" in id (case-insensitive)
 *
 * Returns the matched slug string, or null if no match found.
 */
function resolveSlug(id: string, slugs: string[]): string | null {
  if (!id) return null;
  const idLower = id.toLowerCase();

  // 1. Exact
  if (slugs.includes(id)) return id;

  // 2. Case-insensitive
  const ci = slugs.find((s) => s.toLowerCase() === idLower);
  if (ci) return ci;

  // 3. Last-name prefix: "burrows" from "burrows_chase", "cburrows1" → first alpha word
  const idPrefix = idLower.split("_")[0];
  const prefixed = slugs.find((s) => s.toLowerCase().split("_")[0] === idPrefix);
  if (prefixed) return prefixed;

  return null;
}

// ---------- Helpers ----------

/** Return all arsenal entries for a player. */
export async function getArsenal(playerId: string): Promise<StuffPlusArsenalEntry[]> {
  const data = await loadStuffPlusData();
  const slugs = [...new Set(data.arsenal.map((a) => a.playerSlug))];
  const slug = resolveSlug(playerId, slugs);
  if (!slug) return [];
  return data.arsenal.filter((a) => a.playerSlug === slug);
}

/** Return outings for a player, optionally filtered by date. */
export async function getOutings(
  playerId: string,
  date?: string | null
): Promise<StuffPlusOuting[]> {
  const data = await loadStuffPlusData();
  const slugs = [...new Set(data.outings.map((o) => o.playerSlug))];
  const slug = resolveSlug(playerId, slugs);
  if (!slug) return [];

  const dateNorm = date?.trim().replace(/-/g, "_");
  return data.outings
    .filter((o) => o.playerSlug === slug && (!dateNorm || o.date === dateNorm))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Return all arsenal entries across all players. */
export async function getAllArsenal(): Promise<StuffPlusArsenalEntry[]> {
  const data = await loadStuffPlusData();
  return data.arsenal;
}

/** Resolve a playerId/slug to the canonical playerSlug stored in the arsenal. */
export async function resolvePlayerSlug(playerId: string): Promise<string | null> {
  const data = await loadStuffPlusData();
  const slugs = [...new Set(data.arsenal.map((a) => a.playerSlug))];
  return resolveSlug(playerId, slugs);
}
