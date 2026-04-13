import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalGameIndex } from "../src/gameIndex.ts";
import { buildPbpCorpusFromIndex } from "../src/pbpFetch.ts";

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
  const indexPath = join(__dirname, "..", "data", `sidearm-game-index-${conference}-${season}.json`);
  const outputPath = join(__dirname, "..", "data", `pbp-corpus-${conference}-${season}.json`);

  const index = JSON.parse(readFileSync(indexPath, "utf8")) as CanonicalGameIndex;
  const corpus = await buildPbpCorpusFromIndex(index);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(corpus, null, 2));

  console.log(`Built ${corpus.conferenceName} PBP corpus for ${season}`);
  console.log(`Conference: ${corpus.conferenceId}`);
  console.log(`Parsed games: ${corpus.parsedGames}/${corpus.totalGames}`);
  console.log(`Failed games: ${corpus.failedGames}`);
  console.log(`Total half-innings: ${corpus.totalHalfInnings}`);
  console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
