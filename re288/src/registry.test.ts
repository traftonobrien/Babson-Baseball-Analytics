import { describe, expect, it } from "vitest";
import {
  getSidearmConferenceDefinition,
  listSidearmConferences,
} from "./registry.ts";

describe("conference registry", () => {
  it("lists the starter pack of runnable conferences", () => {
    expect(listSidearmConferences().map((conference) => conference.id)).toEqual([
      "newmac",
      "nescac",
      "liberty-league",
    ]);
  });

  it("loads NESCAC and Liberty League program packs", () => {
    expect(getSidearmConferenceDefinition("nescac").programs).toHaveLength(10);
    expect(getSidearmConferenceDefinition("liberty-league").programs).toHaveLength(11);
  });
});
