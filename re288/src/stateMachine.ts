/**
 * Half-inning play state machine for RE matrix computation.
 *
 * Adapted from web/lib/runExpectancy/pbpParser.ts — standalone, no web app deps.
 * Takes a RawPbpHalfInning (already parsed from HTML) and produces per-play
 * base/out state snapshots plus runs-to-end-of-inning for each play position.
 */

import type { RawPbpHalfInning, RawPbpPlay } from "./pbpParser.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BaseStateCode =
  | "000" | "100" | "010" | "001"
  | "110" | "101" | "011" | "111";

export interface ParsedBaseState {
  first: boolean;
  second: boolean;
  third: boolean;
}

export interface ParsedPlay {
  rawPlay: RawPbpPlay;
  outsBefore: number;
  outsAfter: number;
  baseStateBefore: ParsedBaseState;
  baseStateAfter: ParsedBaseState;
  baseCodeBefore: BaseStateCode;
  runsScored: number;
  ignored: boolean;
}

export interface ParsedHalfInning {
  rawHalfInning: RawPbpHalfInning;
  plays: ParsedPlay[];
  parsedRuns: number;
  usable: boolean;
  expectedRuns: number | null;
  failureReason: string | null;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Regex constants
// ---------------------------------------------------------------------------

const COUNT_SUFFIX_REGEX = /\s*\([^)]*\)\.?\s*$/;
const BASE_RUNNING_ONLY_REGEX =
  /(advanced to|stole|scored|out at|out on the play|caught stealing|picked off|wild pitch|passed ball|balk|failed pickoff attempt)/i;
const ACTION_VERB_REGEX =
  /\b(walked|intentional walk|hit by pitch|singled|doubled|tripled|homered|reached|grounded|flied|lined|popped|fouled|struck out|infield fly|sacrifice bunt|sacrifice fly|sac bunt|sac fly|advanced to|stole|scored|out at|out on the play|caught stealing|picked off)\b/i;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseHalfInning(raw: RawPbpHalfInning): ParsedHalfInning {
  const state: HalfInningState = {
    bases: { first: null, second: null, third: null },
    outs: 0,
    runs: 0,
  };

  const plays = raw.plays.map((rawPlay) => applyPlay(rawPlay, state));
  const expectedRuns = raw.totals.runs;
  const passed = expectedRuns === null ? true : expectedRuns === state.runs;

  // Back-fill runsToEndOfInning for each play
  const totalRuns = state.runs;
  let runsAfterPlay = 0;
  for (let i = plays.length - 1; i >= 0; i--) {
    runsAfterPlay += plays[i]!.runsScored;
  }

  // Attach runs-to-end-of-inning as a separate pass
  // runsToEnd[i] = runs scored from play i onward (inclusive) to end of inning
  const runsToEnd: number[] = new Array(plays.length).fill(0);
  let runsSoFar = 0;
  for (let i = plays.length - 1; i >= 0; i--) {
    runsSoFar += plays[i]!.runsScored;
    runsToEnd[i] = runsSoFar;
  }

  // Augment plays with runsToEndOfInning
  const augmentedPlays = plays.map((play, i) => ({
    ...play,
    runsToEndOfInning: runsToEnd[i] ?? 0,
  }));

  return {
    rawHalfInning: raw,
    plays: augmentedPlays as ParsedPlay[],
    parsedRuns: totalRuns,
    usable: passed,
    expectedRuns,
    failureReason: passed
      ? null
      : `Expected ${expectedRuns ?? "unknown"} runs but parsed ${totalRuns}`,
  };
}

// RE24 observation: what state was the game in, and how many runs scored after
export interface RE24Observation {
  baseCode: BaseStateCode;
  outs: 0 | 1 | 2;
  runsToEndOfInning: number;
}

export function extractRE24Observations(halfInning: ParsedHalfInning): RE24Observation[] {
  if (!halfInning.usable) return [];

  const obs: RE24Observation[] = [];
  for (const play of halfInning.plays as AugmentedPlay[]) {
    if (play.ignored) continue;
    if (play.outsBefore > 2) continue;
    obs.push({
      baseCode: play.baseCodeBefore,
      outs: play.outsBefore as 0 | 1 | 2,
      runsToEndOfInning: play.runsToEndOfInning,
    });
  }
  return obs;
}

// ---------------------------------------------------------------------------
// Internal play application
// ---------------------------------------------------------------------------

interface AugmentedPlay extends ParsedPlay {
  runsToEndOfInning: number;
}

function applyPlay(rawPlay: RawPbpPlay, state: HalfInningState): ParsedPlay {
  const outsBefore = state.outs;
  const runsBefore = state.runs;
  const baseStateBefore = snapshotBaseState(state.bases);
  const baseCodeBefore = toBaseCode(baseStateBefore);
  const text = rawPlay.playText.trim();

  if (!isTrackableGameAction(text)) {
    return {
      rawPlay,
      outsBefore,
      outsAfter: state.outs,
      baseStateBefore,
      baseStateAfter: snapshotBaseState(state.bases),
      baseCodeBefore,
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

  if (state.outs > 3) state.outs = 3;

  return {
    rawPlay,
    outsBefore,
    outsAfter: state.outs,
    baseStateBefore,
    baseStateAfter: snapshotBaseState(state.bases),
    baseCodeBefore,
    runsScored: state.runs - runsBefore,
    ignored: false,
  };
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
  if (!ACTION_VERB_REGEX.test(actionText)) return;

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
  if (!runnerName) return;

  if (/\bscored\b/i.test(cleanedClause)) {
    scoreRunner(runnerName, state);
    return;
  }

  const advanceTarget = parseAdvanceTarget(cleanedClause);
  if (advanceTarget) { moveRunnerToTarget(runnerName, advanceTarget, state); return; }

  const stealTarget = parseStealTarget(cleanedClause);
  if (stealTarget) { moveRunnerToTarget(runnerName, stealTarget, state); return; }

  if (
    /\bout at\b/i.test(cleanedClause) ||
    /\bout on the play\b/i.test(cleanedClause) ||
    /\bcaught stealing\b/i.test(cleanedClause) ||
    /\bpicked off\b/i.test(cleanedClause)
  ) {
    removeRunner(runnerName, state);
  }
}

// ---------------------------------------------------------------------------
// Runner helpers
// ---------------------------------------------------------------------------

function forceAdvanceForRunner(runnerName: string, state: HalfInningState): void {
  if (state.bases.first && state.bases.second && state.bases.third) {
    scoreRunner(state.bases.third, state);
  }
  if (state.bases.second) { state.bases.third = state.bases.second; state.bases.second = null; }
  if (state.bases.first) { state.bases.second = state.bases.first; state.bases.first = null; }
  state.bases.first = runnerName;
}

function applyImplicitBatterAdvance(
  actionText: string,
  batterName: string,
  state: HalfInningState,
): void {
  const target = parseAdvanceTarget(actionText);
  if (target) moveRunnerToTarget(batterName, target, state);
}

function parseAdvanceTarget(text: string): BaseName | "home" | null {
  const match = text.match(
    /\badvanced(?:\s+from\s+.*?\b)?\s+to\s+(first|second|third|home)(?:\s+base)?\b/i,
  );
  return match ? (match[1]!.toLowerCase() as BaseName | "home") : null;
}

function parseStealTarget(text: string): BaseName | "home" | null {
  const match = text.match(/\bstole (second|third|home)(?:\s+base)?\b/i);
  return match ? (match[1]!.toLowerCase() as BaseName | "home") : null;
}

function moveRunnerToTarget(
  runnerName: string,
  target: BaseName | "home",
  state: HalfInningState,
): void {
  clearRunnerFromBases(runnerName, state.bases);
  if (target === "home") { state.runs += 1; return; }
  state.bases[target] = runnerName;
}

function scoreRunner(runnerName: string, state: HalfInningState): void {
  if (clearRunnerFromBases(runnerName, state.bases)) state.runs += 1;
}

function removeRunner(runnerName: string, state: HalfInningState): void {
  clearRunnerFromBases(runnerName, state.bases);
  state.outs += 1;
}

function clearRunnerFromBases(runnerName: string, bases: OccupiedBases): boolean {
  for (const base of ["first", "second", "third"] as const) {
    if (bases[base] === runnerName) { bases[base] = null; return true; }
  }
  return false;
}

function placeRunnerOnBase(runnerName: string, base: BaseName, bases: OccupiedBases): void {
  clearRunnerFromBases(runnerName, bases);
  bases[base] = runnerName;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function snapshotBaseState(bases: OccupiedBases): ParsedBaseState {
  return { first: Boolean(bases.first), second: Boolean(bases.second), third: Boolean(bases.third) };
}

export function toBaseCode(state: ParsedBaseState): BaseStateCode {
  return `${state.first ? "1" : "0"}${state.second ? "1" : "0"}${state.third ? "1" : "0"}` as BaseStateCode;
}

function isTrackableGameAction(playText: string): boolean {
  return ACTION_VERB_REGEX.test(playText) || BASE_RUNNING_ONLY_REGEX.test(playText);
}

function stripCountSuffix(text: string): string {
  return text.replace(COUNT_SUFFIX_REGEX, "").replace(/\.$/, "").trim();
}

function extractLeadingRunnerName(playText: string): string | null {
  const match = playText.match(
    /^(.+?)\s+(?=(?:walked|intentional walk|hit by pitch|singled|doubled|tripled|homered|reached|grounded|flied|lined|popped|fouled|struck out|infield fly|sacrifice bunt|sacrifice fly|sac bunt|sac fly|advanced to|stole|scored|out at|out on the play|caught stealing|picked off)\b)/i,
  );
  return match?.[1]?.trim() ?? null;
}

function splitPlayClauses(playText: string): string[] {
  return playText.split(";").map((p) => p.trim()).filter(Boolean);
}
