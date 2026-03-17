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
  updatePlateAppearanceContextInSnapshot,
  updatePlateAppearanceDetailsInSnapshot,
} from "./live";
import { fixtureGameSnapshot } from "./fixtures";
import type { ChartingGameSnapshot } from "./types";

const baseSnapshot: ChartingGameSnapshot = {
  game: {
    id: "game-1",
    opponent: "MIT",
    gameDate: "2026-03-01",
    status: "active",
    sessionType: "live_ab",
    babsonVenueSide: "home",
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
    babsonStartingPitcher: null,
    opponentStartingPitcher: null,
    ourTeamLabel: null,
    opponentTeamLabel: null,
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

  it("treats a two-strike bunt foul as strike three", () => {
    const progress = derivePAPitchProgress([
      {
        id: "pitch-1",
        gameId: "game-1",
        paId: "pa-1",
        pitchOrder: 0,
        pitchType: "Fastball",
        locationCell: 5,
        pitchResult: "bunt_foul",
        ballsBefore: 0,
        strikesBefore: 2,
        velocity: null,
      },
    ]);

    expect(progress.strikes).toBe(3);
    expect(progress.closureState).toBe("strikeout");
    expect(progress.lastPitchResult).toBe("bunt_foul");
  });
});

describe("snapshot mutations", () => {
  it("counts totals and inning pitches for the selected pitcher", () => {
    expect(countPitcherPitches(fixtureGameSnapshot, "DJames1")).toBe(7);
    expect(countPitcherPitches(fixtureGameSnapshot, "CBurrows1")).toBe(1);
    expect(countPitcherInningPitches(fixtureGameSnapshot, "DJames1", 1)).toBe(
      7,
    );
    expect(countPitcherInningPitches(fixtureGameSnapshot, "CBurrows1", 1)).toBe(
      0,
    );
    expect(countPitcherInningPitches(fixtureGameSnapshot, "CBurrows1", 6)).toBe(
      1,
    );
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
    expect(snapshot.segments[0]?.teamSide).toBe("our");
    expect(snapshot.plateAppearances).toHaveLength(1);
    expect(snapshot.plateAppearances[0]?.initialCount).toBe("0-0");
    expect(snapshot.plateAppearances[0]?.teamSide).toBe("opponent");
    expect(snapshot.pitches).toHaveLength(1);
    expect(snapshot.lineup[0]?.hitterName).toBe("Wyatt Miller");
    expect(snapshot.lineup[0]?.teamSide).toBe("opponent");
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
      snapshot.pitches,
    );
    expect(beforeClose.closureState).toBe("walk");

    snapshot = closeCurrentPlateAppearance(snapshot, "BB");

    const afterClose = deriveChartingLiveState(
      snapshot.segments,
      snapshot.plateAppearances,
      snapshot.pitches,
    );
    expect(snapshot.plateAppearances[0]?.resultCode).toBe("BB");
    expect(afterClose.batterSlot).toBe(2);
    expect(afterClose.openPAId).toBeNull();
  });

  it("rolls from the top half to the bottom half after three outs", () => {
    let snapshot = baseSnapshot;

    for (let slot = 1; slot <= 3; slot += 1) {
      snapshot = recordPitchInSnapshot(snapshot, {
        pitchType: "Fastball",
        pitchResult: "in_play",
        locationCell: 5,
        velocity: null,
        pitcher: { playerId: "DJames1", name: "D. James" },
        hitterName: `Hitter ${slot}`,
        lineupSlot: slot,
      });
      snapshot = closeCurrentPlateAppearance(snapshot, "6-3");
    }

    const afterThirdOut = deriveChartingLiveState(
      snapshot.segments,
      snapshot.plateAppearances,
      snapshot.pitches,
    );

    expect(afterThirdOut.inning).toBe(1);
    expect(afterThirdOut.isTopInning).toBe(false);
    expect(afterThirdOut.outs).toBe(0);
    expect(afterThirdOut.batterSlot).toBe(4);
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

  it("surfaces a seeded count before the first pitch of a new PA", () => {
    const state = deriveChartingLiveState([], [], [], null, {
      nextPASeed: {
        balls: 2,
        strikes: 1,
      },
    });

    expect(state.balls).toBe(2);
    expect(state.strikes).toBe(1);
    expect(state.openPAId).toBeNull();
  });

  it("records the first pitch from a 2-1 starting state", () => {
    const snapshot = recordPitchInSnapshot(
      baseSnapshot,
      {
        pitchType: "Fastball",
        pitchResult: "ball",
        locationCell: 12,
        velocity: null,
        pitcher: { playerId: "DJames1", name: "D. James" },
        hitterName: "Lead Off",
        lineupSlot: 1,
      },
      null,
      {
        nextPASeed: {
          balls: 2,
          strikes: 1,
        },
      },
    );

    expect(snapshot.pitches[0]?.ballsBefore).toBe(2);
    expect(snapshot.pitches[0]?.strikesBefore).toBe(1);
    expect(snapshot.plateAppearances[0]?.initialCount).toBe("2-1");

    const liveState = deriveChartingLiveState(
      snapshot.segments,
      snapshot.plateAppearances,
      snapshot.pitches,
    );
    expect(liveState.balls).toBe(3);
    expect(liveState.strikes).toBe(1);
  });

  it("records bottom-half game context with Babson batting and seeded baserunners", () => {
    const gameSnapshot: ChartingGameSnapshot = {
      ...baseSnapshot,
      game: {
        ...baseSnapshot.game,
        sessionType: "game",
        ourTeamLabel: "Babson",
        opponentTeamLabel: "MIT",
      },
    };
    const override = createGameStateOverride(gameSnapshot, {
      inning: 1,
      isTopInning: false,
      outs: 1,
    });

    const snapshot = recordPitchInSnapshot(
      gameSnapshot,
      {
        pitchType: "Slider",
        pitchResult: "called_strike",
        locationCell: 3,
        velocity: null,
        pitcher: {
          playerId: "manual:opponent:starter",
          name: "MIT Starter",
        },
        hitterName: "Babson Lead-Off",
        lineupSlot: 1,
      },
      override,
      {
        nextPASeed: {
          balls: 0,
          strikes: 0,
          baserunners: {
            runnerOnFirst: "Runner 1",
            runnerOnSecond: null,
            runnerOnThird: "Runner 3",
          },
        },
      },
    );

    expect(snapshot.segments[0]?.teamSide).toBe("opponent");
    expect(snapshot.segments[0]?.playerId).toBe("manual:opponent:starter");
    expect(snapshot.plateAppearances[0]).toMatchObject({
      inning: 1,
      isTopInning: false,
      teamSide: "our",
      runnerOnFirst: "Runner 1",
      runnerOnThird: "Runner 3",
    });
    expect(snapshot.lineup[0]?.teamSide).toBe("our");
    expect(snapshot.lineup[0]?.hitterName).toBe("Babson Lead-Off");
  });

  it("reuses a legacy blank-id opponent segment when the same manual pitcher continues", () => {
    const gameSnapshot: ChartingGameSnapshot = {
      ...baseSnapshot,
      game: {
        ...baseSnapshot.game,
        sessionType: "game",
      },
      segments: [
        {
          id: "legacy-seg-1",
          gameId: "game-1",
          playerId: "",
          displayName: "MIT Starter",
          teamSide: "opponent",
          segmentOrder: 0,
          enteredInning: 1,
          exitedInning: null,
          runsOverride: null,
          earnedRunsOverride: null,
        },
      ],
    };
    const override = createGameStateOverride(gameSnapshot, {
      inning: 1,
      isTopInning: false,
      outs: 0,
    });

    const snapshot = recordPitchInSnapshot(
      gameSnapshot,
      {
        pitchType: "Fastball",
        pitchResult: "called_strike",
        locationCell: 5,
        velocity: null,
        pitcher: {
          playerId: "manual:opponent:mit-starter",
          name: "MIT Starter",
        },
        hitterName: "Babson Lead-Off",
        lineupSlot: 1,
      },
      override,
    );

    expect(snapshot.segments).toHaveLength(1);
    expect(snapshot.segments[0]?.id).toBe("legacy-seg-1");
    expect(snapshot.segments[0]?.playerId).toBe("manual:opponent:mit-starter");
  });

  it("normalizes bunt-mode fouls and marks the plate appearance as a bunt rep", () => {
    const snapshot = recordPitchInSnapshot(
      baseSnapshot,
      {
        pitchType: "Fastball",
        pitchResult: "foul",
        locationCell: 5,
        velocity: null,
        pitcher: { playerId: "DJames1", name: "D. James" },
        hitterName: "Lead Off",
        lineupSlot: 1,
      },
      null,
      {
        nextPASeed: {
          balls: 0,
          strikes: 0,
          buntMode: true,
        },
      },
    );

    expect(snapshot.pitches[0]?.pitchResult).toBe("bunt_foul");
    expect(snapshot.plateAppearances[0]?.buntContext).toBe(true);
    expect(snapshot.plateAppearances[0]?.initialCount).toBe("Bunt");

    const liveState = deriveChartingLiveState(
      snapshot.segments,
      snapshot.plateAppearances,
      snapshot.pitches,
    );
    expect(liveState.strikes).toBe(1);
    expect(liveState.closureState).toBe("none");
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
      updated.pitches,
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

  it("updates history details for a completed plate appearance", () => {
    let snapshot = recordPitchInSnapshot(baseSnapshot, {
      pitchType: "Fastball",
      pitchResult: "foul",
      locationCell: 5,
      velocity: 91,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Lead Off",
      lineupSlot: 1,
    });
    snapshot = recordPitchInSnapshot(snapshot, {
      pitchType: "Slider",
      pitchResult: "in_play",
      locationCell: 9,
      velocity: 83,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Lead Off",
      lineupSlot: 1,
    });
    snapshot = closeCurrentPlateAppearance(snapshot, "6-3");

    const paId = snapshot.plateAppearances[0]!.id;
    const updated = updatePlateAppearanceDetailsInSnapshot(snapshot, {
      paId,
      pitcher: { playerId: "SVyse1", name: "S. Vyse" },
      hitterName: "Edited Hitter",
      initialCount: "2-1",
      resultCode: "1B",
    });

    expect(updated.segments).toHaveLength(1);
    expect(updated.segments[0]?.playerId).toBe("SVyse1");
    expect(updated.segments[0]?.displayName).toBe("S. Vyse");
    expect(updated.segments[0]?.segmentOrder).toBe(0);
    expect(updated.segments[0]?.teamSide).toBe("our");
    expect(updated.plateAppearances[0]?.segmentId).toBe(
      updated.segments[0]?.id,
    );
    expect(updated.plateAppearances[0]?.hitterName).toBe("Edited Hitter");
    expect(updated.plateAppearances[0]?.initialCount).toBe("2-1");
    expect(updated.plateAppearances[0]?.resultCode).toBe("1B");
    expect(updated.plateAppearances[0]?.teamSide).toBe("opponent");
    expect(updated.pitches[0]?.ballsBefore).toBe(2);
    expect(updated.pitches[0]?.strikesBefore).toBe(1);
    expect(updated.pitches[1]?.ballsBefore).toBe(2);
    expect(updated.pitches[1]?.strikesBefore).toBe(2);
  });

  it("updates history inning-half context and realigns batting side", () => {
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

    const paId = snapshot.plateAppearances[0]!.id;
    const updated = updatePlateAppearanceContextInSnapshot(snapshot, {
      paId,
      inning: 2,
      isTopInning: false,
    });

    expect(updated.plateAppearances[0]).toMatchObject({
      inning: 2,
      isTopInning: false,
      teamSide: "our",
    });
    expect(updated.segments[0]?.teamSide).toBe("opponent");
  });

  it("rebuilds bunt history pitch trails when the starting count changes to bunt", () => {
    let snapshot = recordPitchInSnapshot(baseSnapshot, {
      pitchType: "Fastball",
      pitchResult: "foul",
      locationCell: 5,
      velocity: null,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Lead Off",
      lineupSlot: 1,
    });
    snapshot = recordPitchInSnapshot(snapshot, {
      pitchType: "Changeup",
      pitchResult: "in_play",
      locationCell: 7,
      velocity: null,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Lead Off",
      lineupSlot: 1,
    });
    snapshot = closeCurrentPlateAppearance(snapshot, "5-3");

    const paId = snapshot.plateAppearances[0]!.id;
    const updated = updatePlateAppearanceDetailsInSnapshot(snapshot, {
      paId,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Lead Off",
      initialCount: "Bunt",
      resultCode: "1B",
    });

    expect(updated.plateAppearances[0]?.initialCount).toBe("Bunt");
    expect(updated.plateAppearances[0]?.buntContext).toBe(true);
    expect(updated.plateAppearances[0]?.resultCode).toBe("1B");
    expect(updated.plateAppearances[0]?.teamSide).toBe("opponent");
    expect(updated.pitches[0]?.pitchResult).toBe("bunt_foul");
    expect(updated.pitches[0]?.ballsBefore).toBe(0);
    expect(updated.pitches[0]?.strikesBefore).toBe(0);
    expect(updated.pitches[1]?.strikesBefore).toBe(1);
  });

  it("preserves live_ab session mode defaults for created records", () => {
    const snapshot = recordPitchInSnapshot(baseSnapshot, {
      pitchType: "Fastball",
      pitchResult: "called_strike",
      locationCell: 5,
      velocity: 92,
      pitcher: { playerId: "DJames1", name: "D. James" },
      hitterName: "Session Hitter",
      lineupSlot: 3,
    });

    expect(snapshot.game.sessionType).toBe("live_ab");
    expect(snapshot.segments[0]?.teamSide).toBe("our");
    expect(snapshot.plateAppearances[0]?.teamSide).toBe("opponent");
    expect(snapshot.lineup[0]?.teamSide).toBe("opponent");
  });
});
