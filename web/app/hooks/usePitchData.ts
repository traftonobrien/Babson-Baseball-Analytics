"use client";

import { useEffect, useState } from "react";
import type { Pitch } from "../types";
import { getPlayerMeta, getPlayerArsenal } from "@/lib/arsenals";
import { assignPitchTypes } from "@/lib/assignPitchType";
import { updateDebug } from "@/lib/debug";
import { parsePitchCsvText } from "@/lib/pitchCsv";

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
        .then((text) => parsePitchCsvText(text)),
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
