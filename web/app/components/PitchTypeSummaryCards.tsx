"use client";

import type { Pitch } from "../types";
import { pitchColor } from "../utils";

interface Props {
  pitches: Pitch[];
}

function avg(arr: Pitch[], fn: (p: Pitch) => number): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, p) => s + fn(p), 0) / arr.length;
}

interface Group {
  type: string;
  pitches: Pitch[];
}

/** Group pitches by type, sorted by descending count. Exported for shared ordering. */
export function groupByType(pitches: Pitch[]): Group[] {
  const map = new Map<string, Pitch[]>();
  for (const p of pitches) {
    const t = p.pitch_type || "UNK";
    const arr = map.get(t);
    if (arr) arr.push(p);
    else map.set(t, [p]);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([type, pitches]) => ({ type, pitches }));
}

/** Grid column classes for a given number of items. Shared with MLBAverageStripCards. */
export function gridColsClass(count: number): string {
  return count <= 2 ? "grid-cols-1 sm:grid-cols-2" :
    count === 3 ? "grid-cols-1 sm:grid-cols-3" :
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

export default function PitchTypeSummaryCards({ pitches }: Props) {
  if (pitches.length === 0) return null;

  const groups = groupByType(pitches);
  const cols = gridColsClass(groups.length);

  return (
    <div className={`grid ${cols} gap-3`}>
      {groups.map((g) => {
        const color = pitchColor(g.type);
        return (
          <div
            key={g.type}
            className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden"
            style={{ borderLeftColor: color, borderLeftWidth: 3 }}
          >
            {/* Type badge */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-1">
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: color + "22", color }}
              >
                {g.type}
              </span>
              <span className="text-xs text-zinc-500">
                {g.pitches.length} pitch{g.pitches.length !== 1 && "es"}
              </span>
            </div>

            {/* 2x2 stat grid */}
            <div className="grid grid-cols-2 gap-px p-3 pt-2">
              <Stat
                label="Avg Miss"
                value={`${avg(g.pitches, (p) => p.total_miss_inches).toFixed(1)}"`}
              />
              <Stat
                label="Avg H Miss"
                value={`${avg(g.pitches, (p) => p.h_miss_inches).toFixed(1)}"`}
              />
              <Stat
                label="Avg V Miss"
                value={`${avg(g.pitches, (p) => p.v_miss_inches).toFixed(1)}"`}
              />
              <Stat
                label="Pitches"
                value={String(g.pitches.length)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center py-1">
      <div className="text-lg font-mono font-semibold">{value}</div>
      <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}
