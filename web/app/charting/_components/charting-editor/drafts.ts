import {
  baserunnerStateFromPlateAppearance,
  deriveChartingLiveState,
  emptyBaserunnerState,
} from "@/lib/charting/live";
import type {
  ChartingBaserunnerState,
  ChartingGameSnapshot,
} from "@/lib/charting/types";
import type { GameStateOverride } from "@/lib/charting/live";

import type { LineupDrafts } from "./types";

export const buildLineupDrafts = (
  lineup: ChartingGameSnapshot["lineup"],
): LineupDrafts => {
  const drafts: LineupDrafts = {
    our: {},
    opponent: {},
  };

  for (const entry of lineup) {
    drafts[entry.teamSide][entry.lineupSlot] = entry.hitterName;
  }

  return drafts;
};

export const buildSnapshotLineup = (
  snapshot: ChartingGameSnapshot,
  lineupDrafts: LineupDrafts,
): ChartingGameSnapshot["lineup"] => {
  const existingBySideAndSlot = new Map(
    snapshot.lineup.map((entry) => [`${entry.teamSide}:${entry.lineupSlot}`, entry]),
  );
  const nextLineup: ChartingGameSnapshot["lineup"] = [];

  for (const side of ["our", "opponent"] as const) {
    for (let slot = 1; slot <= 9; slot += 1) {
      const hitterName = lineupDrafts[side][slot]?.trim() ?? "";
      if (!hitterName) {
        continue;
      }

      const key = `${side}:${slot}`;
      const existing = existingBySideAndSlot.get(key);
      nextLineup.push({
        id: existing?.id ?? crypto.randomUUID(),
        gameId: snapshot.game.id,
        teamSide: side,
        lineupSlot: slot,
        hitterName,
      });
    }
  }

  return nextLineup;
};

export const deriveBaserunnerDraft = (
  snapshot: ChartingGameSnapshot,
  gameStateOverride: GameStateOverride | null,
): ChartingBaserunnerState => {
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride,
  );
  const openPlateAppearance =
    snapshot.plateAppearances.find((plateAppearance) => plateAppearance.id === liveState.openPAId) ??
    null;

  return openPlateAppearance
    ? baserunnerStateFromPlateAppearance(openPlateAppearance)
    : emptyBaserunnerState();
};
