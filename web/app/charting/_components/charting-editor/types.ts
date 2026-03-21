import type { PAResultType } from "@/lib/charting/live";
import type {
  ChartingBaserunnerState,
  ChartingGameSnapshot,
  ChartingInitialCount,
  ChartingMatchupSide,
  PitchResult,
  PitchType,
} from "@/lib/charting/types";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type LiveABCountPreset = "0-0" | "2-1" | "bunt";

export type RecentPitchRow = {
  id: string;
  paId: string;
  order: number;
  hitterName: string;
  inning: number;
  count: string;
  pitchType: PitchType;
  pitchResult: PitchResult;
  velocity: number | null;
  paResult: string | null;
};

export type HistoryEditDraft = {
  paId: string;
  pitcherId: string;
  pitcherName: string;
  hitterName: string;
  initialCount: LiveABCountPreset;
  resultCode: PAResultType | "";
};

export type LineupDrafts = Record<ChartingMatchupSide, Record<number, string>>;

export type InPlayStep = "hit_or_out" | "hit_type" | "out_type" | "out_scoring";

export type InPlayOutType =
  | "ground"
  | "line"
  | "fly"
  | "pop"
  | "unassisted"
  | "dp"
  | "error"
  | "fc";

export type RecentPAGroup = {
  paId: string;
  inning: number;
  isTopInning: boolean;
  hitterName: string;
  pitcherId: string;
  pitcherName: string;
  initialCount: ChartingInitialCount;
  paResult: PAResultType | null;
  baserunners: ChartingBaserunnerState;
  pitches: RecentPitchRow[];
};

export type HistoryPitcherOption = {
  playerId: string;
  name: string;
};

export type ChartingGameStatus = ChartingGameSnapshot["game"]["status"];
