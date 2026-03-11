import { describe, expect, it } from "vitest";
import { getPlayerBySlug, playerRegistry } from "./playerRegistry";

describe("playerRegistry", () => {
  it("uses the charting roster as the full player directory", () => {
    expect(playerRegistry.length).toBeGreaterThan(40);
    expect(getPlayerBySlug("wilson_alexander")?.isHitter).toBe(true);
  });

  it("preserves pitcher D3 ids when a roster player also exists in the pitcher directory", () => {
    const player = getPlayerBySlug("burk_bobby");

    expect(player?.isPitcher).toBe(true);
    expect(player?.d3_player_id).toBe("d3d-e5ea3c3a7");
  });

  it("marks two-way players explicitly from the charting roster positions", () => {
    const player = getPlayerBySlug("valente_ben");

    expect(player?.isPitcher).toBe(true);
    expect(player?.isHitter).toBe(true);
    expect(player?.isTwoWay).toBe(true);
    expect(player?.role).toBe("Two-Way");
  });
});
