import { describe, expect, it } from "vitest";
import {
  getCanonicalName,
  getCanonicalPlayerId,
  getHand,
  getSlugForPlayerId,
} from "./canonicalPlayers";

describe("canonicalPlayers", () => {
  it("uses playerId as the canonical identity key", () => {
    expect(getCanonicalName("TOBrien1")).toBe("Trafton OBrien");
    expect(getSlugForPlayerId("TOBrien1")).toBe("obrien_trafton");
    expect(getHand("TOBrien1")).toBe("R");
  });

  it("resolves canonical playerId from slug aliases", () => {
    expect(getCanonicalPlayerId("obrien_trafton")).toBe("TOBrien1");
    expect(getCanonicalPlayerId("trafton_obrien")).toBe("TOBrien1");
    expect(getCanonicalPlayerId("smith_cooper")).toBe("CSmith1");
  });

  it("recognizes messy name variants for the same player", () => {
    expect(getCanonicalPlayerId("TOBrien 1")).toBe("TOBrien1");
    expect(getCanonicalPlayerId("T OBrien")).toBe("TOBrien1");
    expect(getCanonicalPlayerId("Trafton O'Brien")).toBe("TOBrien1");
    expect(getCanonicalPlayerId("OBrien, Trafton")).toBe("TOBrien1");
    expect(getCanonicalPlayerId("OBrien")).toBe("TOBrien1");
    expect(getCanonicalPlayerId("Trafton")).toBe("TOBrien1");
    expect(getCanonicalPlayerId("Smith, Cooper")).toBe("CSmith1");
  });

  it("normalizes display values back to the canonical name", () => {
    expect(getCanonicalName("O'Brien, Trafton")).toBe("Trafton OBrien");
    expect(getCanonicalName("trafton_obrien")).toBe("Trafton OBrien");
    expect(getCanonicalName("T OBrien")).toBe("Trafton OBrien");
    expect(getCanonicalName("smith_cooper")).toBe("Cooper Smith");
  });

  it("skips ambiguous short aliases", () => {
    expect(getCanonicalPlayerId("James")).toBeNull();
  });
});
