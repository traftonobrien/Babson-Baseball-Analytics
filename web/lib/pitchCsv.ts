import Papa from "papaparse";
import type { Pitch } from "@/app/types";

const NUM_FIELDS = new Set([
  "pitch_number", "target_frame", "arrival_frame",
  "target_x", "target_y", "ball_x", "ball_y",
  "total_miss_px", "total_miss_inches",
  "h_miss_px", "h_miss_inches", "h_miss_signed",
  "v_miss_px", "v_miss_inches", "v_miss_signed",
  "timestamp",
]);

export function parsePitchCsvText(text: string): Pitch[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data.map((row) => {
    const out: Record<string, unknown> = {};
    out.raw_pitch_type = row.pitch_type ?? "";
    for (const [key, value] of Object.entries(row)) {
      out[key] = NUM_FIELDS.has(key) ? parseFloat(value) : value;
    }
    return out as unknown as Pitch;
  });
}
