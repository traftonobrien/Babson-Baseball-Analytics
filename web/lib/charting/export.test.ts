import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { fixtureGameSnapshot } from "./fixtures";
import {
  buildChartingExportCsv,
  buildChartingExportFilename,
  buildChartingExportRows,
  CHARTING_EXPORT_COLUMNS,
} from "./export";

describe("buildChartingExportRows", () => {
  it("emits one row per pitch in plate appearance order", () => {
    const rows = buildChartingExportRows(fixtureGameSnapshot);

    expect(rows).toHaveLength(fixtureGameSnapshot.pitches.length);
    expect(rows.map((row) => row.pitch_number)).toEqual([
      1, 2, 3, 1, 2, 3, 4, 1,
    ]);
  });

  it("populates simplified columns for the first pitch", () => {
    const [firstRow] = buildChartingExportRows(fixtureGameSnapshot);

    expect(firstRow).toMatchObject({
      inning: 1,
      pitcher_id: "DJames1",
      pitcher: "D. James",
      hitter: "Smith",
      initial_count: "0-0",
      pitch_type: "Fastball",
      pitch_result: "called_strike",
      count: "0-0",
      pitch_number: 1,
    });
  });

  it("only shows pa_result on the last pitch of a completed PA", () => {
    const rows = buildChartingExportRows(fixtureGameSnapshot);

    // First PA (3 pitches, result K) — only the 3rd pitch should have pa_result
    expect(rows[0]?.pa_result).toBeNull();
    expect(rows[1]?.pa_result).toBeNull();
    expect(rows[2]?.pa_result).toBe("K");

    // Third PA (1 pitch, no result) — should be null
    expect(rows[7]?.pa_result).toBeNull();
  });

  it("preserves velocity in export rows when it exists on the pitch", () => {
    const snapshot = {
      ...fixtureGameSnapshot,
      pitches: fixtureGameSnapshot.pitches.map((pitch, index) =>
        index === 0 ? { ...pitch, velocity: 93 } : pitch
      ),
    };

    const [firstRow] = buildChartingExportRows(snapshot);
    expect(firstRow?.velocity).toBe(93);
  });
});

describe("buildChartingExportCsv", () => {
  it("serializes the rows into a parseable CSV with stable headers", () => {
    const csv = buildChartingExportCsv(fixtureGameSnapshot);
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.meta.fields).toEqual([...CHARTING_EXPORT_COLUMNS]);
    expect(parsed.data).toHaveLength(fixtureGameSnapshot.pitches.length);
    expect(parsed.data[0]?.pitcher_id).toBe("DJames1");
    expect(parsed.data[0]?.pitch_number).toBe("1");
    expect(parsed.data[0]?.initial_count).toBe("0-0");
    expect(parsed.data[7]?.pitch_type).toBe("Split/Cut");
    expect(parsed.data[7]?.pa_result).toBe("");
  });
});

describe("buildChartingExportFilename", () => {
  it("produces a download-safe csv filename", () => {
    expect(
      buildChartingExportFilename({
        gameDate: "2026-03-01",
        opponent: "Saint Joseph's (ME)",
      })
    ).toBe("charting-2026-03-01-saint-joseph-s-me.csv");
  });
});
