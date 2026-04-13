import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildConferenceCanonicalGameIndex } from "../src/gameIndex.ts";
import { listSidearmConferences } from "../src/registry.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(args: string[]): { season: number; conference: string } {
  let season = 2026;
  let conference = "newmac";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--season" && args[i + 1]) {
      season = Number.parseInt(args[i + 1]!, 10);
      i++;
      continue;
    }

    if (args[i] === "--conference" && args[i + 1]) {
      conference = args[i + 1]!.toLowerCase();
      i++;
    }
  }

  return { season, conference };
}

async function main() {
  const { season, conference } = parseArgs(process.argv.slice(2));
  const index = await buildConferenceCanonicalGameIndex(conference, season);
  const outputPath = join(__dirname, "..", "data", `sidearm-game-index-${conference}-${season}.json`);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(index, null, 2));

  console.log(`Built ${index.conferenceName} canonical game index for ${season}`);
  console.log(`Conference: ${index.conferenceId}`);
  console.log(`Programs: ${index.totalPrograms}`);
  console.log(`Canonical games: ${index.totalGames}`);
  console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`Available conferences: ${listSidearmConferences().map((conference) => conference.id).join(", ")}`);
  process.exit(1);
});
