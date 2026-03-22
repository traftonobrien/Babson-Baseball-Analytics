"use client";

import type { CSSProperties } from "react";
import type { Pitch } from "../types";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { pitchColor } from "@/lib/pitchColors";
import { pitchDisplayName } from "@/lib/pitchNames";
import { sortPitchTypes } from "@/lib/pitchTypeOrder";

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

/** Group pitches by type using the shared command-page family order. */
export function groupByType(pitches: Pitch[]): Group[] {
  const map = new Map<string, Pitch[]>();
  for (const p of pitches) {
    const t = p.pitch_type || "UNK";
    const arr = map.get(t);
    if (arr) arr.push(p);
    else map.set(t, [p]);
  }
  return sortPitchTypes([...map.entries()], ([type]) => type).map(
    ([type, pitches]) => ({ type, pitches }),
  );
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
              <PitchTypeChip pitchType={g.type} label={pitchDisplayName(g.type)} size="xs" variant="solid" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {g.pitches.length} pitch{g.pitches.length !== 1 && "es"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat
                label="Avg Miss"
                value={`${avg(g.pitches, (p) => p.total_miss_inches).toFixed(1)}"`}
                pitchType={g.type}
              />
              <Stat
                label="Usage %"
                value={`${Math.round((g.pitches.length / pitches.length) * 100)}%`}
                pitchType={g.type}
              />
              <Stat
                label="V Miss"
                value={`${avg(g.pitches, (p) => p.v_miss_inches).toFixed(1)}"`}
                pitchType={g.type}
              />
              <Stat
                label="H Miss"
                value={`${avg(g.pitches, (p) => p.h_miss_inches).toFixed(1)}"`}
                pitchType={g.type}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function hexToRgbChannels(value: string): string {
  const normalized = value.trim();
  const fullHex =
    normalized.startsWith("#") && normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;

  const match = /^#([0-9a-f]{6})$/i.exec(fullHex);
  if (!match) return "113, 113, 122";

  const hex = match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

function statStyle(pitchType: string): CSSProperties {
  const color = pitchColor(pitchType);
  const rgb = hexToRgbChannels(color);

  return {
    borderColor: `rgba(${rgb}, 0.18)`,
    boxShadow: [
      "inset 0 1px 0 rgba(255,255,255,0.03)",
      `0 0 0 1px rgba(${rgb}, 0.05)`,
      `0 0 14px rgba(${rgb}, 0.08)`,
    ].join(", "),
  };
}

function Stat({
  label,
  value,
  pitchType,
}: {
  label: string;
  value: string;
  pitchType: string;
}) {
  return (
    <div
      className="h-[3.75rem] w-[7.5rem] justify-self-center rounded-full border bg-[linear-gradient(180deg,rgba(24,24,27,0.78),rgba(9,9,11,0.92))] px-3 py-1.5 text-center"
      style={statStyle(pitchType)}
    >
      <div className="flex h-full flex-col items-center justify-center">
        <div className="text-[1.22rem] font-mono font-semibold leading-none text-zinc-100">
          {value}
        </div>
        <div className="mt-0.5 max-w-[6rem] whitespace-nowrap text-[8px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </div>
      </div>
    </div>
  );
}
