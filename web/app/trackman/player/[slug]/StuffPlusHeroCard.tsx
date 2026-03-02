"use client";

import Link from "next/link";
import { pitchColor } from "@/lib/pitchColors";
import {
  computeTotalStuffPlus,
  stuffPlusAccentClass,
  plusMetricBadgeStyle,
} from "@/lib/stuffPlusUtils";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";

const FASTBALL_TYPES = new Set(["Fastball", "Sinker"]);
const BREAKING_TYPES = new Set(["Slider", "Curveball", "Sweeper"]);

interface StuffPlusPitch {
  pitchType: string;
  meanStuffPlus: number;
}

interface AggregatedPitch {
  pitchType: string;
  avgVelo: number | null;
  avgSpin: number | null;
}

interface SessionEntry {
  date: string;
  pitchTypesPath?: string;
}

interface Props {
  arsenal: StuffPlusPitch[];
  playerId: string;
  entries: SessionEntry[];
  aggregated: AggregatedPitch[];
}

function extractDateSlug(path?: string): string | null {
  if (!path) return null;
  const match = path.match(/\/trackman\/sessions\/[^/]+\/([^/]+)\//);
  return match?.[1] ?? null;
}

function formatDate(raw: string): string {
  const parts = raw.replace(/_/g, "-").split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const shortYear = y.length === 4 ? y.slice(2) : y;
    return `${parseInt(m)}/${parseInt(d)}/${shortYear}`;
  }
  return raw;
}

/**
 * Unified top summary: Hero total Stuff+ | Per-pitch breakdown | Sessions + key metrics
 */
export default function StuffPlusHeroCard({
  arsenal,
  playerId,
  entries,
  aggregated,
}: Props) {
  if (arsenal.length === 0) return null;

  const total = computeTotalStuffPlus(arsenal);
  const sorted = [...arsenal].sort((a, b) => b.meanStuffPlus - a.meanStuffPlus);
  const accentBorder =
    total != null ? `border-l-4 ${stuffPlusAccentClass(total)}` : "";

  // Key metrics from aggregated
  const fbVelos = aggregated
    .filter((p) => FASTBALL_TYPES.has(p.pitchType) && p.avgVelo != null)
    .map((p) => p.avgVelo!);
  const bbSpins = aggregated
    .filter((p) => BREAKING_TYPES.has(p.pitchType) && p.avgSpin != null)
    .map((p) => p.avgSpin!);
  const fbVelo =
    fbVelos.length > 0
      ? fbVelos.reduce((a, b) => a + b, 0) / fbVelos.length
      : null;
  const bbSpin =
    bbSpins.length > 0
      ? bbSpins.reduce((a, b) => a + b, 0) / bbSpins.length
      : null;

  const sessionCount = entries.length;
  const latestEntry = entries[0];
  const latestDateSlug = latestEntry
    ? extractDateSlug(latestEntry.pitchTypesPath) ?? latestEntry.date.replace(/-/g, "_")
    : null;

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-lg shadow-black/20 transition-smooth ${accentBorder}`}
    >
      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-zinc-800/80">
        {/* 1. Hero total */}
        {total != null && (
          <div className="flex flex-col items-center justify-center p-6 lg:min-w-[180px] lg:py-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-medium">
              Total Stuff+
            </p>
            <div
              className="inline-flex items-center justify-center min-w-[5rem] rounded-xl px-5 py-2.5 font-mono text-4xl font-bold tracking-tight"
              style={plusMetricBadgeStyle(total)}
            >
              {total.toFixed(1)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">
              {arsenal.length} pitch type{arsenal.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* 2. Per-pitch breakdown */}
        <div className="flex-1 p-4 lg:p-5">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {sorted.map((p) => {
              const displayType = getStuffPlusDisplayPitchType(playerId, p.pitchType);
              return (
                <div
                  key={p.pitchType}
                  className="flex items-center gap-2"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: pitchColor(displayType) }}
                  />
                  <span className="text-sm text-zinc-300">{displayType}</span>
                  <span
                    className="rounded-md px-1.5 py-0.5 font-mono text-sm font-bold"
                    style={plusMetricBadgeStyle(p.meanStuffPlus)}
                  >
                    {p.meanStuffPlus.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Sessions + key metrics */}
        <div className="flex flex-col justify-center p-4 lg:min-w-[180px] lg:p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {sessionCount > 0 && (
              <div>
                {latestDateSlug ? (
                  <Link
                    href={`/trackman/session/${playerId}/${latestDateSlug}?from=player&slug=${playerId}`}
                    className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-smooth"
                  >
                    {sessionCount} session{sessionCount !== 1 ? "s" : ""}
                  </Link>
                ) : (
                  <span className="text-sm text-zinc-400">
                    {sessionCount} session{sessionCount !== 1 ? "s" : ""}
                  </span>
                )}
                {latestEntry && (
                  <span className="ml-1.5 text-[11px] text-zinc-500">
                    · Latest {formatDate(latestEntry.date)}
                  </span>
                )}
              </div>
            )}
            {(fbVelo != null || bbSpin != null) && (
              <div className="flex gap-4 text-[11px] text-zinc-500">
                {fbVelo != null && (
                  <span className="font-mono">
                    <span className="text-zinc-400">FB</span> {fbVelo.toFixed(1)} mph
                  </span>
                )}
                {bbSpin != null && (
                  <span className="font-mono">
                    <span className="text-zinc-400">BB spin</span> {Math.round(bbSpin)} rpm
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
