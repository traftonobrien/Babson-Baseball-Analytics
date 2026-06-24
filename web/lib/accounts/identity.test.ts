import { describe, expect, it } from "vitest";
import { buildBootstrapRosterPlayers } from "../charting/bootstrapRoster";
import {
  buildPlayerAccountIdentity,
  canEditPlayerAccountResource,
  isBabsonEmail,
  normalizeAccountEmail,
} from "./identity";

describe("account identity", () => {
  const rosterPlayers = buildBootstrapRosterPlayers();
  const bourke = rosterPlayers.find((player) => player.name === "Bourke Reid") ?? null;
  const cooper = rosterPlayers.find((player) => player.name === "Cooper Smith") ?? null;

  it("normalizes Babson email addresses for stable account keys", () => {
    expect(normalizeAccountEmail("  Player.Name@Babson.edu ")).toBe(
      "player.name@babson.edu",
    );
    expect(normalizeAccountEmail("not-an-email")).toBeNull();
  });

  it("accepts only Babson email addresses for player personalization", () => {
    expect(isBabsonEmail("pitcher@babson.edu")).toBe(true);
    expect(isBabsonEmail("pitcher@gmail.com")).toBe(false);
  });

  it("pairs the selected roster identity with the normalized Babson email", () => {
    const identity = buildPlayerAccountIdentity({
      email: " Bourke.Reid@BABSON.EDU ",
      rosterPlayer: bourke,
    });

    expect(identity).toMatchObject({
      email: "bourke.reid@babson.edu",
      playerId: "BReid1",
      playerName: "Bourke Reid",
      role: "player",
    });
  });

  it("keeps broad viewing separate from edit permissions", () => {
    const player = buildPlayerAccountIdentity({
      email: "bourke.reid@babson.edu",
      rosterPlayer: bourke,
    });
    const coach = buildPlayerAccountIdentity({
      email: "coach@babson.edu",
      rosterPlayer: null,
      role: "coach",
    });

    expect(player).not.toBeNull();
    expect(coach).not.toBeNull();
    expect(
      canEditPlayerAccountResource({
        account: player!,
        resourcePlayerId: bourke?.playerId ?? null,
      }),
    ).toBe(true);
    expect(
      canEditPlayerAccountResource({
        account: player!,
        resourcePlayerId: cooper?.playerId ?? null,
      }),
    ).toBe(false);
    expect(
      canEditPlayerAccountResource({
        account: coach!,
        resourcePlayerId: cooper?.playerId ?? null,
      }),
    ).toBe(true);
  });
});
