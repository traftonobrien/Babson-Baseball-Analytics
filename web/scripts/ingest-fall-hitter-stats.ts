/**
 * Ingest fall hitting stats into Supabase from a JSON data file.
 *
 * Usage:
 *   cd web
 *   export $(grep -v '^#' .env.local | xargs)
 *   npx tsx scripts/ingest-fall-hitter-stats.ts <path-to-json>
 *
 * JSON format (array of objects):
 *   [
 *     {
 *       "playerName": "Dylan Drazka",
 *       "playerId": "DDrazka1",       // or null if not in registry
 *       "pa": 31, "ab": 24, "hits": 7,
 *       "singles": 6, "doubles": 0, "triples": 0, "hr": 1,
 *       "bb": 6, "hbp": 1, "k": 0,
 *       "avg": 0.2917, "obp": 0.4516, "slg": 0.4167,
 *       "ops": 0.8683, "woba": 0.3542
 *     },
 *     ...
 *   ]
 *
 * Re-run any time the workbook is updated — rows upsert on (team_id, player_name).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { upsertHitterStats, type UpsertFallHitterStatsInput } from "@/lib/fall/hitterStats";

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: npx tsx scripts/ingest-fall-hitter-stats.ts <path-to-json>");
    process.exit(1);
  }

  const raw = readFileSync(resolve(jsonPath), "utf-8");
  const rows: UpsertFallHitterStatsInput[] = JSON.parse(raw);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("JSON must be a non-empty array of hitter stat objects.");
    process.exit(1);
  }

  console.log(`Ingesting ${rows.length} fall hitter records from ${jsonPath}…`);
  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    try {
      await upsertHitterStats(row);
      console.log(`  ✓ ${row.playerName} (${row.playerId ?? "no id"})`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${row.playerName}: ${err}`);
      fail++;
    }
  }

  console.log(`\nDone. ${ok} upserted, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
