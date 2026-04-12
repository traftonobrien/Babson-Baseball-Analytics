import {
  extractPlayLines,
  fetchPlayByPlayHtml,
} from "../spraychart/scraper";
import { extractCountAndSequence } from "../spraychart/zoneMapper";
import reGameMapEntries from "../../public/data/run-expectancy/re_game_map.json";
import type {
  HalfInningSide,
  PitchCountSnapshot,
  PitchCountState,
  ParsedBaseState,
  ParsedPbpGame,
  ParsedPbpHalfInning,
  ParsedPbpPlay,
  RawPbpGame,
  RawPbpHalfInning,
  RawPbpPlay,
  RawPbpTotals,
  RunExpectancyGameMapEntry,
  SeasonRunExpectancyCorpus,
  SeasonRunExpectancyGameResult,
} from "./types";

const PLAY_BY_PLAY_SECTION_REGEX =
  /<section id="play-by-play">([\s\S]*?)<section id="composite-stats">/i;
const PLAY_BY_PLAY_TABLE_REGEX =
  /(<table class="sidearm-table play-by-play">[\s\S]*?<\/table>)\s*(<dl class="special-stats[\s\S]*?<\/dl>)/gi;
const CAPTION_REGEX = /<caption>([\s\S]*?)<\/caption>/i;
const CAPTION_DETAILS_REGEX = /^(.*?)\s*-\s*(Top|Bottom) of (\d+)(?:st|nd|rd|th)$/i;
const DT_DD_REGEX = /<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi;
const COUNT_SUFFIX_REGEX = /\s*\([^)]*\)\.?\s*$/;
const BASE_RUNNING_ONLY_REGEX =
  /(advanced to|stole|scored|out at|out on the play|caught stealing|picked off|wild pitch|passed ball|balk|failed pickoff attempt)/i;
const ACTION_VERB_REGEX =
  /\b(walked|intentional walk|hit by pitch|singled|doubled|tripled|homered|reached|grounded|flied|lined|popped|fouled|struck out|infield fly|sacrifice bunt|sacrifice fly|sac bunt|sac fly|advanced to|stole|scored|out at|out on the play|caught stealing|picked off)\b/i;
const BALL_PITCH_CODES = new Set(["B", "I", "P"]);
const STRIKE_PITCH_CODES = new Set(["K", "S", "C", "T", "L", "M", "Q"]);
const NO_CHANGE_PITCH_CODES = new Set(["F", "H", "X"]);
const INITIAL_COUNT_STATE: PitchCountState = { balls: 0, strikes: 0, label: "0-0" };
const GAME_PASSING_USABLE_RATIO = 0.75;
const RE_GAME_MAP = new Map(
  (reGameMapEntries as RunExpectancyGameMapEntry[]).map((entry) => [entry.gameId, entry]),
);

type BaseName = "first" | "second" | "third";

interface OccupiedBases {
  first: string | null;
  second: string | null;
  third: string | null;
}

interface HalfInningState {
  bases: OccupiedBases;
  outs: number;
  runs: number;
}

export async function fetchRawPbpGame(url: string): Promise<RawPbpGame> {
  const html = await fetchPlayByPlayHtml(url);
  return parseRawPbpGameFromHtml(html, url);
}

export async function fetchParsedPbpGame(url: string): Promise<ParsedPbpGame> {
  const rawGame = await fetchRawPbpGame(url);
  return parseParsedPbpGame(rawGame);
}

export function parseRawPbpGameFromHtml(
  html: string,
  sourceUrl?: string,
): RawPbpGame {
  return {
    gameId: sourceUrl ? parseGameIdFromUrl(sourceUrl) : null,
    sourceUrl: sourceUrl ?? null,
    halfInnings: parseRawHalfInningsFromHtml(html),
  };
}

export function parseParsedPbpGame(rawGame: RawPbpGame): ParsedPbpGame {
  const halfInnings = rawGame.halfInnings.map(parseHalfInningState);
  const metadata = getGameMapEntry(rawGame.gameId);

  return {
    rawGame,
    metadata,
    halfInnings,
    usableHalfInnings: halfInnings.filter((halfInning) => halfInning.usableForMatrix),
    failedHalfInnings: halfInnings.filter((halfInning) => !halfInning.usableForMatrix),
  };
}

export async function buildSeasonRunExpectancyCorpus(
  urls: string[],
): Promise<SeasonRunExpectancyCorpus> {
  const scopedUrls = urls.filter((url) => {
    const gameId = parseGameIdFromUrl(url);
    return Boolean(gameId && RE_GAME_MAP.has(gameId));
  });
  const games: SeasonRunExpectancyGameResult[] = [];
  const failureReasons = new Map<string, number>();
  let totalUsableHalfInnings = 0;
  let totalFailedHalfInnings = 0;

  for (const url of scopedUrls) {
    try {
      const parsedGame = await fetchParsedPbpGame(url);
      const usableHalfInnings = parsedGame.usableHalfInnings.length;
      const failedHalfInnings = parsedGame.failedHalfInnings.length;
      const usableRatio = calculateUsableRatio(usableHalfInnings, failedHalfInnings);
      const passed = usableRatio >= GAME_PASSING_USABLE_RATIO;
      const gameFailureReasons = parsedGame.failedHalfInnings
        .map((halfInning) => halfInning.validation.reason)
        .filter((reason): reason is string => Boolean(reason));

      totalUsableHalfInnings += usableHalfInnings;
      totalFailedHalfInnings += failedHalfInnings;

      for (const reason of gameFailureReasons) {
        failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
      }

      games.push({
        gameId: parsedGame.rawGame.gameId,
        sourceUrl: url,
        metadata: parsedGame.metadata,
        parsedGame,
        passed,
        usableHalfInnings,
        failedHalfInnings,
        usableRatio,
        failureReasons: gameFailureReasons,
      });
    } catch (error) {
      const gameId = parseGameIdFromUrl(url);
      const reason = error instanceof Error ? error.message : `Unknown error fetching ${url}`;

      totalFailedHalfInnings += 1;
      failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);

      games.push({
        gameId,
        sourceUrl: url,
        metadata: getGameMapEntry(gameId),
        parsedGame: null,
        passed: false,
        usableHalfInnings: 0,
        failedHalfInnings: 1,
        usableRatio: 0,
        failureReasons: [reason],
      });
    }
  }

  const passingGames = games.filter((game) => game.passed).length;

  return {
    games,
    totalGames: games.length,
    passingGames,
    failedGames: games.length - passingGames,
    totalUsableHalfInnings,
    totalFailedHalfInnings,
    failureReasons: Object.fromEntries(
      [...failureReasons.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

export function parseHalfInningState(
  rawHalfInning: RawPbpHalfInning,
): ParsedPbpHalfInning {
  const state: HalfInningState = {
    bases: { first: null, second: null, third: null },
    outs: 0,
    runs: 0,
  };

  const plays = rawHalfInning.plays.map((rawPlay) => applyPlay(rawPlay, state));
  const expectedRuns = rawHalfInning.totals.runs;
  const passed = expectedRuns === null ? true : expectedRuns === state.runs;

  return {
    rawHalfInning,
    plays,
    parsedRuns: state.runs,
    validation: {
      passed,
      expectedRuns,
      parsedRuns: state.runs,
      reason: passed
        ? null
        : `Expected ${expectedRuns ?? "unknown"} runs but parsed ${state.runs}`,
    },
    usableForMatrix: passed,
  };
}

export function parseRawHalfInningsFromHtml(html: string): RawPbpHalfInning[] {
  const sectionHtml = extractPlayByPlaySectionHtml(html);
  if (!sectionHtml) {
    return [];
  }

  const uniqueHalfInnings = new Map<string, RawPbpHalfInning>();

  for (const match of sectionHtml.matchAll(PLAY_BY_PLAY_TABLE_REGEX)) {
    const tableHtml = match[1] ?? "";
    const totalsHtml = match[2] ?? "";
    const caption = extractCaption(tableHtml);
    const details = parseCaptionDetails(caption);

    if (!details) {
      continue;
    }

    const playLines = extractPlayLines(tableHtml, { dedupe: false });
    if (playLines.length === 0) {
      continue;
    }

    const plays = playLines.map((playText, index) => ({
      inning: details.inning,
      halfInning: details.halfInning,
      playIndex: index,
      playText,
      dedupKey: buildPlayDedupKey(
        details.inning,
        details.halfInning,
        playText,
        index,
      ),
    }));

    const halfInningKey = buildHalfInningKey(
      details.inning,
      details.halfInning,
      playLines,
    );

    if (uniqueHalfInnings.has(halfInningKey)) {
      continue;
    }

    uniqueHalfInnings.set(halfInningKey, {
      key: halfInningKey,
      caption,
      inning: details.inning,
      halfInning: details.halfInning,
      offenseTeam: details.offenseTeam,
      playLines,
      plays,
      totals: parseHalfInningTotals(totalsHtml),
    });
  }

  return [...uniqueHalfInnings.values()].sort(compareHalfInnings);
}

function compareHalfInnings(a: RawPbpHalfInning, b: RawPbpHalfInning): number {
  if (a.inning !== b.inning) {
    return a.inning - b.inning;
  }

  if (a.halfInning === b.halfInning) {
    return 0;
  }

  return a.halfInning === "top" ? -1 : 1;
}

function extractPlayByPlaySectionHtml(html: string): string {
  const normalized = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const sectionMatch = normalized.match(PLAY_BY_PLAY_SECTION_REGEX);
  return sectionMatch?.[1] ?? "";
}

function extractCaption(tableHtml: string): string {
  const captionMatch = tableHtml.match(CAPTION_REGEX);
  return stripHtml(captionMatch?.[1] ?? "");
}

function parseCaptionDetails(
  caption: string,
): { offenseTeam: string; halfInning: HalfInningSide; inning: number } | null {
  const match = caption.match(CAPTION_DETAILS_REGEX);
  if (!match) {
    return null;
  }

  return {
    offenseTeam: match[1]!.trim(),
    halfInning: match[2]!.toLowerCase() as HalfInningSide,
    inning: Number.parseInt(match[3]!, 10),
  };
}

function parseHalfInningTotals(totalsHtml: string): RawPbpTotals {
  const stats = new Map<string, number>();

  for (const match of totalsHtml.matchAll(DT_DD_REGEX)) {
    const label = stripHtml(match[1] ?? "").toLowerCase();
    const rawValue = stripHtml(match[2] ?? "");
    const value = Number.parseInt(rawValue, 10);

    if (Number.isFinite(value)) {
      stats.set(label, value);
    }
  }

  return {
    runs: stats.get("runs") ?? null,
    hits: stats.get("hits") ?? null,
    errors: stats.get("errors") ?? null,
    leftOnBase: stats.get("left on base") ?? null,
  };
}

export function parseCountState(count: string | null): PitchCountState | null {
  if (!count) {
    return null;
  }

  const match = count.match(/^([0-3])-([0-2])$/);
  if (!match) {
    return null;
  }

  const balls = Number.parseInt(match[1]!, 10);
  const strikes = Number.parseInt(match[2]!, 10);

  return formatCountState(balls, strikes);
}

export function deriveCountSnapshots(pitchSequence: string | null): PitchCountSnapshot[] {
  if (!pitchSequence) {
    return [];
  }

  const snapshots: PitchCountSnapshot[] = [];
  let current = cloneCountState(INITIAL_COUNT_STATE);

  for (const [index, pitchCode] of [...pitchSequence].entries()) {
    const countBefore = cloneCountState(current);
    current = applyPitchCode(current, pitchCode);

    snapshots.push({
      pitchNumber: index + 1,
      pitchCode,
      countBefore,
      countAfter: cloneCountState(current),
    });
  }

  return snapshots;
}

export function derivePlayCountContext(playText: string): {
  count: string | null;
  pitchSequence: string | null;
  countSnapshots: PitchCountSnapshot[];
  finalCount: PitchCountState | null;
  countBeforeTerminalPitch: PitchCountState | null;
  terminalPitchRecorded: boolean;
} {
  const { count, pitchSequence } = extractCountAndSequence(playText);
  const parsedFinalCount = parseCountState(count);
  const countSnapshots = deriveCountSnapshots(pitchSequence);
  const derivedFinalCount = countSnapshots.at(-1)?.countAfter ?? null;
  const finalCount = parsedFinalCount ?? derivedFinalCount;
  const terminalPitchRecorded = isTerminalPitchRecorded(playText, pitchSequence);
  const countBeforeTerminalPitch = terminalPitchRecorded
    ? countSnapshots.at(-1)?.countBefore ?? finalCount
    : finalCount;

  return {
    count,
    pitchSequence,
    countSnapshots,
    finalCount,
    countBeforeTerminalPitch,
    terminalPitchRecorded,
  };
}

function applyPlay(rawPlay: RawPbpPlay, state: HalfInningState): ParsedPbpPlay {
  const outsBefore = state.outs;
  const runsBefore = state.runs;
  const baseStateBefore = snapshotBaseState(state.bases);
  const text = rawPlay.playText.trim();
  const countContext = derivePlayCountContext(text);

  if (!isTrackableGameAction(text)) {
    return {
      rawPlay,
      outsBefore,
      outsAfter: state.outs,
      baseStateBefore,
      baseStateAfter: snapshotBaseState(state.bases),
      count: countContext.count,
      pitchSequence: countContext.pitchSequence,
      countSnapshots: countContext.countSnapshots,
      finalCount: countContext.finalCount,
      countBeforeTerminalPitch: countContext.countBeforeTerminalPitch,
      terminalPitchRecorded: countContext.terminalPitchRecorded,
      runsScored: 0,
      ignored: true,
    };
  }

  const clauses = splitPlayClauses(text);
  const anchorClause = clauses[0] ?? text;
  const trailingClauses = clauses.slice(1);

  applyAnchorClause(anchorClause, trailingClauses, state);
  for (const clause of trailingClauses) {
    applyNamedRunnerClause(clause, state);
  }

  if (state.outs > 3) {
    state.outs = 3;
  }

  return {
    rawPlay,
    outsBefore,
    outsAfter: state.outs,
    baseStateBefore,
    baseStateAfter: snapshotBaseState(state.bases),
    count: countContext.count,
    pitchSequence: countContext.pitchSequence,
    countSnapshots: countContext.countSnapshots,
    finalCount: countContext.finalCount,
    countBeforeTerminalPitch: countContext.countBeforeTerminalPitch,
    terminalPitchRecorded: countContext.terminalPitchRecorded,
    runsScored: state.runs - runsBefore,
    ignored: false,
  };
}

function applyPitchCode(state: PitchCountState, pitchCode: string): PitchCountState {
  const normalizedPitchCode = pitchCode.toUpperCase();

  if (BALL_PITCH_CODES.has(normalizedPitchCode)) {
    return formatCountState(Math.min(state.balls + 1, 3), state.strikes);
  }

  if (STRIKE_PITCH_CODES.has(normalizedPitchCode)) {
    return formatCountState(state.balls, Math.min(state.strikes + 1, 2));
  }

  if (NO_CHANGE_PITCH_CODES.has(normalizedPitchCode)) {
    if (normalizedPitchCode === "F" && state.strikes < 2) {
      return formatCountState(state.balls, state.strikes + 1);
    }

    return cloneCountState(state);
  }

  return cloneCountState(state);
}

function isTerminalPitchRecorded(
  playText: string,
  pitchSequence: string | null,
): boolean {
  const lastPitchCode = pitchSequence?.at(-1)?.toUpperCase();
  if (!lastPitchCode) {
    return false;
  }

  if (lastPitchCode === "X" || lastPitchCode === "H") {
    return true;
  }

  if (/\bintentional walk\b/i.test(playText) || /\bwalked\b/i.test(playText)) {
    return BALL_PITCH_CODES.has(lastPitchCode);
  }

  if (/\bstruck out\b/i.test(playText)) {
    return STRIKE_PITCH_CODES.has(lastPitchCode);
  }

  if (/\bhit by pitch\b/i.test(playText)) {
    return lastPitchCode === "H";
  }

  return false;
}

function applyAnchorClause(
  anchorClause: string,
  trailingClauses: string[],
  state: HalfInningState,
): void {
  const cleanedClause = stripCountSuffix(anchorClause);
  const batterName = extractLeadingRunnerName(cleanedClause);

  if (!batterName) {
    applyNamedRunnerClause(cleanedClause, state);
    return;
  }

  const actionText = cleanedClause.slice(batterName.length).trim();
  if (!ACTION_VERB_REGEX.test(actionText)) {
    return;
  }

  if (
    /\badvanced to\b/i.test(actionText) ||
    /\bstole\b/i.test(actionText) ||
    /\bscored\b/i.test(actionText) ||
    /\bout at\b/i.test(actionText) ||
    /\bout on the play\b/i.test(actionText) ||
    /\bcaught stealing\b/i.test(actionText) ||
    /\bpicked off\b/i.test(actionText)
  ) {
    applyNamedRunnerClause(cleanedClause, state);
    return;
  }

  const hasTrailingRunnerOut = trailingClauses.some((clause) =>
    /\bout (?:at|on the play)\b/i.test(clause),
  );

  if (/\bintentional walk\b/i.test(actionText) || /\bwalked\b/i.test(actionText)) {
    forceAdvanceForRunner(batterName, state);
    applyImplicitBatterAdvance(actionText, batterName, state);
    return;
  }

  if (/\bhit by pitch\b/i.test(actionText)) {
    forceAdvanceForRunner(batterName, state);
    applyImplicitBatterAdvance(actionText, batterName, state);
    return;
  }

  if (/\bhomered\b/i.test(actionText)) {
    clearRunnerFromBases(batterName, state.bases);
    state.runs += 1;
    return;
  }

  if (/\btripled\b/i.test(actionText)) {
    placeRunnerOnBase(batterName, "third", state.bases);
    applyImplicitBatterAdvance(actionText, batterName, state);
    return;
  }

  if (/\bdoubled\b/i.test(actionText)) {
    placeRunnerOnBase(batterName, "second", state.bases);
    applyImplicitBatterAdvance(actionText, batterName, state);
    return;
  }

  if (/\bsingled\b/i.test(actionText)) {
    placeRunnerOnBase(batterName, "first", state.bases);
    applyImplicitBatterAdvance(actionText, batterName, state);
    return;
  }

  if (/\breached\b/i.test(actionText)) {
    placeRunnerOnBase(batterName, "first", state.bases);
    applyImplicitBatterAdvance(actionText, batterName, state);
    return;
  }

  if (/\bdouble play\b/i.test(actionText)) {
    state.outs += hasTrailingRunnerOut ? 1 : 2;
    clearRunnerFromBases(batterName, state.bases);
    return;
  }

  if (
    /\bstruck out\b/i.test(actionText) ||
    /\bsacrifice bunt\b/i.test(actionText) ||
    /\bsac bunt\b/i.test(actionText) ||
    /\bsacrifice fly\b/i.test(actionText) ||
    /\bsac fly\b/i.test(actionText) ||
    /\bflied out\b/i.test(actionText) ||
    /\bgrounded out\b/i.test(actionText) ||
    /\blined out\b/i.test(actionText) ||
    /\bpopped out\b/i.test(actionText) ||
    /\bfouled out\b/i.test(actionText) ||
    /\binfield fly\b/i.test(actionText)
  ) {
    state.outs += 1;
    clearRunnerFromBases(batterName, state.bases);
    return;
  }
}

function applyNamedRunnerClause(clause: string, state: HalfInningState): void {
  const cleanedClause = stripCountSuffix(clause);
  const runnerName = extractLeadingRunnerName(cleanedClause);

  if (!runnerName) {
    return;
  }

  if (/\bscored\b/i.test(cleanedClause)) {
    scoreRunner(runnerName, state);
    return;
  }

  const advanceTarget = parseAdvanceTarget(cleanedClause);
  if (advanceTarget) {
    moveRunnerToTarget(runnerName, advanceTarget, state);
    return;
  }

  const stealTarget = parseStealTarget(cleanedClause);
  if (stealTarget) {
    moveRunnerToTarget(runnerName, stealTarget, state);
    return;
  }

  if (
    /\bout at\b/i.test(cleanedClause) ||
    /\bout on the play\b/i.test(cleanedClause) ||
    /\bcaught stealing\b/i.test(cleanedClause) ||
    /\bpicked off\b/i.test(cleanedClause)
  ) {
    removeRunner(runnerName, state);
  }
}

function splitPlayClauses(playText: string): string[] {
  return playText
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function isTrackableGameAction(playText: string): boolean {
  return ACTION_VERB_REGEX.test(playText) || BASE_RUNNING_ONLY_REGEX.test(playText);
}

function stripCountSuffix(playText: string): string {
  return playText
    .replace(COUNT_SUFFIX_REGEX, "")
    .replace(/\.$/, "")
    .trim();
}

function extractLeadingRunnerName(playText: string): string | null {
  const match = playText.match(
    /^(.+?)\s+(?=(?:walked|intentional walk|hit by pitch|singled|doubled|tripled|homered|reached|grounded|flied|lined|popped|fouled|struck out|infield fly|sacrifice bunt|sacrifice fly|sac bunt|sac fly|advanced to|stole|scored|out at|out on the play|caught stealing|picked off)\b)/i,
  );
  return match?.[1]?.trim() ?? null;
}

function forceAdvanceForRunner(runnerName: string, state: HalfInningState): void {
  if (state.bases.first && state.bases.second && state.bases.third) {
    scoreRunner(state.bases.third, state);
  }
  if (state.bases.second) {
    state.bases.third = state.bases.second;
    state.bases.second = null;
  }
  if (state.bases.first) {
    state.bases.second = state.bases.first;
    state.bases.first = null;
  }
  state.bases.first = runnerName;
}

function applyImplicitBatterAdvance(
  actionText: string,
  batterName: string,
  state: HalfInningState,
): void {
  const target = parseAdvanceTarget(actionText);
  if (!target) {
    return;
  }

  moveRunnerToTarget(batterName, target, state);
}

function parseAdvanceTarget(text: string): BaseName | "home" | null {
  const match = text.match(
    /\badvanced(?:\s+from\s+.*?\b)?\s+to\s+(first|second|third|home)(?:\s+base)?\b/i,
  );
  if (!match) {
    return null;
  }

  return match[1]!.toLowerCase() as BaseName | "home";
}

function parseStealTarget(text: string): BaseName | "home" | null {
  const match = text.match(/\bstole (second|third|home)(?:\s+base)?\b/i);
  if (!match) {
    return null;
  }

  return match[1]!.toLowerCase() as BaseName | "home";
}

function moveRunnerToTarget(
  runnerName: string,
  target: BaseName | "home",
  state: HalfInningState,
): void {
  clearRunnerFromBases(runnerName, state.bases);

  if (target === "home") {
    state.runs += 1;
    return;
  }

  state.bases[target] = runnerName;
}

function scoreRunner(runnerName: string, state: HalfInningState): void {
  if (clearRunnerFromBases(runnerName, state.bases)) {
    state.runs += 1;
  }
}

function removeRunner(runnerName: string, state: HalfInningState): void {
  clearRunnerFromBases(runnerName, state.bases);
  state.outs += 1;
}

function clearRunnerFromBases(
  runnerName: string,
  bases: OccupiedBases,
): boolean {
  for (const base of ["first", "second", "third"] as const) {
    if (bases[base] === runnerName) {
      bases[base] = null;
      return true;
    }
  }

  return false;
}

function clearAllBases(bases: OccupiedBases): void {
  bases.first = null;
  bases.second = null;
  bases.third = null;
}

function placeRunnerOnBase(
  runnerName: string,
  base: BaseName,
  bases: OccupiedBases,
): void {
  clearRunnerFromBases(runnerName, bases);
  bases[base] = runnerName;
}

function snapshotBaseState(bases: OccupiedBases): ParsedBaseState {
  return {
    first: Boolean(bases.first),
    second: Boolean(bases.second),
    third: Boolean(bases.third),
  };
}

function parseGameIdFromUrl(url: string): string | null {
  return url.match(/boxscore\/(\d+)/)?.[1] ?? null;
}

function getGameMapEntry(gameId: string | null): RunExpectancyGameMapEntry | null {
  if (!gameId) {
    return null;
  }

  return RE_GAME_MAP.get(gameId) ?? null;
}

function formatCountState(balls: number, strikes: number): PitchCountState {
  return {
    balls,
    strikes,
    label: `${balls}-${strikes}`,
  };
}

function cloneCountState(state: PitchCountState): PitchCountState {
  return {
    balls: state.balls,
    strikes: state.strikes,
    label: state.label,
  };
}

function calculateUsableRatio(
  usableHalfInnings: number,
  failedHalfInnings: number,
): number {
  const totalHalfInnings = usableHalfInnings + failedHalfInnings;
  if (totalHalfInnings === 0) {
    return 0;
  }

  return usableHalfInnings / totalHalfInnings;
}

function buildHalfInningKey(
  inning: number,
  halfInning: HalfInningSide,
  playLines: string[],
): string {
  return `${inning}:${halfInning}:${playLines.join("|")}`;
}

function buildPlayDedupKey(
  inning: number,
  halfInning: HalfInningSide,
  playText: string,
  playIndex: number,
): string {
  return `${inning}:${halfInning}:${playIndex}:${playText}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
