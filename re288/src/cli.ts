import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCanonicalGameIndexForConference,
  type CanonicalGameIndex,
} from "./gameIndex.ts";
import { buildPbpCorpusFromIndex, type PbpCorpusFile } from "./pbpFetch.ts";
import {
  buildManifestValidationSummary,
  listAvailableConferenceIds,
  loadManifestFromFile,
  resolveManifest,
} from "./manifest.ts";
import {
  buildPooledCanonicalGameIndex,
  buildPooledPbpCorpus,
} from "./pool.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, "..", "data");

export async function runCli(argv: string[]): Promise<number> {
  const [command, subcommand, ...rest] = argv;

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return 0;
  }

  if (command === "manifest" && subcommand === "validate") {
    return runManifestValidate(rest);
  }

  if (command === "index" && subcommand === "build") {
    return runIndexBuild(rest);
  }

  if (command === "pbp" && subcommand === "build") {
    return runPbpBuild(rest);
  }

  if (command === "pool" && subcommand === "build") {
    return runPoolBuild(rest);
  }

  if (command === "master" && subcommand === "update") {
    return runMasterUpdate(rest);
  }

  throw new Error(`Unknown command '${[command, subcommand].filter(Boolean).join(" ")}'.`);
}

async function runManifestValidate(args: string[]): Promise<number> {
  const filePath = requireFlagValue(args, "--file");
  const manifest = resolveManifest(loadManifestFromFile(filePath), filePath);
  console.log(JSON.stringify(buildManifestValidationSummary(manifest), null, 2));
  return 0;
}

async function runIndexBuild(args: string[]): Promise<number> {
  const season = parseSeasonArg(args);
  const manifestPath = optionalFlagValue(args, "--manifest");
  const conferenceId = optionalFlagValue(args, "--conference");

  if (manifestPath) {
    const manifest = resolveManifest(loadManifestFromFile(manifestPath), manifestPath);
    const indexes = await buildIndexesForManifest(manifest, season);
    const outputPaths = indexes.map((index) => writeIndexFile(index, buildIndexOutputPath(index.conferenceId, index.season)));
    console.log(JSON.stringify({
      season: manifest.season,
      mode: "manifest",
      conferences: indexes.map((index) => index.conferenceId),
      outputPaths,
    }, null, 2));
    return 0;
  }

  if (!conferenceId) {
    throw new Error("index build requires either --conference <id> or --manifest <file>.");
  }

  const manifest = resolveManifest({
    season,
    conferences: [{ id: conferenceId }],
  });
  const indexes = await buildIndexesForManifest(manifest, season);
  const index = indexes[0]!;
  writeIndexFile(index, buildIndexOutputPath(index.conferenceId, index.season));
  console.log(JSON.stringify({
    conferenceId: index.conferenceId,
    totalGames: index.totalGames,
    outputPath: buildIndexOutputPath(index.conferenceId, index.season),
  }, null, 2));
  return 0;
}

async function runPbpBuild(args: string[]): Promise<number> {
  const season = parseSeasonArg(args);
  const manifestPath = optionalFlagValue(args, "--manifest");
  const conferenceId = optionalFlagValue(args, "--conference");

  if (manifestPath) {
    const manifest = resolveManifest(loadManifestFromFile(manifestPath), manifestPath);
    const indexes = await readOrBuildIndexesForManifest(manifest, season);
    const corpora = await buildCorporaForIndexes(indexes);
    const outputPaths = corpora.map((corpus) => writeCorpusFile(corpus, buildCorpusOutputPath(corpus.conferenceId, corpus.season)));
    console.log(JSON.stringify({
      season: manifest.season,
      mode: "manifest",
      conferences: corpora.map((corpus) => corpus.conferenceId),
      outputPaths,
    }, null, 2));
    return 0;
  }

  if (!conferenceId) {
    throw new Error("pbp build requires either --conference <id> or --manifest <file>.");
  }

  const index = await readOrBuildIndexForConference(conferenceId, season);
  const corpus = await buildPbpCorpusFromIndex(index);
  writeCorpusFile(corpus, buildCorpusOutputPath(corpus.conferenceId, corpus.season));
  console.log(JSON.stringify({
    conferenceId: corpus.conferenceId,
    parsedGames: corpus.parsedGames,
    totalGames: corpus.totalGames,
    outputPath: buildCorpusOutputPath(corpus.conferenceId, corpus.season),
  }, null, 2));
  return 0;
}

async function runPoolBuild(args: string[]): Promise<number> {
  const season = parseSeasonArg(args);
  const manifestPath = requireFlagValue(args, "--manifest");
  const manifest = resolveManifest(loadManifestFromFile(manifestPath), manifestPath);
  const indexes = await readOrBuildIndexesForManifest(manifest, season);
  const corpora = await readOrBuildCorporaForIndexes(indexes);

  const pooledIndex = buildPooledCanonicalGameIndex(manifest.poolId, indexes);
  const pooledCorpus = buildPooledPbpCorpus(manifest.poolId, corpora);

  const pooledIndexPath = buildIndexOutputPath(manifest.poolId, manifest.season);
  const pooledCorpusPath = buildCorpusOutputPath(manifest.poolId, manifest.season);

  writeJson(pooledIndexPath, pooledIndex);
  writeJson(pooledCorpusPath, pooledCorpus);

  console.log(JSON.stringify({
    poolId: manifest.poolId,
    conferenceIds: manifest.conferences.map((conference) => conference.id),
    pooledIndexPath,
    pooledCorpusPath,
    totalGames: pooledCorpus.totalGames,
    parsedGames: pooledCorpus.parsedGames,
  }, null, 2));
  return 0;
}

async function runMasterUpdate(args: string[]): Promise<number> {
  const season = parseSeasonArg(args);
  const manifestPath = requireFlagValue(args, "--manifest");
  const manifest = resolveManifest(loadManifestFromFile(manifestPath), manifestPath);

  const indexes = await buildIndexesForManifest(manifest, season);
  indexes.forEach((index) => writeIndexFile(index, buildIndexOutputPath(index.conferenceId, index.season)));

  const corpora = await buildCorporaForIndexes(indexes);
  corpora.forEach((corpus) => writeCorpusFile(corpus, buildCorpusOutputPath(corpus.conferenceId, corpus.season)));

  const pooledIndex = buildPooledCanonicalGameIndex(manifest.poolId, indexes);
  const pooledCorpus = buildPooledPbpCorpus(manifest.poolId, corpora);
  const pooledIndexPath = buildIndexOutputPath(manifest.poolId, manifest.season);
  const pooledCorpusPath = buildCorpusOutputPath(manifest.poolId, manifest.season);

  writeJson(pooledIndexPath, pooledIndex);
  writeJson(pooledCorpusPath, pooledCorpus);

  console.log(JSON.stringify({
    season: manifest.season,
    poolId: manifest.poolId,
    conferences: manifest.conferences.map((conference) => conference.id),
    builtIndexes: indexes.length,
    builtCorpora: corpora.length,
    pooledIndexPath,
    pooledCorpusPath,
    totalGames: pooledCorpus.totalGames,
    parsedGames: pooledCorpus.parsedGames,
    failedGames: pooledCorpus.failedGames,
    note: "Standalone pooled RE matrix build is the next layer after this command.",
  }, null, 2));
  return 0;
}

async function buildIndexesForManifest(
  manifest: ReturnType<typeof resolveManifest>,
  season: number,
): Promise<CanonicalGameIndex[]> {
  const indexes: CanonicalGameIndex[] = [];

  for (const conference of manifest.conferences) {
    indexes.push(await buildCanonicalGameIndexForConference(conference, season));
  }

  return indexes;
}

async function readOrBuildIndexesForManifest(
  manifest: ReturnType<typeof resolveManifest>,
  season: number,
): Promise<CanonicalGameIndex[]> {
  const indexes: CanonicalGameIndex[] = [];

  for (const conference of manifest.conferences) {
    indexes.push(await readOrBuildIndexForConference(conference.id, season, conference));
  }

  return indexes;
}

async function buildCorporaForIndexes(indexes: CanonicalGameIndex[]): Promise<PbpCorpusFile[]> {
  const corpora: PbpCorpusFile[] = [];
  for (const index of indexes) {
    corpora.push(await buildPbpCorpusFromIndex(index));
  }
  return corpora;
}

async function readOrBuildCorporaForIndexes(indexes: CanonicalGameIndex[]): Promise<PbpCorpusFile[]> {
  const corpora: PbpCorpusFile[] = [];

  for (const index of indexes) {
    const outputPath = buildCorpusOutputPath(index.conferenceId, index.season);
    try {
      corpora.push(readCorpusFile(outputPath));
    } catch {
      const corpus = await buildPbpCorpusFromIndex(index);
      writeCorpusFile(corpus, outputPath);
      corpora.push(corpus);
    }
  }

  return corpora;
}

async function readOrBuildIndexForConference(
  conferenceId: string,
  season: number,
  conferenceOverride?: ReturnType<typeof resolveManifest>["conferences"][number],
): Promise<CanonicalGameIndex> {
  const outputPath = buildIndexOutputPath(conferenceId, season);

  try {
    return readIndexFile(outputPath);
  } catch {
    const conference = conferenceOverride ?? resolveManifest({
      season,
      conferences: [{ id: conferenceId }],
    }).conferences[0]!;
    const index = await buildCanonicalGameIndexForConference(conference, season);
    writeIndexFile(index, outputPath);
    return index;
  }
}

function buildIndexOutputPath(conferenceId: string, season: number): string {
  return join(DATA_DIR, `sidearm-game-index-${conferenceId}-${season}.json`);
}

function buildCorpusOutputPath(conferenceId: string, season: number): string {
  return join(DATA_DIR, `pbp-corpus-${conferenceId}-${season}.json`);
}

function writeIndexFile(index: CanonicalGameIndex, outputPath: string): string {
  writeJson(outputPath, index);
  return outputPath;
}

function writeCorpusFile(corpus: PbpCorpusFile, outputPath: string): string {
  writeJson(outputPath, corpus);
  return outputPath;
}

function writeJson(outputPath: string, value: unknown): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(value, null, 2));
}

function readIndexFile(path: string): CanonicalGameIndex {
  return JSON.parse(readFileSync(path, "utf8")) as CanonicalGameIndex;
}

function readCorpusFile(path: string): PbpCorpusFile {
  return JSON.parse(readFileSync(path, "utf8")) as PbpCorpusFile;
}

function parseSeasonArg(args: string[]): number {
  const value = optionalFlagValue(args, "--season");
  if (!value) {
    return 2026;
  }

  const season = Number.parseInt(value, 10);
  if (!Number.isInteger(season) || season < 2000) {
    throw new Error(`Invalid --season value '${value}'.`);
  }

  return season;
}

function requireFlagValue(args: string[], flag: string): string {
  const value = optionalFlagValue(args, flag);
  if (!value) {
    throw new Error(`Missing required flag ${flag}.`);
  }
  return value;
}

function optionalFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

function printHelp(): void {
  const availableConferences = listAvailableConferenceIds().join(", ");
  console.log(`
re288 native CLI

Commands:
  manifest validate --file <manifest.json>
  index build --conference <id> [--season 2026]
  index build --manifest <manifest.json> [--season 2026]
  pbp build --conference <id> [--season 2026]
  pbp build --manifest <manifest.json> [--season 2026]
  pool build --manifest <manifest.json> [--season 2026]
  master update --manifest <manifest.json> [--season 2026]

Available registry conferences:
  ${availableConferences}

Example:
  re288 manifest validate --file manifests/starter-pack-2026.json
  re288 pool build --manifest manifests/starter-pack-2026.json
  re288 master update --manifest manifests/starter-pack-2026.json
`.trim());
}
