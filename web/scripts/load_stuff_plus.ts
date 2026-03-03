/**
 * Load Stuff+ CSVs into Neon PostgreSQL.
 * Run from web/: npm run load:stuff-plus
 *
 * Expects CSVs at: ../output/stuff_plus/
 * - stuff_plus_pitcher_arsenal.csv
 * - stuff_plus_pitchtype_outings.csv
 */
import { config } from "dotenv";
import { readFile } from "fs/promises";
import { join } from "path";
import Papa from "papaparse";
import { stuffPlusArsenal, stuffPlusOutings } from "../db/schema";
import {
  getCanonicalName,
  getCanonicalPlayerId,
  getHand,
} from "../lib/canonicalPlayers";

config({ path: ".env.local" });

/** Normalize pitch type for consistency with Trackman (ChangeUp -> Changeup) */
function normalizePitchType(s: string): string {
  if (s === "ChangeUp") return "Changeup";
  return s;
}

function canonicalizePlayerRecord(playerIdRaw: string, playerNameRaw?: string | null) {
  const playerId =
    getCanonicalPlayerId(playerIdRaw) ??
    getCanonicalPlayerId(playerNameRaw ?? "") ??
    playerIdRaw.trim();

  return {
    playerId,
    playerName: getCanonicalName(playerId || playerNameRaw || playerIdRaw),
    throws: getHand(playerId),
  };
}

async function loadArsenal(db: { delete: (t: unknown) => Promise<unknown>; insert: (t: unknown) => (opts: { values: unknown[] }) => Promise<unknown> }) {
  const path = join(process.cwd(), "..", "output", "stuff_plus", "stuff_plus_pitcher_arsenal.csv");
  const raw = await readFile(path, "utf-8");
  const { data } = Papa.parse<Record<string, string>>(raw, { header: true });

  const rows = data
    .filter((r) => r.player_id && r.pitch_type)
    .map((r) => {
      const canonical = canonicalizePlayerRecord(
        r.player_id.trim(),
        r.player_name?.trim() ?? null,
      );

      return {
        playerId: canonical.playerId,
        pitchType: normalizePitchType(r.pitch_type.trim()),
        playerName: canonical.playerName,
        throws: canonical.throws ?? r.throws?.trim() ?? null,
        meanStuffPlus: r.mean_StuffPlus ? parseFloat(r.mean_StuffPlus) : null,
        sdStuffPlus: r.sd_StuffPlus ? parseFloat(r.sd_StuffPlus) : null,
        avgVeloMph: r.avg_velo_mph ? parseFloat(r.avg_velo_mph) : null,
        maxFbVelo: r.max_fb_velo ? parseFloat(r.max_fb_velo) : null,
        avgExtFt: r.avg_ext_ft ? parseFloat(r.avg_ext_ft) : null,
        nSessions: r.n_sessions ? parseInt(r.n_sessions, 10) : null,
      };
    });

  await db.delete(stuffPlusArsenal);
  if (rows.length > 0) {
    await db.insert(stuffPlusArsenal).values(rows);
  }
  console.log(`Loaded ${rows.length} arsenal rows`);
}

async function loadOutings(db: { delete: (t: unknown) => Promise<unknown>; insert: (t: unknown) => (opts: { values: unknown[] }) => Promise<unknown> }) {
  const path = join(process.cwd(), "..", "output", "stuff_plus", "stuff_plus_pitchtype_outings.csv");
  const raw = await readFile(path, "utf-8");
  const { data } = Papa.parse<Record<string, string>>(raw, { header: true });

  const seen = new Set<string>();
  const rows = data
    .filter((r) => r.session_key && r.pitch_type)
    .filter((r) => {
      const key = `${r.session_key}|${r.pitch_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => {
      const canonical = canonicalizePlayerRecord(
        r.player_id.trim(),
        r.player_name?.trim() ?? null,
      );

      return {
        sessionKey: r.session_key.trim(),
        playerId: canonical.playerId,
        playerName: canonical.playerName,
        date: r.date?.trim() ?? "",
        pitchType: normalizePitchType(r.pitch_type.trim()),
        throws: canonical.throws ?? r.throws?.trim() ?? null,
        stuffPlus: r.StuffPlus ? parseFloat(r.StuffPlus) : null,
        avgVeloMph: r.avg_velo_mph ? parseFloat(r.avg_velo_mph) : null,
        avgIvbIn: r.avg_ivb_in ? parseFloat(r.avg_ivb_in) : null,
        avgHbIn: r.avg_hb_in ? parseFloat(r.avg_hb_in) : null,
        avgSpinRpm: r.avg_spin_rpm ? parseFloat(r.avg_spin_rpm) : null,
        avgExtFt: r.avg_ext_ft ? parseFloat(r.avg_ext_ft) : null,
      };
    });

  await db.delete(stuffPlusOutings);
  if (rows.length > 0) {
    await db.insert(stuffPlusOutings).values(rows);
  }
  console.log(`Loaded ${rows.length} outing rows`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Ensure .env.local exists.");
    process.exit(1);
  }
  const { db } = await import("../db");
  await loadArsenal(db);
  await loadOutings(db);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
