export type FallPitcherOutingType =
  | "bullpen"
  | "live_ab"
  | "intersquad"
  | "scrimmage"
  | "game"
  | "other";

export interface FallPitcherOutingInput {
  pitchTokens: string;
  resultTokens: string;
  fpsTokens: string;
  innings: number | null;
  earnedRuns: number;
  strikeouts: number;
  walks: number;
  hits: number;
}

export interface FallPitcherOutingSummary {
  pitchCount: number;
  strikeCount: number;
  strikePct: number | null;
  firstPitchStrikeCount: number;
  firstPitchStrikePct: number | null;
  whip: number | null;
  era: number | null;
}

const STRIKE_SUFFIXES = new Set(["S", "F", "X"]);
const STRIKE_WORDS = new Set([
  "STRIKE",
  "SWINGINGSTRIKE",
  "CALLEDSTRIKE",
  "FOUL",
  "FOULBALL",
  "INPLAY",
  "INPLAYOUT",
]);

export function splitWorkbookTokens(value: string): string[] {
  return value
    .split(/[\s,;|]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function isWorkbookPitchStrike(token: string): boolean {
  const normalized = token.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) {
    return false;
  }

  if (STRIKE_WORDS.has(normalized)) {
    return true;
  }

  const suffix = normalized.match(/[A-Z]+$/)?.[0] ?? "";
  if (!suffix) {
    return false;
  }

  return STRIKE_SUFFIXES.has(suffix.slice(-1));
}

export function isFpsYes(token: string): boolean {
  const normalized = token.trim().toUpperCase();
  return normalized === "Y" || normalized === "YES" || normalized === "1" || normalized === "TRUE";
}

export function summarizeFallPitcherOuting(
  input: FallPitcherOutingInput,
): FallPitcherOutingSummary {
  const pitchTokens = splitWorkbookTokens(input.pitchTokens);
  const resultTokens = splitWorkbookTokens(input.resultTokens);
  const fpsTokens = splitWorkbookTokens(input.fpsTokens);
  const pitchCount = pitchTokens.length;
  const codedPitchStrikeCount = pitchTokens.filter(isWorkbookPitchStrike).length;
  const strikeCount =
    codedPitchStrikeCount > 0
      ? codedPitchStrikeCount
      : resultTokens.filter(isWorkbookPitchStrike).length;
  const firstPitchStrikeCount = fpsTokens.filter(isFpsYes).length;
  const innings = input.innings ?? 0;

  return {
    pitchCount,
    strikeCount,
    strikePct: pitchCount > 0 ? (strikeCount / pitchCount) * 100 : null,
    firstPitchStrikeCount,
    firstPitchStrikePct:
      fpsTokens.length > 0 ? (firstPitchStrikeCount / fpsTokens.length) * 100 : null,
    whip: innings > 0 ? (input.walks + input.hits) / innings : null,
    era: innings > 0 ? (input.earnedRuns * 9) / innings : null,
  };
}
