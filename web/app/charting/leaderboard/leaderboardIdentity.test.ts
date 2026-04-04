import { describe, expect, it } from "vitest";
import {
  buildHitterLeaderboardIdentities,
  buildPitcherLeaderboardIdentities,
} from "./leaderboardIdentity";

describe("charting leaderboard identity grouping", () => {
  it("merges pitcher segments for canonical aliases into one row", () => {
    const identities = buildPitcherLeaderboardIdentities([
      { id: "seg-1", playerId: "RChristensen1", displayName: "Bobby Christensen" },
      { id: "seg-2", playerId: "christensen_robert", displayName: "Robert Christensen" },
      { id: "seg-3", playerId: null, displayName: "Ben Valente" },
      { id: "seg-4", playerId: "BValente1", displayName: "Ben Valente" },
    ]);

    expect(identities).toHaveLength(2);
    expect(identities.find((identity) => identity.playerId === "RChristensen1")).toMatchObject({
      displayName: "Bobby Christensen",
      segmentIds: ["seg-1", "seg-2"],
    });
    expect(identities.find((identity) => identity.playerId === "BValente1")).toMatchObject({
      displayName: "Ben Valente",
      segmentIds: ["seg-3", "seg-4"],
    });
  });

  it("merges hitter aliases into one leaderboard identity", () => {
    const identities = buildHitterLeaderboardIdentities([
      { hitterName: "Bobby Christensen" },
      { hitterName: "Robert Christensen" },
      { hitterName: "Ben Valente" },
    ]);

    expect(identities).toHaveLength(2);
    expect(identities.find((identity) => identity.playerId === "RChristensen1")).toMatchObject({
      displayName: "Bobby Christensen",
      hitterNames: ["Bobby Christensen", "Robert Christensen"],
    });
    expect(identities.find((identity) => identity.playerId === "BValente1")).toMatchObject({
      displayName: "Ben Valente",
      hitterNames: ["Ben Valente"],
    });
  });
});
