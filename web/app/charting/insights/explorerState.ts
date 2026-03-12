import type {
  ChartingPlayerComparisonEventId,
  ChartingPlayerComparisonPitcherHandFilter,
} from "@/lib/charting/playerComparison";
import type { PitcherComparisonEventId } from "@/lib/charting/pitcherComparison";

export type ComparisonView = "hitters" | "pitchers";

export type SearchParamReader = {
  get: (key: string) => string | null;
};

export interface BaseExplorerQueryState<EventId extends string> {
  playerSlug: string | null;
  season: string | null;
  pitchType: string | null;
  count: string | null;
  event: EventId;
  veloMin: number | null;
  veloMax: number | null;
}

export interface HitterExplorerQueryState
  extends BaseExplorerQueryState<ChartingPlayerComparisonEventId> {
  pitcherHand: ChartingPlayerComparisonPitcherHandFilter;
}

export type PitcherExplorerQueryState =
  BaseExplorerQueryState<PitcherComparisonEventId>;

export function parseNumberParam(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeComparisonView(value: string | null): ComparisonView {
  return value === "pitchers" ? "pitchers" : "hitters";
}

export function normalizeHitterEvent(value: string | null): ChartingPlayerComparisonEventId {
  switch (value) {
    case "hits":
    case "inPlay":
    case "strikeouts":
    case "freePass":
    case "whiffs":
    case "fouls":
    case "chases":
      return value;
    default:
      return "all";
  }
}

export function normalizePitcherEvent(value: string | null): PitcherComparisonEventId {
  switch (value) {
    case "calledStrikes":
    case "balls":
    case "whiffs":
    case "fouls":
    case "chases":
    case "inPlay":
    case "hits":
    case "strikeouts":
    case "freePass":
      return value;
    default:
      return "all";
  }
}

export function normalizePitcherHandFilter(
  value: string | null
): ChartingPlayerComparisonPitcherHandFilter {
  return value === "R" || value === "L" ? value : "all";
}

export function readHitterExplorerQuery(params: SearchParamReader): HitterExplorerQueryState {
  return {
    playerSlug: params.get("player"),
    pitcherHand: normalizePitcherHandFilter(params.get("pitcherHand")),
    season: params.get("season"),
    pitchType: params.get("pitchType"),
    count: params.get("count"),
    event: normalizeHitterEvent(params.get("event")),
    veloMin: parseNumberParam(params.get("veloMin")),
    veloMax: parseNumberParam(params.get("veloMax")),
  };
}

export function readPitcherExplorerQuery(params: SearchParamReader): PitcherExplorerQueryState {
  return {
    playerSlug: params.get("player"),
    season: params.get("season"),
    pitchType: params.get("pitchType"),
    count: params.get("count"),
    event: normalizePitcherEvent(params.get("event")),
    veloMin: parseNumberParam(params.get("veloMin")),
    veloMax: parseNumberParam(params.get("veloMax")),
  };
}

export function buildHitterExplorerQuery({
  playerSlug,
  pitcherHand,
  season,
  latestSeason,
  pitchType,
  count,
  event,
  veloMin,
  veloMax,
}: {
  playerSlug: string | null;
  pitcherHand: ChartingPlayerComparisonPitcherHandFilter;
  season: string;
  latestSeason: string | null;
  pitchType: string | null;
  count: string | null;
  event: ChartingPlayerComparisonEventId;
  veloMin: number | null;
  veloMax: number | null;
}) {
  const next = new URLSearchParams();

  if (playerSlug) {
    next.set("player", playerSlug);
  }
  if (pitcherHand !== "all") {
    next.set("pitcherHand", pitcherHand);
  }
  if (season !== (latestSeason ?? "all")) {
    next.set("season", season);
  }
  if (pitchType) {
    next.set("pitchType", pitchType);
  }
  if (count) {
    next.set("count", count);
  }
  if (event !== "all") {
    next.set("event", event);
  }
  if (veloMin !== null) {
    next.set("veloMin", String(veloMin));
  }
  if (veloMax !== null) {
    next.set("veloMax", String(veloMax));
  }

  return next.toString();
}

export function buildPitcherExplorerQuery({
  playerSlug,
  season,
  latestSeason,
  pitchType,
  count,
  event,
  veloMin,
  veloMax,
}: {
  playerSlug: string | null;
  season: string;
  latestSeason: string | null;
  pitchType: string | null;
  count: string | null;
  event: PitcherComparisonEventId;
  veloMin: number | null;
  veloMax: number | null;
}) {
  const next = new URLSearchParams();

  if (playerSlug) {
    next.set("player", playerSlug);
  }
  if (season !== (latestSeason ?? "all")) {
    next.set("season", season);
  }
  if (pitchType) {
    next.set("pitchType", pitchType);
  }
  if (count) {
    next.set("count", count);
  }
  if (event !== "all") {
    next.set("event", event);
  }
  if (veloMin !== null) {
    next.set("veloMin", String(veloMin));
  }
  if (veloMax !== null) {
    next.set("veloMax", String(veloMax));
  }

  return next.toString();
}
