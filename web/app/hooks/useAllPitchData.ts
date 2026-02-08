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

function parseCsvText(text: string): Pitch[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = NUM_FIELDS.has(k) ? parseFloat(v) : v;
    }
    return out as unknown as Pitch;
  });
}

export function useAllPitchData(csvPaths: string[]) {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable key for the effect
  const key = csvPaths.join("\n");

  useEffect(() => {
    if (csvPaths.length === 0) {
      setPitches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    Promise.all(
      csvPaths.map((p) =>
        fetch(p)
          .then((r) => {
            if (!r.ok) throw new Error(`Failed to load CSV: ${r.status} (${p})`);
            return r.text();
          })
          .then((text) => parseCsvText(text)),
      ),
    )
      .then((arrays) => {
        setPitches(arrays.flat());
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { pitches, loading, error };
}
