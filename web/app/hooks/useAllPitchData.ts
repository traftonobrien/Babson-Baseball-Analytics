"use client";

import { useEffect, useState } from "react";
import type { Pitch } from "../types";
import { getPlayerMeta, getPlayerArsenal } from "@/lib/arsenals";
import { assignPitchTypes } from "@/lib/assignPitchType";
import { updateDebug } from "@/lib/debug";
import { parsePitchCsvText } from "@/lib/pitchCsv";

export function useAllPitchData(csvPaths: string[], playerId: string) {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [pitcherHand, setPitcherHand] = useState<"R" | "L">("R");
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
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      Promise.all(
        csvPaths.map((p) =>
          fetch(p)
            .then((r) => {
              if (!r.ok) throw new Error(`Failed to load CSV: ${r.status} (${p})`);
              return r.text();
            })
            .then((text) => parsePitchCsvText(text)),
        ),
      ),
      getPlayerMeta(playerId),
      getPlayerArsenal(playerId),
    ])
      .then(([arrays, meta, arsenal]) => {
        if (cancelled) return;
        const hand = meta.pitcherHand === "L" ? "L" : "R";
        const allRows = arrays.flat();
        const assigned = assignPitchTypes(allRows, playerId, arsenal);
        setPitches(assigned);
        setPitcherHand(hand);
        updateDebug(playerId, hand, assigned);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [key, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { pitches, pitcherHand, loading, error };
}
