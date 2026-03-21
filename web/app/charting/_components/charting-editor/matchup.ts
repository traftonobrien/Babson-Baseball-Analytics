import {
  battingSideForMatchup,
  deriveChartingLiveState,
  lineupNameForSlot,
  pitchingSideForMatchup,
} from "@/lib/charting/live";
import { PITCH_TYPES } from "@/lib/charting/domain";
import type {
  ChartingBootstrapPitcher,
  ChartingBootstrapRosterPlayer,
  ChartingGameSnapshot,
  ChartingMatchupSide,
} from "@/lib/charting/types";
import type { GameStateOverride } from "@/lib/charting/live";

export interface MatchupSelection {
  slot: number;
  hitterName: string;
}

export interface PitcherSelection {
  playerId: string;
  name: string;
}

export const deriveMatchupSelection = (
  snapshot: ChartingGameSnapshot,
  gameStateOverride: GameStateOverride | null,
): MatchupSelection => {
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride,
  );
  const openPlateAppearance =
    snapshot.plateAppearances.find((plateAppearance) => plateAppearance.id === liveState.openPAId) ??
    null;
  const battingSide = battingSideForMatchup(
    snapshot.game,
    gameStateOverride?.isTopInning ?? liveState.isTopInning,
  );
  const slot = openPlateAppearance?.lineupSlot ?? liveState.batterSlot;
  const hitterName =
    openPlateAppearance?.hitterName ??
    lineupNameForSlot(snapshot.lineup, slot, battingSide) ??
    "";

  return { slot, hitterName };
};

export const buildHitterSuggestions = (
  snapshot: ChartingGameSnapshot,
  rosterPlayers: ChartingBootstrapRosterPlayer[],
  teamSide: ChartingMatchupSide,
): string[] => {
  const rosterSuggestions =
    teamSide === "our"
      ? rosterPlayers.filter((player) => player.isHitter).map((player) => player.name)
      : [];

  return Array.from(
    new Set([
      ...snapshot.lineup
        .filter((entry) => entry.teamSide === teamSide)
        .map((entry) => entry.hitterName),
      ...snapshot.plateAppearances
        .filter((plateAppearance) => plateAppearance.teamSide === teamSide)
        .map((plateAppearance) => plateAppearance.hitterName),
      ...rosterSuggestions,
    ]),
  ).sort((left, right) => left.localeCompare(right));
};

export const derivePitcherSelection = (
  snapshot: ChartingGameSnapshot,
  pitchers: ChartingBootstrapPitcher[],
  gameStateOverride: GameStateOverride | null,
): PitcherSelection => {
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride,
  );
  const pitchingSide = pitchingSideForMatchup(
    snapshot.game,
    gameStateOverride?.isTopInning ?? liveState.isTopInning,
  );
  const matchingSegments = snapshot.segments.filter(
    (segment) => segment.teamSide === pitchingSide,
  );
  const latestSegment = matchingSegments.at(-1) ?? null;

  if (latestSegment?.playerId?.trim()) {
    return {
      playerId: latestSegment.playerId,
      name: latestSegment.displayName,
    };
  }

  if (pitchingSide === "our") {
    const defaultPitcher =
      pitchers.find((pitcher) => pitcher.playerId === latestSegment?.playerId) ??
      pitchers[0] ??
      null;

    return {
      playerId: defaultPitcher?.playerId ?? "",
      name: defaultPitcher?.name ?? snapshot.game.babsonStartingPitcher ?? "",
    };
  }

  return {
    playerId: manualPitcherId(
      latestSegment?.displayName || snapshot.game.opponentStartingPitcher || "",
      pitchingSide,
    ),
    name: latestSegment?.displayName || snapshot.game.opponentStartingPitcher || "",
  };
};

export const buildSelectedPitcherOption = (
  snapshot: ChartingGameSnapshot,
  pitchers: ChartingBootstrapPitcher[],
  selectedPitcherId: string,
  pitcherNameInput: string,
  activePitchingSide: ChartingMatchupSide,
): ChartingBootstrapPitcher | null => {
  const rosterPitcher =
    activePitchingSide === "our"
      ? pitchers.find((pitcher) => pitcher.playerId === selectedPitcherId)
      : null;
  if (rosterPitcher) {
    return rosterPitcher;
  }

  const manualName = pitcherNameInput.trim();
  if (!manualName) {
    return null;
  }

  const syntheticId =
    selectedPitcherId.trim() || manualPitcherId(manualName, activePitchingSide);

  return {
    playerId: syntheticId,
    name: manualName,
    throws: "R",
    arsenalPitchTypes: [...PITCH_TYPES],
  };
};

export const manualPitcherId = (
  name: string,
  side: ChartingMatchupSide,
): string => {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  const slug = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `manual:${side}:${slug || "pitcher"}`;
};
