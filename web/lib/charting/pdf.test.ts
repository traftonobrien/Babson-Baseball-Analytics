import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { fixtureGameSnapshot } from "./fixtures";
import {
  buildChartingPdf,
  buildChartingPdfFilename,
  buildChartingPdfModel,
} from "./pdf";

describe("buildChartingPdfModel", () => {
  it("projects the fixture snapshot into paper-style cards and pitcher totals", () => {
    const model = buildChartingPdfModel(fixtureGameSnapshot);

    expect(model.pages).toHaveLength(1);
    expect(model.pages[0]?.cards).toHaveLength(3);
    expect(model.pages[0]?.cards[0]).toMatchObject({
      sequence: 1,
      inningLabel: "Top 1",
      hitterLabel: "#1 Smith",
      pitcherName: "D. James",
      resultCode: "K",
    });
    expect(model.pages[0]?.cards[1]?.pitches.map((pitch) => pitch.resultLabel)).toEqual([
      "B",
      "B",
      "B",
      "B",
    ]);
    expect(model.pitcherRows).toMatchObject([
      { name: "D. James", battersFaced: 2, pitches: 7 },
      { name: "C. Burrows", battersFaced: 1, pitches: 1 },
    ]);
    expect(model.totals).toMatchObject({
      plateAppearances: 3,
      pitches: 8,
      strikes: 3,
      balls: 5,
    });
  });

  it("carries finalized pitcher overrides into the summary table", () => {
    const snapshotWithOverrides = {
      ...fixtureGameSnapshot,
      segments: fixtureGameSnapshot.segments.map((segment, index) =>
        index === 0
          ? { ...segment, runsOverride: 2, earnedRunsOverride: 1 }
          : segment
      ),
    };

    const model = buildChartingPdfModel(snapshotWithOverrides);

    expect(model.pitcherRows[0]).toMatchObject({
      name: "D. James",
      runs: "2",
      earnedRuns: "1",
    });
  });
});

describe("buildChartingPdf", () => {
  it("renders a valid landscape pdf for the fixture snapshot", async () => {
    const bytes = await buildChartingPdf(fixtureGameSnapshot);
    const pdf = await PDFDocument.load(bytes);
    const [page] = pdf.getPages();

    expect(bytes.byteLength).toBeGreaterThan(4000);
    expect(pdf.getPageCount()).toBe(1);
    expect(page.getWidth()).toBeGreaterThan(page.getHeight());
  });
});

describe("buildChartingPdfFilename", () => {
  it("produces a download-safe pdf filename", () => {
    expect(
      buildChartingPdfFilename({
        gameDate: "2026-03-01",
        opponent: "Saint Joseph's (ME)",
      })
    ).toBe("charting-2026-03-01-saint-joseph-s-me.pdf");
  });
});
