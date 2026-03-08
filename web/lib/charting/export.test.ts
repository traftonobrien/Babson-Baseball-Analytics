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
  it("emits one normalized row per pitch in plate appearance order", () => {
    const rows = buildChartingExportRows(fixtureGameSnapshot);

    expect(rows).toHaveLength(fixtureGameSnapshot.pitches.length);
    expect(rows.map((row) => row.game_pitch_sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(rows.map((row) => row.pa_id)).toEqual([
      "fixture-pa-1",
      "fixture-pa-1",
      "fixture-pa-1",
      "fixture-pa-2",
      "fixture-pa-2",
      "fixture-pa-2",
      "fixture-pa-2",
      "fixture-pa-3",
    ]);
  });

  it("includes repeated game, segment, and plate appearance context on each row", () => {
    const [firstRow] = buildChartingExportRows(fixtureGameSnapshot);

    expect(firstRow).toMatchObject({
      game_id: "fixture-game-001",
      game_date: "2026-03-01",
      opponent: "MIT",
      game_status: "active",
      pitcher_player_id: "DJames1",
      pitcher_name: "D. James",
      pa_result_code: "K",
      hitter_name: "Smith",
      pitch_type: "Fastball",
      pitch_result: "called_strike",
      count_before: "0-0",
      pitch_number_in_pa: 1,
    });
  });

  it("repeats finalized pitcher overrides on the exported rows for each segment", () => {
    const snapshotWithOverrides = {
      ...fixtureGameSnapshot,
      segments: fixtureGameSnapshot.segments.map((segment, index) =>
        index === 0
          ? { ...segment, runsOverride: 2, earnedRunsOverride: 1 }
          : { ...segment, runsOverride: 1, earnedRunsOverride: 0 }
      ),
    };

    const rows = buildChartingExportRows(snapshotWithOverrides);

    expect(rows[0]).toMatchObject({
      pitcher_name: "D. James",
      runs_override: 2,
      earned_runs_override: 1,
    });
    expect(rows[7]).toMatchObject({
      pitcher_name: "C. Burrows",
      runs_override: 1,
      earned_runs_override: 0,
    });
  });
});

describe("buildChartingExportCsv", () => {
  it("serializes the normalized rows into a parseable CSV with stable headers", () => {
    const csv = buildChartingExportCsv(fixtureGameSnapshot);
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.meta.fields).toEqual([...CHARTING_EXPORT_COLUMNS]);
    expect(parsed.data).toHaveLength(fixtureGameSnapshot.pitches.length);
    expect(parsed.data[0]?.weather).toBe("Clear, 48F");
    expect(parsed.data[0]?.game_pitch_sequence).toBe("1");
    expect(parsed.data[0]?.pitch_number_in_pa).toBe("1");
    expect(parsed.data[7]?.pitch_type).toBe("Split/Cut");
    expect(parsed.data[7]?.pa_result_code).toBe("");
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
