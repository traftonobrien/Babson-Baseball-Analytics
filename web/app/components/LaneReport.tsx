"use client";

import type { Pitch } from "../types";
import { pitchColor } from "../utils";

export type Lane = "outside" | "middle" | "inside";

interface LaneReportProps {
  pitches: Pitch[];
  pitcherHand?: "R" | "L";
  activeLane?: Lane | null;
  onSelectLane?: (lane: Lane) => void;
}

interface LaneBucket {
  key: Lane;
  label: string;
  pitches: Pitch[];
  avgTotal: number;
  avgH: number;
  avgV: number;
}

function avg(arr: Pitch[], fn: (p: Pitch) => number): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, p) => s + fn(p), 0) / arr.length;
}

function hLabel(v: number): string {
  if (Math.abs(v) < 0.05) return "";
  return v < 0 ? "arm-side" : "glove-side";
}

function vLabel(v: number): string {
  if (Math.abs(v) < 0.05) return "";
  return v < 0 ? "high" : "low";
}

function buildBuckets(pitches: Pitch[]): LaneBucket[] {
  const inside: Pitch[] = [];
  const middle: Pitch[] = [];
  const outside: Pitch[] = [];

  for (const p of pitches) {
    const h = p.h_miss_signed;
    if (h >= 4) inside.push(p);
    else if (h <= -4) outside.push(p);
    else middle.push(p);
  }

  return [
    { key: "outside" as Lane, label: "Outside", pitches: outside },
    { key: "middle" as Lane, label: "Middle", pitches: middle },
    { key: "inside" as Lane, label: "Inside", pitches: inside },
  ].map((b) => ({
    ...b,
    avgTotal: avg(b.pitches, (p) => p.total_miss_inches),
    avgH: avg(b.pitches, (p) => p.h_miss_signed),
    avgV: avg(b.pitches, (p) => p.v_miss_signed),
  }));
}

interface TypeGroup {
  type: string;
  pitches: Pitch[];
}

function groupByType(pitches: Pitch[]): TypeGroup[] {
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

function LanePanel({
  buckets,
  maxAvgTotal,
  activeLane,
  onSelectLane,
}: {
  buckets: LaneBucket[];
  maxAvgTotal: number;
  activeLane?: Lane | null;
  onSelectLane?: (lane: Lane) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {buckets.map((b) => {
        const isActive = activeLane === b.key;
        const isDimmed = activeLane != null && !isActive;

        return (
          <button
            key={b.key}
            type="button"
            onClick={() => onSelectLane?.(b.key)}
            className={[
              "flex flex-col items-center gap-2 rounded-md p-2 transition-all cursor-pointer",
              isActive
                ? "border border-zinc-300/40 ring-2 ring-zinc-300/20 bg-zinc-800/60"
                : "border border-transparent",
              isDimmed ? "opacity-50 hover:opacity-80" : "",
            ].join(" ")}
          >
            <div className="w-full h-24 flex items-end justify-center">
              <div
                className="w-10 rounded-t bg-blue-500/60 transition-all"
                style={{
                  height:
                    b.pitches.length > 0
                      ? `${Math.max((b.avgTotal / maxAvgTotal) * 100, 4)}%`
                      : "0%",
                }}
              />
            </div>
            <div className="text-sm font-semibold">{b.label}</div>
            <div className="text-xs text-zinc-500">
              {b.pitches.length} pitch{b.pitches.length !== 1 && "es"}
            </div>
            {b.pitches.length > 0 && (
              <div className="w-full space-y-1 text-center">
                <div className="text-xs text-zinc-400">
                  Avg miss{" "}
                  <span className="font-mono text-zinc-100">
                    {b.avgTotal.toFixed(1)}&quot;
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  H{" "}
                  <span className="font-mono text-zinc-100">
                    {Math.abs(b.avgH).toFixed(1)}&quot;
                  </span>{" "}
                  <span className="text-zinc-500">{hLabel(b.avgH)}</span>
                </div>
                <div className="text-xs text-zinc-400">
                  V{" "}
                  <span className="font-mono text-zinc-100">
                    {Math.abs(b.avgV).toFixed(1)}&quot;
                  </span>{" "}
                  <span className="text-zinc-500">{vLabel(b.avgV)}</span>
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function LaneReport({ pitches, activeLane, onSelectLane }: LaneReportProps) {
  if (pitches.length === 0) return null;

  const groups = groupByType(pitches);

  // Global max for consistent bar scaling across all panels
  const allBuckets = groups.map((g) => buildBuckets(g.pitches));
  const maxAvgTotal = Math.max(
    ...allBuckets.flatMap((bs) => bs.map((b) => b.avgTotal)),
    1,
  );

  const cols =
    groups.length <= 2 ? "grid-cols-1 sm:grid-cols-2" :
    groups.length === 3 ? "grid-cols-1 sm:grid-cols-3" :
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-2">
        Click a lane to filter. Click again to clear.
      </p>
      <div className={`grid ${cols} gap-3`}>
        {groups.map((g, i) => {
          const color = pitchColor(g.type);
          const buckets = allBuckets[i];
          return (
            <div
              key={g.type}
              className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden p-4"
              style={{ borderLeftColor: color, borderLeftWidth: 3 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: color + "22", color }}
                >
                  {g.type}
                </span>
                <span className="text-xs uppercase tracking-wider text-zinc-400">
                  Lane Breakdown
                </span>
              </div>
              <LanePanel
                buckets={buckets}
                maxAvgTotal={maxAvgTotal}
                activeLane={activeLane}
                onSelectLane={onSelectLane}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
