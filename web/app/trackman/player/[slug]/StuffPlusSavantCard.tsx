"use client";

import { useState, useEffect, useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import {
  computeTotalStuffPlus,
  stuffPlusAccentClass,
  plusMetricBadgeStyle,
} from "@/lib/stuffPlusUtils";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";
import { savantColorAt } from "@/lib/savantColors";

interface StuffPlusPitch {
  pitchType: string;
  meanStuffPlus: number;
}

interface TeamPercentile {
  pitchType: string;
  meanStuffPlus: number;
  percentile: number | null;
}

interface TeamPercentilesResponse {
  team: string | null;
  teammateCount?: number;
  totalPercentile: number | null;
  pitches: TeamPercentile[];
}

interface Props {
  arsenal: StuffPlusPitch[];
  playerId: string;
}

const TRACK =
  "linear-gradient(to right, #1e40af 0%, #3b82f6 18%, #94a3b8 50%, #f87171 82%, #dc2626 100%)";

function StuffPlusSavantRow({
  label,
  value,
  percentile,
  color,
  index,
}: {
  label: string;
  value: string;
  percentile: number | null;
  color: string;
  index: number;
}) {
  const p =
    percentile != null && Number.isFinite(percentile)
      ? Math.min(100, Math.max(0, percentile))
      : null;
  const style = p != null ? savantColorAt(p) : null;
  const n = p != null ? Math.round(p) : null;
  const delay = index * 50;

  return (
    <div
      className="flex items-center gap-3 py-3 opacity-0"
      style={{ animation: `savantFadeIn 0.5s ease-out ${delay}ms forwards` }}
    >
      <div className="flex items-center gap-2 min-w-[72px] shrink-0">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500 truncate">
          {label}
        </span>
      </div>
      <div className="relative flex-1" style={{ height: 10 }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: TRACK, opacity: 0.2 }}
        />
        {n != null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${p}%`,
              background: TRACK,
              opacity: 0.5,
              animation: `savantGrow 0.6s ease-out ${delay}ms both`,
              transformOrigin: "left",
            }}
          />
        )}
        {n != null && style ? (
          <div
            className="absolute top-1/2 z-10 flex items-center justify-center rounded-full ring-2 ring-black/40"
            style={{
              left: `${p}%`,
              transform: "translate(-50%, -50%)",
              width: 28,
              height: 28,
              backgroundColor: style.bg,
              boxShadow: `0 0 8px ${style.bg}90, 0 0 0 2px #09090b`,
            }}
          >
            <span
              className="text-[11px] font-black leading-none"
              style={{ color: style.text }}
            >
              {n}
            </span>
          </div>
        ) : (
          <div
            className="absolute right-0 top-1/2 z-10 flex items-center justify-center rounded-full bg-zinc-800"
            style={{
              transform: "translateY(-50%)",
              width: 28,
              height: 28,
              boxShadow: "0 0 0 2px #09090b",
            }}
          >
            <span className="text-[10px] font-bold text-zinc-600">--</span>
          </div>
        )}
      </div>
      <div className="w-12 shrink-0 text-right font-mono text-[12px] font-bold tabular-nums text-zinc-200">
        {value}
      </div>
    </div>
  );
}

/**
 * Savant-style Stuff+ card with team percentiles.
 * - Left: Total Stuff+ hero with optional team percentile
 * - Right: Per-pitch Savant bars (percentile vs team) + raw value
 */
export default function StuffPlusSavantCard({ arsenal, playerId }: Props) {
  const [teamData, setTeamData] = useState<TeamPercentilesResponse | null>(null);

  useEffect(() => {
    fetch(`/api/stuff-plus/team-percentiles?playerId=${encodeURIComponent(playerId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.pitches) setTeamData(res);
      });
  }, [playerId]);

  const merged = useMemo(() => {
    const percentiles = new Map<TeamPercentile["pitchType"], number | null>();
    for (const p of teamData?.pitches ?? []) {
      percentiles.set(p.pitchType, p.percentile);
    }
    return arsenal.map((p) => ({
      ...p,
      percentile: percentiles.get(p.pitchType) ?? null,
    }));
  }, [arsenal, teamData]);

  const sorted = useMemo(
    () => [...merged].sort((a, b) => b.meanStuffPlus - a.meanStuffPlus),
    [merged]
  );

  const total = computeTotalStuffPlus(arsenal);
  const totalPercentile = teamData?.totalPercentile ?? null;
  const accentBorder =
    total != null ? `border-l-4 ${stuffPlusAccentClass(total)}` : "";

  if (arsenal.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-lg shadow-black/20 transition-smooth ${accentBorder}`}
    >
      <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/80">
        {/* Left: Total Stuff+ hero */}
        {total != null && (
          <div className="flex flex-col items-center justify-center p-6 sm:min-w-[200px] sm:py-8">
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
              {totalPercentile != null && (
                <>
                  {" · "}
                  <span
                    className="font-semibold"
                    style={{ color: savantColorAt(totalPercentile).bg }}
                  >
                    {Math.round(totalPercentile)}
                    <span className="text-zinc-500 font-normal">th</span>
                  </span>{" "}
                  vs team
                </>
              )}
            </p>
            {teamData?.team && (
              <p className="text-[9px] text-zinc-600 mt-0.5">{teamData.team}</p>
            )}
          </div>
        )}
        {/* Right: Savant-style per-pitch bars */}
        <div className="flex-1 p-4 sm:p-5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">
            {teamData?.team
              ? `vs team (${teamData.teammateCount ?? "—"} pitchers)`
              : "Stuff+ by pitch"}
          </p>
          <div className="flex flex-col gap-0">
            {sorted.map((p, i) => {
              const displayType = getStuffPlusDisplayPitchType(playerId, p.pitchType);
              return (
                <StuffPlusSavantRow
                  key={p.pitchType}
                  label={displayType}
                  value={p.meanStuffPlus.toFixed(1)}
                  percentile={p.percentile}
                  color={pitchColor(displayType)}
                  index={i}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
