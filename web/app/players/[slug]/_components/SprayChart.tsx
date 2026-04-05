"use client";

/**
 * Interactive SVG spray chart in the 6-4-3 Charts fan layout.
 *
 * 5 directional zones (LF → RF) split by depth (Infield, Outfield) 
 * plus an HR arc overlay.
 * Clicking a segment selects it and surfaces per-segment stats in a detail panel.
 */

import { useState, useMemo } from "react";
import { SPRAY_ZONES, SPRAY_ZONE_LABELS, type SprayDepth, type SprayZone, type PlayerSprayProfile, type ZoneStats } from "@/lib/spraychart/types";
import { zonePctToHeatTier, type HeatTier } from "@/lib/spraychart/aggregate";
import {
  LeaderboardPanel,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";

// ── Geometry ──────────────────────────────────────────────────────────

const CX = 200;          // center x (home plate)
const CY = 240;          // center y (home plate)
const HOME_R = 15;       // where the infield dirt arc starts visually
const INFIELD_R = 90;    // outer radius for infield
const OUT_INNER_R = 95;  // inner radius for outfield grass
const OUTER_R = 180;     // outer radius (outfield)
const HR_INNER = 185;    // HR arc inner
const HR_OUTER = 200;    // HR arc outer

// 90-degree field layout matching a real baseball field
const FAN_START = -Math.PI * 0.75;  // fan start angle (left-field line)
const FAN_END = -Math.PI * 0.25;    // fan end angle (right-field line)
const FAN_SPAN = FAN_END - FAN_START;
const ZONE_COUNT = SPRAY_ZONES.length; // 5 zones
const ZONE_ANGLE = FAN_SPAN / ZONE_COUNT; 

const VISUAL_ZONES: SprayZone[] = [...SPRAY_ZONES];

const INFIELD_LABELS: Record<SprayZone, string> = {
  "lf": "THIRD",
  "lcf": "SHORT",
  "cf": "MIDDLE",
  "rcf": "SECOND",
  "rf": "FIRST",
};

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function wedgePath(zoneIndex: number, innerR: number, outerR: number): string {
  const startAngle = FAN_START + zoneIndex * ZONE_ANGLE;
  const endAngle = startAngle + ZONE_ANGLE;

  const innerStart = polarToCartesian(CX, CY, innerR, startAngle);
  const innerEnd = polarToCartesian(CX, CY, innerR, endAngle);
  const outerStart = polarToCartesian(CX, CY, outerR, startAngle);
  const outerEnd = polarToCartesian(CX, CY, outerR, endAngle);

  return [
    `M ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 0 1 ${innerEnd.x} ${innerEnd.y}`,
    `L ${outerEnd.x} ${outerEnd.y}`,
    `A ${outerR} ${outerR} 0 0 0 ${outerStart.x} ${outerStart.y}`,
    "Z",
  ].join(" ");
}

function zoneLabelPosition(zoneIndex: number, depth: SprayDepth): { x: number; y: number } {
  const midAngle = FAN_START + (zoneIndex + 0.5) * ZONE_ANGLE;
  // Push infield labels significantly further out into the wedge (75% to edge) so they have more horizontal width
  const labelR = depth === "infield" ? HOME_R + (INFIELD_R - HOME_R) * 0.75 : (OUT_INNER_R + OUTER_R) / 2;
  return polarToCartesian(CX, CY, labelR, midAngle);
}

// ── Color scales ──────────────────────────────────────────────────────

const HEAT_COLORS: Record<HeatTier, { fill: string; darkFill: string }> = {
  empty: { fill: "rgba(248, 250, 252, 0.4)", darkFill: "rgba(39, 39, 42, 0.4)" }, // Very subtle slate
  low: { fill: "rgb(191 219 254)", darkFill: "rgb(30 58 138)" }, // Blue-200 / Blue-900
  medium: { fill: "rgb(226 232 240)", darkFill: "rgb(82 82 91)" }, // Slate-200 / Zinc-600
  high: { fill: "rgb(252 165 165)", darkFill: "rgb(153 27 27)" }, // Red-300 / Red-800
  max: { fill: "rgb(239 68 68)", darkFill: "rgb(185 28 28)" }, // Red-500 / Red-700
};

const HEAT_SELECTED_STROKE: Record<HeatTier, string> = {
  empty: "rgb(148 163 184)",
  low: "rgb(59 130 246)",
  medium: "rgb(148 163 184)",
  high: "rgb(220 38 38)",
  max: "rgb(185 28 28)",
};

// ── Stat formatting helpers ───────────────────────────────────────────

function fmtRate(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(3).replace(/^0(?=\.)/, "");
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${Math.round(v)}%`;
}

// ── Component ─────────────────────────────────────────────────────────

interface SprayChartProps {
  profile: PlayerSprayProfile;
}

type SelectedElement = { zone: SprayZone; depth: SprayDepth } | "hr" | null;

export default function SprayChart({ profile }: SprayChartProps) {
  const [selectedSeg, setSelectedSeg] = useState<SelectedElement>(null);

  const segmentMap = useMemo(() => {
    const map = new Map<string, ZoneStats>();
    for (const s of profile.segments) {
      map.set(`${s.zone}-${s.depth}`, s);
    }
    return map;
  }, [profile.segments]);

  const maxPct = useMemo(() => {
    let max = 0;
    for (const stats of segmentMap.values()) {
      if (stats.zonePct > max) max = stats.zonePct;
    }
    return max || 1; // avoid div/0
  }, [segmentMap]);

  const getHeatTier = (pct: number): HeatTier => {
    if (pct === 0) return "empty";
    const ratio = pct / maxPct;
    if (ratio <= 0.25) return "low";
    if (ratio <= 0.6) return "medium";
    if (ratio <= 0.85) return "high";
    return "max";
  };

  const selectedZoneStats: ZoneStats | null = useMemo(() => {
    if (!selectedSeg || selectedSeg === "hr") return null;
    return segmentMap.get(`${selectedSeg.zone}-${selectedSeg.depth}`) ?? null;
  }, [selectedSeg, segmentMap]);

  const handleSegClick = (el: SelectedElement) => {
    setSelectedSeg((prev) => {
      if (prev === "hr" && el === "hr") return null;
      if (prev !== "hr" && el !== "hr" && prev?.zone === el?.zone && prev?.depth === el?.depth) return null;
      return el;
    });
  };

  const isSelected = (zone: SprayZone, depth: SprayDepth) => {
    if (!selectedSeg || selectedSeg === "hr") return false;
    return selectedSeg.zone === zone && selectedSeg.depth === depth;
  };

  const depths: SprayDepth[] = ["infield", "outfield"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <LeaderboardPanel className="overflow-hidden p-5 sm:p-6" variant="light">
        <div className="flex flex-wrap items-center gap-2">
          <LeaderboardPill tone="emerald" variant="light">Spray Chart</LeaderboardPill>
          <LeaderboardPill tone="neutral" variant="light">{profile.name}</LeaderboardPill>
          <LeaderboardPill tone="neutral" variant="light">{profile.gameCount} Game{profile.gameCount !== 1 ? "s" : ""}</LeaderboardPill>
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
          Click any zone (infield dirt or outfield grass) to see detailed batted ball breakdown and performance.
        </p>
      </LeaderboardPanel>

      {/* Main layout */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
        {/* SVG Fan */}
        <LeaderboardPanel className="p-4 sm:p-6" variant="light">
          <div className="mx-auto w-full">
            {/* The viewBox tightly bounds the 90 degree wedge and completely eliminates white space */}
            <svg viewBox="50 35 300 230" className="h-auto w-full" aria-label="Spray chart field diagram">
              <defs>
                <radialGradient id="fieldGrad" cx="50%" cy="95%" r="55%">
                  <stop offset="0%" className="[stop-color:rgb(241_245_249)] dark:[stop-color:rgb(24_24_27)]" />
                  <stop offset="100%" className="[stop-color:rgb(226_232_240)] dark:[stop-color:rgb(9_9_11)]" />
                </radialGradient>
              </defs>

              {/* Base field underlay */}
              <circle
                cx={CX}
                cy={CY}
                r={HOME_R}
                className="fill-slate-200/50 stroke-slate-300/60 dark:fill-zinc-800/50 dark:stroke-zinc-700/60"
                strokeWidth={0.5}
              />

              {/* Wedge Lines / FOUL LINES */}
              <path
                d={`M ${CX} ${CY} L ${polarToCartesian(CX, CY, OUTER_R, FAN_START).x} ${polarToCartesian(CX, CY, OUTER_R, FAN_START).y}`}
                className="stroke-slate-300/60 dark:stroke-zinc-600/60"
                strokeWidth={1}
              />
              <path
                d={`M ${CX} ${CY} L ${polarToCartesian(CX, CY, OUTER_R, FAN_END).x} ${polarToCartesian(CX, CY, OUTER_R, FAN_END).y}`}
                className="stroke-slate-300/60 dark:stroke-zinc-600/60"
                strokeWidth={1}
              />

              {/* Render Wedges */}
              {VISUAL_ZONES.map((zone, i) => {
                return (
                  <g key={zone}>
                    {depths.map((depth) => {
                      const stats = segmentMap.get(`${zone}-${depth}`);
                      const pct = stats?.zonePct ?? 0;
                      const tier = getHeatTier(pct);
                      const selected = isSelected(zone, depth);
                      const colors = HEAT_COLORS[tier];
                      
                      const inner = depth === "infield" ? HOME_R : OUT_INNER_R;
                      const outer = depth === "infield" ? INFIELD_R : OUTER_R;
                      const labelPos = zoneLabelPosition(i, depth);

                      return (
                        <g key={depth} className="cursor-pointer" onClick={() => handleSegClick({ zone, depth })}>
                          <title>
                            {depth === "infield" ? `${INFIELD_LABELS[zone]} Infield` : `${SPRAY_ZONE_LABELS[zone]} Outfield`}
                          </title>
                          <path
                            d={wedgePath(i, inner, outer)}
                            className="transition-all duration-200 hover:opacity-90"
                            style={{
                              fill: `var(--zone-fill-${zone}-${depth})`,
                              stroke: selected
                                ? HEAT_SELECTED_STROKE[tier]
                                : "rgba(148, 163, 184, 0.4)",
                              strokeWidth: selected ? 2.5 : 0.8,
                              filter: selected
                                ? "drop-shadow(0 0 8px rgba(34, 197, 94, 0.3))"
                                : "none",
                            }}
                          />
                          <text
                            x={labelPos.x}
                            y={labelPos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className={`pointer-events-none font-black ${depth === "infield" ? "text-[8.5px] fill-slate-700 dark:fill-zinc-300" : "text-[10px] fill-slate-800 dark:fill-zinc-100"}`}
                          >
                            {pct > 0 ? `${Math.round(pct)}%` : "—"}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* HR arc */}
              {profile.totalHr > 0 && (
                <g className="cursor-pointer" onClick={() => handleSegClick("hr")}>
                  <title>Home Runs</title>
                  <path
                    d={(() => {
                      const s = polarToCartesian(CX, CY, HR_INNER, FAN_START);
                      const e = polarToCartesian(CX, CY, HR_INNER, FAN_END);
                      const os = polarToCartesian(CX, CY, HR_OUTER, FAN_START);
                      const oe = polarToCartesian(CX, CY, HR_OUTER, FAN_END);
                      return [
                        `M ${s.x} ${s.y}`,
                        `A ${HR_INNER} ${HR_INNER} 0 0 1 ${e.x} ${e.y}`,
                        `L ${oe.x} ${oe.y}`,
                        `A ${HR_OUTER} ${HR_OUTER} 0 0 0 ${os.x} ${os.y}`,
                        "Z",
                      ].join(" ");
                    })()}
                    className="transition-all duration-200 hover:opacity-90"
                    style={{
                      fill: selectedSeg === "hr"
                        ? "rgba(239, 68, 68, 0.25)"
                        : "rgba(239, 68, 68, 0.12)",
                      stroke: selectedSeg === "hr"
                        ? "rgb(239, 68, 68)"
                        : "rgba(239, 68, 68, 0.4)",
                      strokeWidth: selectedSeg === "hr" ? 2 : 0.8,
                    }}
                  />
                  <text
                    x={CX}
                    y={CY - HR_INNER - 4}
                    textAnchor="middle"
                    className="pointer-events-none fill-red-600 text-[10px] font-black dark:fill-red-400"
                  >
                    {profile.totalHr} HR
                  </text>
                </g>
              )}

              {/* Home plate diamond */}
              <polygon
                points={`${CX},${CY - 5} ${CX + 5},${CY} ${CX},${CY + 5} ${CX - 5},${CY}`}
                className="fill-white stroke-slate-400 dark:fill-zinc-700 dark:stroke-zinc-500"
                strokeWidth={1}
              />
            </svg>
          </div>

          {/* Overall stats strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
            {[
              { label: "AVG", value: fmtRate(profile.overallAvg) },
              { label: "SLG", value: fmtRate(profile.overallSlg) },
              { label: "GB%", value: fmtPct(profile.overallGbPct) },
              { label: "LD%", value: fmtPct(profile.overallLdPct) },
              { label: "FB%", value: fmtPct(profile.overallFbPct) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-3.5 text-center dark:border-zinc-700 dark:bg-zinc-900/75"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  {stat.label}
                </div>
                <div className="mt-1 font-mono text-base font-black tabular-nums text-slate-900 dark:text-zinc-50">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* CSS custom properties for segment fills */}
          <style>{`
            ${VISUAL_ZONES.flatMap((zone) => 
              depths.map((depth) => {
                const stats = segmentMap.get(`${zone}-${depth}`);
                const pct = stats?.zonePct ?? 0;
                const tier = getHeatTier(pct);
                const colors = HEAT_COLORS[tier];
                return `
                  :root { --zone-fill-${zone}-${depth}: ${colors.fill}; }
                  html[data-site-appearance="dark"] { --zone-fill-${zone}-${depth}: ${colors.darkFill}; }
                `;
              })
            ).join("")}
          `}</style>
        </LeaderboardPanel>

        {/* Segment detail panel */}
        <div className="space-y-6">
          {selectedSeg === null ? (
            <LeaderboardPanel className="p-6 sm:p-8" variant="light">
              <div className="text-center text-sm text-slate-500 dark:text-zinc-400">
                <div className="mb-4 text-3xl">👆</div>
                <p className="text-base font-bold text-slate-700 dark:text-zinc-200">Select a zone</p>
                <p className="mt-2 text-sm leading-relaxed max-w-sm mx-auto">
                  Click any zone on the spray chart to see batted ball type breakdown,
                  batting average, and slugging for that area.
                </p>
              </div>
            </LeaderboardPanel>
          ) : selectedSeg === "hr" ? (
            <LeaderboardPanel className="p-6 sm:p-8" variant="light">
              <div className="flex items-center gap-2">
                <LeaderboardPill tone="orange" variant="light">Home Runs</LeaderboardPill>
              </div>
              <div className="mt-6 text-center pb-4">
                <div className="font-mono text-6xl font-black text-red-600 dark:text-red-400">
                  {profile.totalHr}
                </div>
                <div className="mt-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Total home runs
                </div>
              </div>
            </LeaderboardPanel>
          ) : selectedSeg && selectedZoneStats ? (
            <SprayChartZoneDetail 
              zone={selectedSeg.zone} 
              depth={selectedSeg.depth} 
              stats={selectedZoneStats} 
            />
          ) : null}

          {/* Legend */}
          <LeaderboardPanel className="p-5" variant="light">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Heat Scale — Relative Volume (Blue to Red)
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {(["empty", "low", "medium", "high", "max"] as HeatTier[]).map((tier) => (
                <div key={tier} className="flex items-center gap-2">
                  <div
                    className="h-4 w-6 rounded-sm border border-slate-200/80 dark:border-zinc-700"
                    style={{
                      background: `var(--legend-${tier}, ${HEAT_COLORS[tier].fill})`,
                    }}
                  />
                  <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                    {tier === "empty" ? "0%" : tier === "low" ? "Low" : tier === "medium" ? "Avg" : tier === "high" ? "High" : "Max"}
                  </span>
                </div>
              ))}
            </div>
            <style>{`
              ${(["empty", "low", "medium", "high", "max"] as HeatTier[]).map((tier) => `
                :root { --legend-${tier}: ${HEAT_COLORS[tier].fill}; }
                html[data-site-appearance="dark"] { --legend-${tier}: ${HEAT_COLORS[tier].darkFill}; }
              `).join("")}
            `}</style>
          </LeaderboardPanel>
        </div>
      </div>
    </div>
  );
}

// ── Segment detail subcomponent ──────────────────────────────────────────

function SprayChartZoneDetail({ zone, depth, stats }: { zone: SprayZone; depth: SprayDepth; stats: ZoneStats }) {
  const depthLabel = depth === "infield" ? "Infield" : "Outfield";
  const nameLabel = depth === "infield" 
    ? `${INFIELD_LABELS[zone]} INFIELD` 
    : `${SPRAY_ZONE_LABELS[zone]} OUTFIELD`;

  return (
    <LeaderboardPanel className="p-6 sm:p-8" variant="light">
      <div className="flex flex-wrap items-center gap-3">
        <LeaderboardPill tone="emerald" variant="light">{nameLabel}</LeaderboardPill>
        <LeaderboardPill tone="neutral" variant="light">{stats.bip} BALLS IN PLAY</LeaderboardPill>
      </div>

      {stats.bip === 0 ? (
        <p className="mt-6 text-base text-slate-500 dark:text-zinc-400">
          No balls in play to this zone.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Performance stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <ZoneDetailStat label="AVG" value={fmtRate(stats.avg)} tone="emerald" />
            <ZoneDetailStat label="SLG" value={fmtRate(stats.slg)} tone="emerald" />
            <ZoneDetailStat label="Hits" value={String(stats.hits)} />
            <ZoneDetailStat label="Outs" value={String(stats.outs)} />
            <ZoneDetailStat label="XBH" value={String(stats.xbh)} tone={stats.xbh > 0 ? "blue" : undefined} />
            <ZoneDetailStat label="Zone %" value={`${Math.round(stats.zonePct)}%`} />
          </div>

          {/* Expanded breakdowns grid */}
          <div className="grid gap-6">
            {/* Batted ball type breakdown */}
            <div className="rounded-2xl border border-slate-200/80 bg-white/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Batted Ball Type
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <BattedBallBar label="Ground Ball" value={stats.gbPct} color="amber" />
                <BattedBallBar label="Line Drive" value={stats.ldPct} color="emerald" />
                <BattedBallBar label="Fly Ball" value={stats.fbPct} color="sky" />
              </div>
            </div>

            {/* Hit type breakdown */}
            <div className="rounded-2xl border border-slate-200/80 bg-white/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Hit Results
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {stats.singles > 0 && (
                  <span className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {stats.singles} Single{stats.singles !== 1 && 's'}
                  </span>
                )}
                {stats.doubles > 0 && (
                  <span className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/30 dark:text-blue-300">
                    {stats.doubles} Double{stats.doubles !== 1 && 's'}
                  </span>
                )}
                {stats.triples > 0 && (
                  <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-300">
                    {stats.triples} Triple{stats.triples !== 1 && 's'}
                  </span>
                )}
                {stats.hits === 0 && (
                  <span className="text-sm font-medium text-slate-400 dark:text-zinc-500">
                    No hits to this zone.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </LeaderboardPanel>
  );
}

function ZoneDetailStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "blue";
}) {
  const valueClass = tone === "emerald"
    ? "text-emerald-700 dark:text-emerald-300"
    : tone === "blue"
      ? "text-blue-700 dark:text-blue-300"
      : "text-slate-900 dark:text-zinc-50";

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/75">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
        {label}
      </div>
      <div className={`mt-1 font-mono text-xl font-black tabular-nums leading-none ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function BattedBallBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: "amber" | "emerald" | "sky";
}) {
  const pct = value ?? 0;
  const barClass = color === "amber"
    ? "bg-amber-400 dark:bg-amber-500"
    : color === "emerald"
      ? "bg-emerald-400 dark:bg-emerald-500"
      : "bg-sky-400 dark:bg-sky-500";

  return (
    <div className="rounded-xl border border-slate-200/50 bg-white/30 px-3 py-2.5 dark:border-zinc-700/50 dark:bg-zinc-900/30">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          {label}
        </span>
        <span className="font-mono text-sm font-black tabular-nums text-slate-800 dark:text-zinc-100">
          {fmtPct(value)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barClass}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
