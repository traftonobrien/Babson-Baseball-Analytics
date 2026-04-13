import { describe, expect, it } from "vitest";
import {
  buildManifestValidationSummary,
  resolveManifest,
} from "./manifest.ts";

describe("resolveManifest", () => {
  it("resolves registry-backed conferences from ids", () => {
    const manifest = resolveManifest({
      season: 2026,
      poolId: "starter-pack",
      conferences: [
        { id: "newmac" },
        { id: "liberty-league" },
      ],
    });

    expect(manifest.poolId).toBe("starter-pack");
    expect(manifest.conferences.map((conference) => conference.id)).toEqual([
      "newmac",
      "liberty-league",
    ]);
    expect(manifest.conferences[0]?.source).toBe("registry");
  });

  it("accepts inline conference definitions", () => {
    const manifest = resolveManifest({
      season: 2026,
      conferences: [
        {
          id: "test-conf",
          name: "Test Conference",
          programs: [
            {
              id: "alpha",
              school: "Alpha College",
              nickname: "Aces",
              aliases: ["Alpha"],
              conference: "Test Conference",
              provider: "sidearm",
              baseUrl: "https://alpha.example.com",
              schedulePathTemplate: "/sports/baseball/schedule/{season}",
            },
          ],
        },
      ],
    });

    expect(manifest.conferences[0]?.source).toBe("inline");
    expect(manifest.conferences[0]?.programs).toHaveLength(1);
  });
});

describe("buildManifestValidationSummary", () => {
  it("reports conference counts and total programs", () => {
    const summary = buildManifestValidationSummary(resolveManifest({
      season: 2026,
      poolId: "starter-pack",
      conferences: [{ id: "newmac" }, { id: "nescac" }],
    }));

    expect(summary.totalPrograms).toBe(19);
    expect(summary.conferences).toHaveLength(2);
  });
});
