import { describe, expect, it } from "vitest";

import {
  findOpponentRosterPlayer,
  getOpponentRoster,
} from "./bootstrapOpponents";

describe("bootstrapOpponents", () => {
  it("matches known team-name variants from live game labels", () => {
    expect(getOpponentRoster("Trinity (Conn.)").length).toBeGreaterThan(0);
    expect(getOpponentRoster("U. of New England").length).toBeGreaterThan(0);
    expect(getOpponentRoster("#1/6 Trinity (Texas)").length).toBeGreaterThan(0);
  });

  it("finds opponent players with normalized name matching", () => {
    const roster = getOpponentRoster("MIT");
    const samplePlayer = roster[0];

    expect(samplePlayer).toBeTruthy();
    expect(
      findOpponentRosterPlayer(roster, `${samplePlayer!.name.toUpperCase()} `),
    )?.toMatchObject(samplePlayer!);
  });
});
