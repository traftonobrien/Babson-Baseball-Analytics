import { describe, it, expect } from "vitest";
import { pitchGroupOf, pitchMatchesGroup } from "./pitchGroups";

describe("pitchGroupOf", () => {
  it("classifies fastball types", () => {
    expect(pitchGroupOf("FF")).toBe("FASTBALL");
    expect(pitchGroupOf("FT")).toBe("FASTBALL");
    expect(pitchGroupOf("SI")).toBe("FASTBALL");
    expect(pitchGroupOf("FC")).toBe("FASTBALL");
    expect(pitchGroupOf("FS")).toBe("FASTBALL");
    expect(pitchGroupOf("FB")).toBe("FASTBALL");
  });

  it("classifies breaking types", () => {
    expect(pitchGroupOf("SL")).toBe("BREAKING");
    expect(pitchGroupOf("CU")).toBe("BREAKING");
    expect(pitchGroupOf("KC")).toBe("BREAKING");
    expect(pitchGroupOf("CS")).toBe("BREAKING");
    expect(pitchGroupOf("SV")).toBe("BREAKING");
    expect(pitchGroupOf("CB")).toBe("BREAKING");
  });

  it("returns UNKNOWN for unrecognized types", () => {
    expect(pitchGroupOf("CH")).toBe("UNKNOWN");
    expect(pitchGroupOf("EP")).toBe("UNKNOWN");
    expect(pitchGroupOf("")).toBe("UNKNOWN");
  });

  it("is case-insensitive", () => {
    expect(pitchGroupOf("ff")).toBe("FASTBALL");
    expect(pitchGroupOf("sl")).toBe("BREAKING");
    expect(pitchGroupOf("Ff")).toBe("FASTBALL");
  });
});

describe("pitchMatchesGroup", () => {
  it("ALL matches everything", () => {
    expect(pitchMatchesGroup("FF", "ALL")).toBe(true);
    expect(pitchMatchesGroup("SL", "ALL")).toBe(true);
    expect(pitchMatchesGroup("CH", "ALL")).toBe(true);
    expect(pitchMatchesGroup("", "ALL")).toBe(true);
  });

  it("FASTBALL matches only fastball types", () => {
    expect(pitchMatchesGroup("FF", "FASTBALL")).toBe(true);
    expect(pitchMatchesGroup("SI", "FASTBALL")).toBe(true);
    expect(pitchMatchesGroup("SL", "FASTBALL")).toBe(false);
    expect(pitchMatchesGroup("CH", "FASTBALL")).toBe(false);
  });

  it("BREAKING matches only breaking types", () => {
    expect(pitchMatchesGroup("SL", "BREAKING")).toBe(true);
    expect(pitchMatchesGroup("CU", "BREAKING")).toBe(true);
    expect(pitchMatchesGroup("FF", "BREAKING")).toBe(false);
    expect(pitchMatchesGroup("CH", "BREAKING")).toBe(false);
  });
});
