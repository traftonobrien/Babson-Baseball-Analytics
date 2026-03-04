"use client";

import { useState, useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import { pitchDisplayName } from "@/lib/pitchNames";
import type { TrackmanPitch } from "@/lib/trackman/metrics";

type SortKey = keyof TrackmanPitch;

function fmt(v: number | null, d = 1): string {
  if (v === null) return "\u2014";
  return v.toFixed(d);
}

const columns: { key: SortKey; label: string; decimals: number; align: "left" | "right" }[] = [
  { key: "pitchNo", label: "#", decimals: 0, align: "left" },
  { key: "pitchType", label: "Type", decimals: 0, align: "left" },
  { key: "mph", label: "Velo", decimals: 1, align: "right" },
  { key: "rpm", label: "Spin", decimals: 0, align: "right" },
  { key: "ivb", label: "IVB", decimals: 1, align: "right" },
  { key: "hb", label: "HB", decimals: 1, align: "right" },
  { key: "extension", label: "Ext", decimals: 1, align: "right" },
  { key: "relHeight", label: "Rel H", decimals: 2, align: "right" },
  { key: "relSide", label: "Rel S", decimals: 2, align: "right" },
];

export default function TrackmanPitchTable({ pitches }: { pitches: TrackmanPitch[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("pitchNo");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    const arr = [...pitches];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [pitches, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-zinc-800/50 text-zinc-400 uppercase">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 cursor-pointer hover:text-zinc-200 transition-smooth select-none ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-0.5">{sortAsc ? "\u25B2" : "\u25BC"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.pitchNo}
                className="border-t border-zinc-800/50 hover:bg-zinc-800/30 transition-smooth"
              >
                <td className="px-3 py-1.5 font-mono text-zinc-400">{p.pitchNo}</td>
                <td className="px-3 py-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: pitchColor(p.pitchType) }}
                  />
                  {pitchDisplayName(p.pitchType)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(p.mph)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(p.rpm, 0)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(p.ivb)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(p.hb)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(p.extension)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(p.relHeight, 2)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(p.relSide, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
