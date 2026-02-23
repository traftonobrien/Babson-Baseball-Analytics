"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import type { Pitch } from "../types";
import { getPlayerMeta, getPlayerArsenal } from "@/lib/arsenals";
import { assignPitchTypes } from "@/lib/assignPitchType";
import { updateDebug } from "@/lib/debug";

const NUM_FIELDS = new Set([
  "pitch_number", "target_frame", "arrival_frame",
  "target_x", "target_y", "ball_x", "ball_y",
  "total_miss_px", "total_miss_inches",
  "h_miss_px", "h_miss_inches", "h_miss_signed",
  "v_miss_px", "v_miss_inches", "v_miss_signed",
  "timestamp",
]);

export function usePitchData(csvPath: string, playerId: string) {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [pitcherHand, setPitcherHand] = useState<"R" | "L">("R");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
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
          return result.data.map((row) => {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(row)) {
              out[k] = NUM_FIELDS.has(k) ? parseFloat(v) : v;
            }
            return out as unknown as Pitch;
          });
        }),
      getPlayerMeta(playerId),
      getPlayerArsenal(playerId),
    ])
      .then(([rows, meta, arsenal]) => {
        if (cancelled) return;
        const hand = meta.pitcherHand === "L" ? "L" : "R";
        const assigned = assignPitchTypes(rows, playerId, arsenal);
        setPitches(assigned);
        setPitcherHand(hand);
        updateDebug(playerId, hand, rows);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [csvPath, playerId]);

  return { pitches, pitcherHand, loading, error };
}
