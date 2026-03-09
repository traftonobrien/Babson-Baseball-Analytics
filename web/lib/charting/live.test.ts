import { describe, expect, it } from "vitest";

import {
  updatePitchVelocityInSnapshot,
  countPitcherInningPitches,
  countPitcherPitches,
  closeCurrentPlateAppearance,
  createGameStateOverride,
  deriveChartingLiveState,
  derivePAPitchProgress,
  recordPitchInSnapshot,
  undoSnapshotAction,
} from "./live";
import { fixtureGameSnapshot } from "./fixtures";
import type { ChartingGameSnapshot } from "./types";

const baseSnapshot: ChartingGameSnapshot = {
  game: {
    id: "game-1",
    opponent: "MIT",
    gameDate: "2026-03-01",
    status: "active",
    revision: 1,
    charter: null,
    weather: null,
    homeCatcher: null,
    awayCatcher: null,
    babsonRecord: null,
    standing: null,
    tomorrowStarter: null,
    tomorrowOpponent: null,
    notes: null,
    createdAt: "2026-03-01T12:00:00Z",
    updatedAt: "2026-03-01T12:00:00Z",
  },
  segments: [],
  lineup: [],
  plateAppearances: [],
  pitches: [],
};

describe("derivePAPitchProgress", () => {
  it("promotes strike three to closure", () => {
    const progress = derivePAPitchProgress([
      {
        id: "pitch-1",
        gameId: "game-1",
        paId: "pa-1",
        pitchOrder: 0,
        pitchType: "Fastball",
        locationCell: 5,
        pitchResult: "called_strike",
        ballsBefore: 0,
        strikesBefore: 0,
        velocity: null,
      },
      {
        id: "pitch-2",
        gameId: "game-1",
        paId: "pa-1",
        pitchOrder: 1,
        pitchType: "Slider",
        locationCell: 3,
        pitchResult: "swinging_strike",
        ballsBefore: 0,
        strikesBefore: 1,
        velocity: null,
      },
      {
        id: "pitch-3",
        gameId: "game-1",
        paId: "pa-1",
        pitchOrder: 2,
        pitchType: "Fastball",
        locationCell: 8,
        pitchResult: "swinging_strike",
        ballsBefore: 0,
        strikesBefore: 2,
        velocity: null,
      },
    ]);

    expect(progress.strikes).toBe(3);
    expect(progress.closureState).toBe("strikeout");
  });
});

describe("snapshot mutations", () => {
  it("counts totals and inning pitches for the selected pitcher", () => {
    expect(countPitcherPitches(fixtureGameSnapshot, "DJames1")).toBe(7);
    expect(countPitcherPitches(fixtureGameSnapshot, "CBurrows1")).toBe(1);
    expect(countPitcherInningPitches(fixtureGameSnapshot, "DJames1", 1)).toBe(7);
    expect(countPitcherInningPitches(fixtureGameSnapshot, "CBurrows1", 1)).toBe(0);
    expect(countPitcherInningPitches(fixtureGameSnapshot, "CBurrows1", 6)).toBe(1);
  });

  it("records a first pitch by creating a segment and PA", () => {
    const snapshot = recordPitchInSnapshot(baseSnapshot, {
      pitchType: "Fastball",
      pitchResult: "called_strike",
      locationCell: 5,
      velocity: 91,
      pitcher: {
        playerId: "DJames1",
        name: "D. James",
      },
      hitterName: "Wyatt Miller",
      lineupSlot: 1,
    });

    expect(snapshot.segments).toHaveLength(1);
    expect(snapshot.plateAppearances).toHaveLength(1);
    expect(snapshot.pitches).toHaveLength(1);
    expect(snapshot.lineup[0]?.hitterName).toBe("Wyatt Miller");
  });

  it("closes a walk and advances the next batter slot", () => {
    let snapshot = baseSnapshot;
    snapshot = recordPitchInSnapshot(snapshot, {
      pitchType: "Fastball",
      pitchResult: "ball",
      locationCell: 12,
      velocity: null,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Lead Off",
      lineupSlot: 1,
    });
    snapshot = recordPitchInSnapshot(snapshot, {
      pitchType: "Fastball",
      pitchResult: "ball",
      locationCell: 12,
      velocity: null,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Lead Off",
      lineupSlot: 1,
    });
    snapshot = recordPitchInSnapshot(snapshot, {
      pitchType: "Fastball",
      pitchResult: "ball",
      locationCell: 12,
      velocity: null,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Lead Off",
      lineupSlot: 1,
    });
    snapshot = recordPitchInSnapshot(snapshot, {
      pitchType: "Fastball",
      pitchResult: "ball",
      locationCell: 12,
      velocity: null,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Lead Off",
      lineupSlot: 1,
    });

    const beforeClose = deriveChartingLiveState(
      snapshot.segments,
      snapshot.plateAppearances,
      snapshot.pitches
    );
    expect(beforeClose.closureState).toBe("walk");

    snapshot = closeCurrentPlateAppearance(snapshot, "BB");

    const afterClose = deriveChartingLiveState(
      snapshot.segments,
      snapshot.plateAppearances,
      snapshot.pitches
    );
    expect(snapshot.plateAppearances[0]?.resultCode).toBe("BB");
    expect(afterClose.batterSlot).toBe(2);
    expect(afterClose.openPAId).toBeNull();
  });

  it("supports a local inning/outs override for the next PA anchor", () => {
    const override = createGameStateOverride(baseSnapshot, {
      inning: 4,
      isTopInning: false,
      outs: 2,
    });

    const state = deriveChartingLiveState([], [], [], override);
    expect(state.inning).toBe(4);
    expect(state.isTopInning).toBe(false);
    expect(state.outs).toBe(2);
  });

  it("undoes a closed plate appearance before removing pitches", () => {
    let snapshot = recordPitchInSnapshot(baseSnapshot, {
      pitchType: "Fastball",
      pitchResult: "in_play",
      locationCell: 6,
      velocity: null,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Lead Off",
      lineupSlot: 1,
    });
    snapshot = closeCurrentPlateAppearance(snapshot, "1B");

    const reopened = undoSnapshotAction(snapshot);
    expect(reopened.plateAppearances[0]?.resultCode).toBeNull();

    const emptied = undoSnapshotAction(reopened);
    expect(emptied.plateAppearances).toHaveLength(0);
    expect(emptied.pitches).toHaveLength(0);
  });

  it("updates a pitch velocity without changing plate appearance state", () => {
    const snapshot = recordPitchInSnapshot(baseSnapshot, {
      pitchType: "Fastball",
      pitchResult: "called_strike",
      locationCell: 5,
      velocity: null,
      pitcher: {
        playerId: "DJames1",
        name: "D. James",
      },
      hitterName: "Wyatt Miller",
      lineupSlot: 1,
    });

    const pitchId = snapshot.pitches[0]!.id;
    const updated = updatePitchVelocityInSnapshot(snapshot, pitchId, 94);

    expect(updated.pitches[0]?.velocity).toBe(94);
    expect(updated.pitches[0]?.pitchType).toBe("Fastball");

    const liveState = deriveChartingLiveState(
      updated.segments,
      updated.plateAppearances,
      updated.pitches
    );
    expect(liveState.strikes).toBe(1);

    const cleared = updatePitchVelocityInSnapshot(updated, pitchId, null);
    expect(cleared.pitches[0]?.velocity).toBeNull();
  });

  it("removes an orphaned pitcher segment when undo clears the only pitch", () => {
    const snapshot = recordPitchInSnapshot(baseSnapshot, {
      pitchType: "Fastball",
      pitchResult: "called_strike",
      locationCell: 5,
      velocity: 91,
      pitcher: {
        playerId: "DJames1",
        name: "D. James",
      },
      hitterName: "Wyatt Miller",
      lineupSlot: 1,
    });

    expect(snapshot.segments).toHaveLength(1);

    const undone = undoSnapshotAction(snapshot);
    expect(undone.plateAppearances).toHaveLength(0);
    expect(undone.pitches).toHaveLength(0);
    expect(undone.segments).toHaveLength(0);
  });
});
