import { describe, expect, it } from "vitest";
import { parsePitchCsvText } from "./pitchCsv";

describe("parsePitchCsvText", () => {
  it("preserves raw pitch type while parsing numeric fields", () => {
    const csv = [
      "pitch_number,pitch_type,total_miss_inches,h_miss_signed,timestamp",
      "1,FF,11.25,-3.5,12.3",
    ].join("\n");

    const [pitch] = parsePitchCsvText(csv);

    expect(pitch.raw_pitch_type).toBe("FF");
    expect(pitch.pitch_type).toBe("FF");
    expect(pitch.total_miss_inches).toBe(11.25);
    expect(pitch.h_miss_signed).toBe(-3.5);
    expect(pitch.timestamp).toBe(12.3);
  });

  it("keeps blank raw pitch tags so Command+ can exclude them", () => {
    const csv = [
      "pitch_number,pitch_type,total_miss_inches",
      "1,,9.5",
    ].join("\n");

    const [pitch] = parsePitchCsvText(csv);

    expect(pitch.raw_pitch_type).toBe("");
    expect(pitch.pitch_type).toBe("");
  });
});
