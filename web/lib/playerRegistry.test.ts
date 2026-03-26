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

  it("respects explicit single-role roster assignments", () => {
    const jason = getPlayerBySlug("finkelstein_jason");
    const ian = getPlayerBySlug("laforest_ian");
    const graydon = getPlayerBySlug("vyse_graydon");

    expect(jason?.isPitcher).toBe(true);
    expect(jason?.isHitter).toBe(false);
    expect(jason?.isTwoWay).toBe(false);

    expect(ian?.isPitcher).toBe(false);
    expect(ian?.isHitter).toBe(true);
    expect(ian?.isTwoWay).toBe(false);

    expect(graydon?.isPitcher).toBe(true);
    expect(graydon?.isHitter).toBe(false);
    expect(graydon?.isTwoWay).toBe(false);
  });

  it("supports updated two-way assignments", () => {
    const sean = getPlayerBySlug("noone_sean");

    expect(sean?.isPitcher).toBe(true);
    expect(sean?.isHitter).toBe(true);
    expect(sean?.isTwoWay).toBe(true);
    expect(sean?.role).toBe("Two-Way");
  });

  it("resolves Bobby Christensen from both current and legacy slugs", () => {
    const canonical = getPlayerBySlug("christensen_bobby");
    const legacy = getPlayerBySlug("christensen_robert");

    expect(canonical?.name).toBe("Bobby Christensen");
    expect(canonical?.slug).toBe("christensen_bobby");
    expect(legacy?.name).toBe("Bobby Christensen");
    expect(legacy?.slug).toBe("christensen_bobby");
  });
});
