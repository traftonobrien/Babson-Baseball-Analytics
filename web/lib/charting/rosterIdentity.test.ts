import { describe, expect, it } from "vitest";
import { buildBootstrapRosterPlayers } from "./bootstrapRoster";
import {
  canonicalizeRosterPlayerName,
  findRosterPlayerByIdentity,
} from "./rosterIdentity";

describe("rosterIdentity", () => {
  const rosterPlayers = buildBootstrapRosterPlayers();

  it("resolves Babson hitter aliases back to the roster display name", () => {
    const match = findRosterPlayerByIdentity(rosterPlayers, "Michael McCarthy");

    expect(match?.name).toBe("Mike McCarthy");
    expect(match?.slug).toBe("mccarthy_michael");
  });

  it("returns the roster display label for canonical lineup autofill", () => {
    expect(
      canonicalizeRosterPlayerName(rosterPlayers, "Michael McCarthy"),
    ).toBe("Mike McCarthy");
  });
});
