#!/usr/bin/env npx tsx
/**
 * Extracts opponent rosters and handedness from the locally cached NCAA D3 stats.
 *
 * Consumes:
 * - web/public/college-stats/batting-2026.json
 * - web/public/college-stats/pitching-2026.json
 *
 * Produces:
 * - web/public/data/opponents.json
 *   Format: { "Team Name": { "Player Name": { "bats": "L", "throws": "R" } } }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const STATS_DIR = join(__dirname, "../public/college-stats");
const OUTPUT_FILE = join(__dirname, "../public/data/opponents.json");

interface NCAARecord {
  player_name: string;
  team_name: string;
  bats: string | null;
  throws: string | null;
}

type OpponentMap = Record<string, Record<string, { bats: string; throws: string }>>;

function main() {
  const map: OpponentMap = {};

  const processFile = (filename: string) => {
    const path = join(STATS_DIR, filename);
    if (!existsSync(path)) {
      console.warn(`File not found: ${path}`);
      return;
    }

    const data: NCAARecord[] = JSON.parse(readFileSync(path, "utf-8"));

    for (const row of data) {
      if (!row.team_name || !row.player_name) continue;

      const team = row.team_name.trim();
      const player = row.player_name.trim();

      // Normalize missing handedness to "R" as default fallback
      const bats = (row.bats || "R").toUpperCase() === "S" ? "S" : (row.bats || "R").toUpperCase();
      const throws = (row.throws || "R").toUpperCase();

      if (!map[team]) {
        map[team] = {};
      }

      // Avoid overwriting if we already have it (though pitching/batting stats should be identical)
      if (!map[team][player]) {
        map[team][player] = { bats, throws };
      }
    }
  };

  processFile("batting-2026.json");
  processFile("pitching-2026.json");

  const teamCount = Object.keys(map).length;
  let playerCount = 0;
  for (const team of Object.values(map)) {
    playerCount += Object.keys(team).length;
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2));

  console.log(`✅ Extracted NCAA rosters to opponents.json`);
  console.log(`   Teams: ${teamCount}`);
  console.log(`   Players: ${playerCount}`);
}

main();
