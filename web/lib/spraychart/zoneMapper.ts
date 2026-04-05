/**
 * Maps play-by-play text from babsonathletics.com to spray chart zones
 * and batted ball types.
 *
 * PBP patterns observed:
 *   "singled to right field"
 *   "grounded out to ss"
 *   "flied out to cf"
 *   "lined into double play 3b to 2b"
 *   "doubled to left center"
 *   "homered to left field"
 *   "singled through the right side"
 *   "singled up the middle"
 *   "doubled down the left-field line"
 *   "popped up to ss"
 *   "reached on an error by ss"
 *   "reached on a fielder's choice"
 */

import type { BattedBallType, HitResult, SprayZone } from "./types";

// ── Batted ball type detection ────────────────────────────────────────

const GROUND_BALL_PATTERNS = [
  /\bgrounded\b/i,
  /\bsingled through\b/i,
  /\bsingled up the middle\b/i,
  /\breached on a fielder'?s choice\b/i,
];

const FLY_BALL_PATTERNS = [
  /\bflied out\b/i,
  /\bfly out\b/i,
  /\bhomered\b/i,
  /\bhit a sacrifice fly\b/i,
  /\bsac fly\b/i,
];

const LINE_DRIVE_PATTERNS = [
  /\blined\b/i,
  /\bline drive\b/i,
];

const POPUP_PATTERNS = [
  /\bpopped up\b/i,
  /\bpopped out\b/i,
  /\bpop up\b/i,
];

export function classifyBattedBallType(text: string): BattedBallType {
  for (const pattern of POPUP_PATTERNS) {
    if (pattern.test(text)) return "popup";
  }
  for (const pattern of LINE_DRIVE_PATTERNS) {
    if (pattern.test(text)) return "line_drive";
  }
  for (const pattern of FLY_BALL_PATTERNS) {
    if (pattern.test(text)) return "fly_ball";
  }
  for (const pattern of GROUND_BALL_PATTERNS) {
    if (pattern.test(text)) return "ground_ball";
  }
  // Default: if it's a single/double/triple without clear type, assume line drive
  if (/\bsingled\b/i.test(text) || /\bdoubled\b/i.test(text) || /\btripled\b/i.test(text)) {
    return "line_drive";
  }
  return "ground_ball";
}

// ── Hit result detection ──────────────────────────────────────────────

export function classifyHitResult(text: string): HitResult | null {
  if (/\bhomered\b/i.test(text) || /\bhome run\b/i.test(text)) return "home_run";
  if (/\btripled\b/i.test(text)) return "triple";
  if (/\bdoubled\b/i.test(text)) return "double";
  if (/\bsingled\b/i.test(text)) return "single";
  if (/\breached on an error\b/i.test(text)) return "error";
  if (/\breached on a fielder'?s choice\b/i.test(text)) return "fielders_choice";
  if (
    /\bgrounded out\b/i.test(text) ||
    /\bflied out\b/i.test(text) ||
    /\bfly out\b/i.test(text) ||
    /\blined out\b/i.test(text) ||
    /\blined into\b/i.test(text) ||
    /\bpopped up\b/i.test(text) ||
    /\bpopped out\b/i.test(text) ||
    /\bhit into\b.*\bdouble play\b/i.test(text) ||
    /\bgrounded into\b/i.test(text) ||
    /\bsac fly\b/i.test(text) ||
    /\bsacrifice fly\b/i.test(text) ||
    /\bsac bunt\b/i.test(text) ||
    /\bbunted out\b/i.test(text) ||
    /\bfoul out\b/i.test(text) ||
    /\bfouled out\b/i.test(text)
  ) {
    return "out";
  }
  // Not a BIP event (walk, strikeout, HBP, etc.)
  return null;
}

// ── Direction → zone mapping ──────────────────────────────────────────

/**
 * Direction patterns, checked in order. First match wins.
 * Patterns are grouped from most specific to least specific.
 */
const DIRECTION_ZONE_MAP: Array<{ pattern: RegExp; zone: SprayZone }> = [
  // Line-specific (merged into fields)
  { pattern: /down the left.?field line/i, zone: "lf" },
  { pattern: /down the right.?field line/i, zone: "rf" },
  { pattern: /down the (lf|left) line/i, zone: "lf" },
  { pattern: /down the (rf|right) line/i, zone: "rf" },

  // Gap / between fielders
  { pattern: /left.?center/i, zone: "lcf" },
  { pattern: /right.?center/i, zone: "rcf" },

  // Sides (ground balls)
  { pattern: /through the left side/i, zone: "lcf" },
  { pattern: /through the right side/i, zone: "rcf" },

  // Up the middle
  { pattern: /up the middle/i, zone: "cf" },

  // Outfield positions
  { pattern: /\bto (left field|lf)\b/i, zone: "lf" },
  { pattern: /\bto (center field|cf)\b/i, zone: "cf" },
  { pattern: /\bto (right field|rf)\b/i, zone: "rf" },
  { pattern: /\bto left\b/i, zone: "lf" },
  { pattern: /\bto center\b/i, zone: "cf" },
  { pattern: /\bto right\b/i, zone: "rf" },
];

/**
 * Infield position → approximate zone mapping.
 * Used when the PBP only says "grounded out to ss" without a field direction.
 */
const INFIELD_POSITION_ZONE_MAP: Record<string, SprayZone> = {
  "3b": "lf",
  "ss": "lcf",
  "2b": "rcf",
  "1b": "rf",
  "p": "cf",
  "c": "cf",
};

/**
 * Try to extract the fielding position from PBP text like "grounded out to ss".
 */
function extractFieldingPosition(text: string): string | null {
  const match = text.match(/\bto\s+(ss|1b|2b|3b|p|c|lf|cf|rf)\b/i);
  return match ? match[1]!.toLowerCase() : null;
}

export function classifyZone(text: string): SprayZone | null {
  // First try directional text (most accurate)
  for (const { pattern, zone } of DIRECTION_ZONE_MAP) {
    if (pattern.test(text)) return zone;
  }

  // Fall back to infield position mapping
  const position = extractFieldingPosition(text);
  if (position && position in INFIELD_POSITION_ZONE_MAP) {
    return INFIELD_POSITION_ZONE_MAP[position]!;
  }

  // Can't determine zone
  return null;
}

// ── Total bases helper ────────────────────────────────────────────────

export function totalBasesForResult(result: HitResult): number {
  switch (result) {
    case "single":
      return 1;
    case "double":
      return 2;
    case "triple":
      return 3;
    case "home_run":
      return 4;
    default:
      return 0;
  }
}

export function isHitResult(result: HitResult): boolean {
  return result === "single" || result === "double" || result === "triple" || result === "home_run";
}

// ── RBI extraction ────────────────────────────────────────────────────

export function extractRbi(text: string): number {
  const match = text.match(/(\d+)\s*RBI/i);
  if (match) return parseInt(match[1]!, 10);
  // "RBI" alone = 1
  if (/\bRBI\b/i.test(text) && !/\d\s*RBI/i.test(text)) return 1;
  // scored mentions
  const scored = text.match(/scored/gi);
  return scored ? scored.length : 0;
}

// ── Count & pitch sequence extraction ─────────────────────────────────

/**
 * Extracts the pitch count and sequence from the PBP parenthetical.
 * Format: "(1-2 KKFBFFS)" → { count: "1-2", pitchSequence: "KKFBFFS" }
 *
 * Pitch codes: K=called strike, S=swinging strike, B=ball, F=foul, X=in play, etc.
 */
export function extractCountAndSequence(text: string): {
  count: string | null;
  pitchSequence: string | null;
} {
  const match = text.match(/\((\d+-\d+)\s+([A-Z]+)\)/);
  if (match) {
    return { count: match[1]!, pitchSequence: match[2]! };
  }
  // Sometimes just the count without sequence
  const countOnly = text.match(/\((\d+-\d+)\)/);
  if (countOnly) {
    return { count: countOnly[1]!, pitchSequence: null };
  }
  return { count: null, pitchSequence: null };
}
