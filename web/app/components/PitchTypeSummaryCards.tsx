"use client";

import type { Pitch } from "../types";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { pitchDisplayName } from "@/lib/pitchNames";

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
        return (
          <div
            key={g.type}
            className="overflow-hidden rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          >
            <div className="flex items-center justify-between gap-2">
              <PitchTypeChip pitchType={g.type} label={pitchDisplayName(g.type)} size="xs" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {g.pitches.length} pitch{g.pitches.length !== 1 && "es"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
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
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/70 px-3 py-2.5 text-center">
      <div className="text-lg font-mono font-semibold text-zinc-100">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
    </div>
  );
}
