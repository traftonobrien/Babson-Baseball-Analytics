"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import type { Pitch } from "../types";

const NUM_FIELDS = new Set([
  "pitch_number", "target_frame", "arrival_frame",
  "target_x", "target_y", "ball_x", "ball_y",
  "total_miss_px", "total_miss_inches",
  "h_miss_px", "h_miss_inches", "h_miss_signed",
  "v_miss_px", "v_miss_inches", "v_miss_signed",
  "timestamp",
]);

export function usePitchData(csvPath: string) {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(csvPath)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load CSV: ${r.status}`);
        return r.text();
      })
      .then((text) => {
        const result = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        const rows: Pitch[] = result.data.map((row) => {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) {
            out[k] = NUM_FIELDS.has(k) ? parseFloat(v) : v;
          }
          return out as unknown as Pitch;
        });
        setPitches(rows);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [csvPath]);

  return { pitches, loading, error };
}
