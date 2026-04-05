/**
 * Spray chart data types.
 *
 * Zone layout mirrors 6-4-3 Charts' 7-zone fan:
 *   LF_LINE  LF  LCF  CF  RCF  RF  RF_LINE
 * plus a separate HR overlay.
 */

// ── Zone identifiers ──────────────────────────────────────────────────

export const SPRAY_ZONES = [
  "lf",
  "lcf",
  "cf",
  "rcf",
  "rf",
] as const;

export type SprayZone = (typeof SPRAY_ZONES)[number];

export const SPRAY_ZONE_LABELS: Record<SprayZone, string> = {
  lf: "Left Field",
  lcf: "Left-Center",
  cf: "Center",
  rcf: "Right-Center",
  rf: "Right Field",
};

// ── Batted ball classification ────────────────────────────────────────

export type BattedBallType = "ground_ball" | "line_drive" | "fly_ball" | "popup";

export const BATTED_BALL_LABELS: Record<BattedBallType, string> = {
  ground_ball: "GB",
  line_drive: "LD",
  fly_ball: "FB",
  popup: "PU",
};

// ── Hit result ────────────────────────────────────────────────────────

export type HitResult =
  | "single"
  | "double"
  | "triple"
  | "home_run"
  | "out"
  | "error"
  | "fielders_choice";

// ── Raw event from scraper ────────────────────────────────────────────

export interface SprayChartEvent {
  /** Batter's full name as it appears in the PBP, e.g. "Robert Christensen" */
  batter: string;
  /** The hit/out result */
  result: HitResult;
  /** Batted ball type inferred from verb */
  battedBallType: BattedBallType;
  /** Zone the ball was hit to */
  zone: SprayZone;
  /** Was it a hit (reached base safely on the BIP)? */
  isHit: boolean;
  /** Total bases for the BIP (0 for outs, 1 for single, 2 for double, etc.) */
  totalBases: number;
  /** RBIs on the play */
  rbi: number;
  /** Inning number */
  inning: number;
  /** Game date YYYY-MM-DD */
  gameDate: string;
  /** Opponent team name */
  opponent: string;
  /** Home run flag (tracked separately for the HR arc) */
  isHomeRun: boolean;
  /** Pitch count at time of BIP, e.g. "1-2" (balls-strikes) */
  count: string | null;
  /** Raw pitch sequence string, e.g. "KKFBFFS" */
  pitchSequence: string | null;
}

// ── Scraped game container ────────────────────────────────────────────

export interface SprayChartGame {
  gameId: string;
  date: string;
  opponent: string;
  url: string;
  events: SprayChartEvent[];
}

export interface SprayChartData {
  scrapedAt: string;
  season: number;
  games: SprayChartGame[];
}

// ── Per-zone aggregated stats (for the detail panel) ──────────────────

export type SprayDepth = "infield" | "outfield";

export interface ZoneStats {
  zone: SprayZone;
  depth: SprayDepth;
  bip: number;
  hits: number;
  outs: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  xbh: number;
  totalBases: number;
  /** Batting average on BIP to this zone */
  avg: number | null;
  /** Slugging on BIP to this zone */
  slg: number | null;
  /** Zone share — what % of total BIP went to this zone */
  zonePct: number;
  /** Ground ball % to this zone */
  gbPct: number | null;
  /** Line drive % to this zone */
  ldPct: number | null;
  /** Fly ball % to this zone */
  fbPct: number | null;
  /** Popup % to this zone */
  puPct: number | null;
}

// ── Player-level spray profile ────────────────────────────────────────

export interface PlayerSprayProfile {
  /** Player name from PBP text */
  name: string;
  /** Total balls in play (excluding HR for zone chart, but HR tracked separately) */
  totalBip: number;
  /** Total home runs */
  totalHr: number;
  /** Per-segment stats */
  segments: ZoneStats[];
  /** Overall batting average on all BIP */
  overallAvg: number | null;
  /** Overall slugging on all BIP */
  overallSlg: number | null;
  /** Overall GB% */
  overallGbPct: number | null;
  /** Overall LD% */
  overallLdPct: number | null;
  /** Overall FB% */
  overallFbPct: number | null;
  /** Number of games with data */
  gameCount: number;
}
