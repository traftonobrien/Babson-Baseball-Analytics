import { AUTH_GATES } from "@/lib/auth";
import type {
  ChartingMatchupSide,
  ChartingPitcherSegment,
  ChartingSessionType,
  ChartingVenueSide,
  GameStatus,
  PitchResult,
  PitchType,
} from "./types";

export const PITCH_TYPES: readonly PitchType[] = [
  "Fastball",
  "Curveball",
  "Slider",
  "Changeup",
  "Split/Cut",
  "Other",
] as const;

export const PITCH_RESULTS: readonly PitchResult[] = [
  "ball",
  "called_strike",
  "swinging_strike",
  "foul",
  "bunt_foul",
  "in_play",
  "hit_by_pitch",
] as const;

export const GAME_STATUSES: readonly GameStatus[] = [
  "draft",
  "active",
  "final",
] as const;

export const CHARTING_SESSION_TYPES: readonly ChartingSessionType[] = [
  "live_ab",
  "game",
] as const;

export const CHARTING_VENUE_SIDES: readonly ChartingVenueSide[] = [
  "home",
  "away",
] as const;

export const CHARTING_MATCHUP_SIDES: readonly ChartingMatchupSide[] = [
  "our",
  "opponent",
] as const;

export const LOCATION_CELL_MIN = 1;
export const LOCATION_CELL_MAX = 17;

/**
 * Returns true when the client's revision matches the stored revision.
 * A mismatch means the client is working from a stale snapshot and the
 * PATCH should be rejected with 409.
 */
export function isRevisionMatch(
  storedRevision: number,
  clientRevision: number,
): boolean {
  return storedRevision === clientRevision;
}

/** Produces the next revision number after a successful update. */
export function nextRevision(current: number): number {
  return current + 1;
}

export function isValidPitchType(value: string): value is PitchType {
  return (PITCH_TYPES as readonly string[]).includes(value);
}

export function isValidPitchResult(value: string): value is PitchResult {
  return (PITCH_RESULTS as readonly string[]).includes(value);
}

/** Location cell must be an integer in [1, 17]. */
export function isValidLocationCell(cell: number): boolean {
  return (
    Number.isInteger(cell) &&
    cell >= LOCATION_CELL_MIN &&
    cell <= LOCATION_CELL_MAX
  );
}

export function isValidGameStatus(value: string): value is GameStatus {
  return (GAME_STATUSES as readonly string[]).includes(value);
}

export function isValidChartingSessionType(
  value: string,
): value is ChartingSessionType {
  return (CHARTING_SESSION_TYPES as readonly string[]).includes(value);
}

export function isValidVenueSide(value: string): value is ChartingVenueSide {
  return (CHARTING_VENUE_SIDES as readonly string[]).includes(value);
}

export function isValidMatchupSide(
  value: string,
): value is ChartingMatchupSide {
  return (CHARTING_MATCHUP_SIDES as readonly string[]).includes(value);
}

/** Cookie name for the charting-specific session gate. */
export const CHARTING_COOKIE = AUTH_GATES.charting.cookieName;

export const LINEUP_SLOT_MIN = 1;
export const LINEUP_SLOT_MAX = 9;

/** Lineup slot must be an integer in [1, 9]. */
export function isValidLineupSlot(slot: number): boolean {
  return (
    Number.isInteger(slot) && slot >= LINEUP_SLOT_MIN && slot <= LINEUP_SLOT_MAX
  );
}

/**
 * Returns the next segmentOrder for a new pitcher being added to a game.
 * Scans existing segments for the highest order and adds 1.
 */
export function nextSegmentOrder(
  existing: Pick<ChartingPitcherSegment, "segmentOrder">[],
): number {
  if (existing.length === 0) return 0;
  return Math.max(...existing.map((s) => s.segmentOrder)) + 1;
}
