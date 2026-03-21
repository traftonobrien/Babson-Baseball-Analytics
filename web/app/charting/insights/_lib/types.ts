import {
  buildChartingPlayerComparisonPitchMix,
  type ChartingPlayerComparisonDirectoryEntry,
  type ChartingPlayerComparisonEventId,
  type ChartingPlayerComparisonMetricId,
  type ChartingPlayerComparisonPitchRecord,
  type ChartingPlayerComparisonSummary,
  type ChartingPlayerComparisonVelocityRange,
} from "@/lib/charting/playerComparison";
import type {
  PitcherComparisonDirectoryEntry,
  PitcherComparisonEventId,
  PitcherComparisonMetricId,
  PitcherComparisonPitchMixItem,
  PitcherComparisonPitchRecord,
  PitcherComparisonSummary,
} from "@/lib/charting/pitcherComparison";
import type { ComparisonZoneBucketId } from "@/lib/charting/comparisonZones";

import type { ComparisonView } from "../explorerState";

export type Catalog = {
  seasons: string[];
  pitchTypes: string[];
  counts: string[];
  velocityRange: ChartingPlayerComparisonVelocityRange | null;
};

export type ZoneDisplayMode = "heatmap" | "sections";
export type ComparisonMetricId =
  | ChartingPlayerComparisonMetricId
  | PitcherComparisonMetricId;
export type ComparisonEventId =
  | ChartingPlayerComparisonEventId
  | PitcherComparisonEventId;
export type ExplorerEntry =
  | ChartingPlayerComparisonDirectoryEntry
  | PitcherComparisonDirectoryEntry;
export type ExplorerPitch =
  | ChartingPlayerComparisonPitchRecord
  | PitcherComparisonPitchRecord;
export type ExplorerSummary =
  | ChartingPlayerComparisonSummary
  | PitcherComparisonSummary;
export type ExplorerZoneBucket = {
  id: ComparisonZoneBucketId;
  label: string;
  placement: "chase" | "zone";
  cellIds: number[];
  pitches: ExplorerPitch[];
  summary: ExplorerSummary;
};
export type ComparisonMetricOption = {
  id: ComparisonMetricId;
  label: string;
  description: string;
  lowerBetter: boolean;
};
export type ComparisonEventOption = {
  id: ComparisonEventId;
  label: string;
  description: string;
};
export type ComparisonPitchMixItem =
  | ReturnType<typeof buildChartingPlayerComparisonPitchMix>[number]
  | PitcherComparisonPitchMixItem;
export interface SearchResultCardProps {
  view: ComparisonView;
  entry: ExplorerEntry;
  active: boolean;
  onClick: () => void;
}
