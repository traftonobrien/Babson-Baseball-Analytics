#!/usr/bin/env npx tsx
/**
 * Spray Chart Scraper CLI
 *
 * Discovers all 2026 Babson baseball box score URLs and scrapes play-by-play
 * data to build spray chart events for each hitter.
 *
 * Usage:
 *   npx tsx web/scripts/scrape_spray_charts.ts
 *   npx tsx web/scripts/scrape_spray_charts.ts --url https://babsonathletics.com/.../boxscore/16023
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverGameUrls, scrapeBoxScore, loadBabsonRoster } from "../lib/spraychart/scraper";
import type { SprayChartData, SprayChartGame } from "../lib/spraychart/types";

const SCRIPT_DIR = __dirname;
const OUTPUT_PATH = join(SCRIPT_DIR, "../public/data/spray-charts.json");
const DATA_DIR = resolve(SCRIPT_DIR, "../data");

async function main() {
  const args = process.argv.slice(2);
  const singleUrl = args.find((a: string) => a.startsWith("http"));

  // Load Babson roster from local players.json
  console.log("\n📋 Loading Babson roster from players.json...");
  const roster = loadBabsonRoster(DATA_DIR);
  console.log(`   ${roster.size} roster entries loaded\n`);

  let urls: string[];

  if (singleUrl) {
    console.log(`🎯 Scraping single game: ${singleUrl}\n`);
    urls = [singleUrl];
  } else {
    console.log("🔍 Discovering 2026 game URLs from schedule page...\n");
    urls = await discoverGameUrls(2026);
    console.log(`  Found ${urls.length} box score URLs\n`);
  }

  const games: SprayChartGame[] = [];
  let totalEvents = 0;
  let failures = 0;

  for (const url of urls) {
    try {
      const result = await scrapeBoxScore(url, roster);
      console.log(
        `  ✅ ${result.opponent.padEnd(25)} ${result.date}  ${String(result.babsonBipCount).padStart(3)} BIP  (${result.totalPlays} plays parsed)`
      );

      games.push({
        gameId: result.gameId,
        date: result.date,
        opponent: result.opponent,
        url: result.url,
        events: result.events,
      });
      totalEvents += result.babsonBipCount;

      // Be polite — wait 500ms between requests
      if (urls.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      failures++;
      console.log(`  ❌ ${url} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const data: SprayChartData = {
    scrapedAt: new Date().toISOString(),
    season: 2026,
    games: games.sort((a, b) => a.date.localeCompare(b.date)),
  };

  // Ensure output directory exists
  mkdirSync(join(SCRIPT_DIR, "../public/data"), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));

  console.log(`\n✅ Done!`);
  console.log(`   Games: ${games.length}/${urls.length} (${failures} failures)`);
  console.log(`   Total BIP events: ${totalEvents}`);
  console.log(`   Output: ${OUTPUT_PATH}\n`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
