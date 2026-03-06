"use client";

import type { Pitch } from "../types";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { pitchColor } from "@/lib/pitchColors";
import { pitchArmSideX, laneOf as classifyLane, laneDisplayName, hDirectionLabel, type Lane } from "@/lib/handedness";
import { pitchDisplayName } from "@/lib/pitchNames";
import { sortPitchTypes } from "@/lib/pitchTypeOrder";

export type { Lane } from "@/lib/handedness";

interface LaneReportProps {
  pitches: Pitch[];
  throwsHand: "R" | "L";
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

function hLabel(armSideX: number): string {
  if (Math.abs(armSideX) < 0.05) return "";
  return hDirectionLabel(armSideX);
}

function vLabel(v: number): string {
  if (Math.abs(v) < 0.05) return "";
  return v < 0 ? "high" : "low";
}

function hexToRgbChannels(value: string): string {
  const normalized = value.trim();
  const fullHex =
    normalized.startsWith("#") && normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;

  const match = /^#([0-9a-f]{6})$/i.exec(fullHex);
  if (!match) return "249, 115, 22";

  const hex = match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

function buildBuckets(pitches: Pitch[], throwsHand: "R" | "L"): LaneBucket[] {
  const glove: Pitch[] = [];
  const middle: Pitch[] = [];
  const arm: Pitch[] = [];

  for (const p of pitches) {
    const lane = classifyLane(pitchArmSideX(p, throwsHand));
    if (lane === "Arm") arm.push(p);
    else if (lane === "Glove") glove.push(p);
    else middle.push(p);
  }

  return [
    { key: "Glove" as Lane, label: laneDisplayName("Glove", throwsHand), pitches: glove },
    { key: "Middle" as Lane, label: "Middle", pitches: middle },
    { key: "Arm" as Lane, label: laneDisplayName("Arm", throwsHand), pitches: arm },
  ].map((b) => ({
    ...b,
    avgTotal: avg(b.pitches, (p) => p.total_miss_inches),
    avgH: avg(b.pitches, (p) => pitchArmSideX(p, throwsHand)),
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
  return sortPitchTypes([...map.entries()], ([type]) => type).map(
    ([type, groupPitches]) => ({ type, pitches: groupPitches }),
  );
}

function LanePanel({
  buckets,
  maxAvgTotal,
  activeLane,
  onSelectLane,
  barColor,
}: {
  buckets: LaneBucket[];
  maxAvgTotal: number;
  activeLane?: Lane | null;
  onSelectLane?: (lane: Lane) => void;
  barColor: string;
}) {
  const barRgb = hexToRgbChannels(barColor);

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
              "flex flex-col items-center gap-2 rounded-2xl border p-3 transition-smooth cursor-pointer",
              isActive
                ? "border-orange-400/30 bg-orange-500/[0.08] ring-2 ring-orange-400/10"
                : "border-zinc-800/70 bg-zinc-950/55 hover:border-zinc-700/80",
              isDimmed ? "opacity-50 hover:opacity-80" : "",
            ].join(" ")}
          >
            <div className="flex h-24 w-full items-end justify-center">
              <div
                className="w-10 rounded-t transition-all"
                style={{
                  background: `linear-gradient(180deg, rgba(${barRgb}, 0.98), rgba(${barRgb}, 0.72))`,
                  boxShadow: `0 0 22px rgba(${barRgb}, 0.18), inset 0 1px 0 rgba(255,255,255,0.18)`,
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

export default function LaneReport({ pitches, throwsHand, activeLane, onSelectLane }: LaneReportProps) {
  if (pitches.length === 0) return null;

  const groups = groupByType(pitches);

  // Global max for consistent bar scaling across all panels
  const allBuckets = groups.map((g) => buildBuckets(g.pitches, throwsHand));
  const maxAvgTotal = Math.max(
    ...allBuckets.flatMap((bs) => bs.map((b) => b.avgTotal)),
    1,
  );

  const cols =
    groups.length <= 2 ? "grid-cols-1 sm:grid-cols-2" :
    groups.length === 3 ? "grid-cols-1 sm:grid-cols-3" :
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="rounded-[1.8rem] border border-zinc-800/80 bg-zinc-950/72 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Lane Report
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            See how misses play across glove side, middle, and arm side.
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">
        Click a lane to filter. Click again to clear it.
      </p>
      <div className={`mt-4 grid ${cols} gap-3`}>
        {groups.map((g, i) => {
          const buckets = allBuckets[i];
          return (
            <div
              key={g.type}
              className="overflow-hidden rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/62 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <PitchTypeChip pitchType={g.type} label={pitchDisplayName(g.type)} size="xs" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  By Lane
                </span>
              </div>
              <LanePanel
                buckets={buckets}
                maxAvgTotal={maxAvgTotal}
                activeLane={activeLane}
                onSelectLane={onSelectLane}
                barColor={pitchColor(g.type)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
