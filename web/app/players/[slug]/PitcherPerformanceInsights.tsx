"use client";

import type { CSSProperties } from "react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Filter,
  Grid3x3,
  RotateCcw,
  SlidersHorizontal,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  LeaderboardPanel,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";
import { comparePitchTypes } from "@/lib/pitchTypeOrder";
import { pitchDisplayName } from "@/lib/pitchNames";
import {
  DEFAULT_PITCHER_INSIGHT_FILTERS,
  IN_ZONE_CELL_IDS,
  filterPitcherInsightPitches,
  metricValueForAggregate,
  selectPitcherInsightPitches,
  selectionLabel,
  summarizePitcherInsightPitches,
  velocityBandLabel,
  zoneCellLabel,
  zoneColumnLabel,
  zoneRowLabel,
  type PitcherInsightMetricId,
  type PitcherInsightPitchRecord,
  type PitcherInsightSelection,
  type PitcherPerformanceInsightsData,
  type PitcherInsightsFilters,
  type PitcherInsightVelocityBandId,
} from "@/lib/charting/pitcherInsights";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatRate(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(3).replace(/^0(?=\.)/, "");
}

function formatPct(value: number | null, digits = 0): string {
  if (value === null) return "—";
  return `${value.toFixed(digits)}%`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMetric(metric: PitcherInsightMetricId, value: number | null): string {
  switch (metric) {
    case "baa":
    case "woba":
      return formatRate(value);
    case "pitchCount":
      return formatCount(value ?? 0);
    default:
      return formatPct(value, 0);
  }
}

function deltaText(
  metric: PitcherInsightMetricId,
  value: number | null,
  baseline: number | null
): string {
  if (value === null || baseline === null) return "—";
  const delta = value - baseline;
  const prefix = delta > 0 ? "+" : "";
  if (metric === "baa" || metric === "woba") {
    return `${prefix}${delta.toFixed(3).replace(/^0(?=\.)/, "")}`;
  }
  if (metric === "pitchCount") {
    return `${prefix}${Math.round(delta)}`;
  }
  return `${prefix}${delta.toFixed(1)} pts`;
}

function describeDateRange(pitches: PitcherInsightPitchRecord[]): string {
  if (pitches.length === 0) return "No charted dates";
  const dates = [...new Set(pitches.map((p) => p.gameDate).filter(Boolean))].sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return "No charted dates";
  if (first === last) return first;
  return `${first} to ${last}`;
}

function uniqueCount(values: string[]): number {
  return new Set(values).size;
}

function selectionMatches(
  current: PitcherInsightSelection,
  next: PitcherInsightSelection
): boolean {
  if (current.kind !== next.kind) return false;
  if (current.kind === "cell" && next.kind === "cell") return current.cell === next.cell;
  if (current.kind === "row" && next.kind === "row") return current.row === next.row;
  if (current.kind === "column" && next.kind === "column") return current.column === next.column;
  return true;
}

function toggleSelection(
  current: PitcherInsightSelection,
  next: PitcherInsightSelection
): PitcherInsightSelection {
  return selectionMatches(current, next) ? { kind: "all" } : next;
}

function metricHeatStyle({
  heat,
  selected,
  empty,
}: {
  heat: number;
  selected: boolean;
  empty: boolean;
}): CSSProperties {
  if (empty) {
    return {
      borderColor: selected ? "rgba(45, 212, 191, 0.36)" : "rgba(82, 82, 91, 0.24)",
      background: "linear-gradient(180deg, rgba(24,24,27,0.82), rgba(9,9,11,0.96))",
      boxShadow: selected
        ? "0 0 0 1px rgba(45,212,191,0.12), 0 0 30px rgba(45,212,191,0.12)"
        : "inset 0 1px 0 rgba(255,255,255,0.03)",
    };
  }

  const cool = 10 + heat * 18;
  const glow = 0.12 + heat * 0.2;
  const alpha = 0.16 + heat * 0.34;
  const borderAlpha = 0.18 + heat * 0.3;
  const accent = selected ? "20, 184, 166" : "34, 197, 94";

  return {
    borderColor: `rgba(${accent}, ${selected ? borderAlpha + 0.12 : borderAlpha})`,
    background: `linear-gradient(180deg, rgba(${accent}, ${alpha}) 0%, rgba(6, 10, 12, 0.96) 100%)`,
    boxShadow: selected
      ? `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 ${cool + 10}px rgba(${accent}, ${glow + 0.12})`
      : `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 ${cool}px rgba(${accent}, ${glow})`,
  };
}

function getMetricBounds(metricId: PitcherInsightMetricId): { min: number; max: number } | null {
  switch (metricId) {
    case "baa":
      return { min: 0.150, max: 0.350 };
    case "woba":
      return { min: 0.250, max: 0.450 };
    case "strikePct":
      return { min: 50, max: 72 };
    case "whiffPct":
      return { min: 10, max: 40 };
    case "chasePct":
      return { min: 15, max: 35 };
    case "kPct":
      return { min: 10, max: 35 };
    case "bbPct":
      return { min: 3, max: 18 };
    case "fpsPct":
      return { min: 50, max: 72 };
    default:
      return null;
  }
}

function FilterChip({
  active,
  onClick,
  children,
  disabled = false,
}: {
  active: boolean;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={joinClasses(
        "rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-smooth",
        active
          ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-100 shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
          : "border-zinc-800 bg-zinc-950/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100",
        disabled && "cursor-not-allowed opacity-50 hover:border-zinc-800 hover:text-zinc-400"
      )}
    >
      {children}
    </button>
  );
}

function DetailPanel({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Activity;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <LeaderboardPanel className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-zinc-200">
            <Icon className="h-4 w-4 text-emerald-300" />
            <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </LeaderboardPanel>
  );
}

function MiniStat({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "neutral" | "emerald" | "sky";
}) {
  const emphasis =
    tone === "emerald"
      ? "text-emerald-200"
      : tone === "sky"
        ? "text-sky-200"
        : "text-zinc-100";

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/65 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className={joinClasses("mt-2 text-xl font-black tracking-tight", emphasis)}>
        {value}
      </div>
      {note ? <div className="mt-1 text-[11px] text-zinc-500">{note}</div> : null}
    </div>
  );
}

function PitcherBreakdownRow({
  active,
  label,
  pitches,
  strikePct,
  whiffPct,
  kPct,
  baa,
  onClick,
  accent = "emerald",
}: {
  active: boolean;
  label: string;
  pitches: number;
  strikePct: number | null;
  whiffPct: number | null;
  kPct: number | null;
  baa: number | null;
  onClick: () => void;
  accent?: "emerald" | "sky";
}) {
  const accentClass =
    accent === "sky"
      ? "border-sky-400/25 bg-sky-500/10 text-sky-100"
      : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={joinClasses(
        "w-full rounded-[1.4rem] border px-4 py-3 text-left transition-smooth",
        active
          ? accentClass
          : "border-zinc-800 bg-zinc-950/70 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-900/80"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold">{label}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            {formatCount(pitches)} pitches
          </div>
        </div>
        <div className="grid min-w-[12rem] grid-cols-2 gap-x-4 gap-y-1 text-right text-[11px]">
          <span className="text-zinc-500">Strike%</span>
          <span>{formatPct(strikePct)}</span>
          <span className="text-zinc-500">Whiff%</span>
          <span>{formatPct(whiffPct)}</span>
          <span className="text-zinc-500">K%</span>
          <span>{formatPct(kPct)}</span>
          <span className="text-zinc-500">BAA</span>
          <span>{formatRate(baa)}</span>
        </div>
      </div>
    </button>
  );
}

export default function PitcherPerformanceInsights({
  data,
}: {
  data: PitcherPerformanceInsightsData;
}) {
  const [metric, setMetric] = useState<PitcherInsightMetricId>("strikePct");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selection, setSelection] = useState<PitcherInsightSelection>({ kind: "all" });
  const [filters, setFilters] = useState<PitcherInsightsFilters>(DEFAULT_PITCHER_INSIGHT_FILTERS);

  const availablePitchTypes = useMemo(
    () =>
      [...new Set(data.pitches.map((p) => p.pitchType))].sort((a, b) =>
        comparePitchTypes(a, b)
      ),
    [data.pitches]
  );

  const availableVelocityBands = useMemo(
    () =>
      (["lt80", "80_84", "85_89", "90_94", "95_plus", "untracked"] as PitcherInsightVelocityBandId[]).filter(
        (band) => data.pitches.some((p) => p.velocityBand === band)
      ),
    [data.pitches]
  );

  const filteredPitches = useMemo(
    () => filterPitcherInsightPitches(data.pitches, filters),
    [data.pitches, filters]
  );
  const selectedPitches = useMemo(
    () => selectPitcherInsightPitches(filteredPitches, selection),
    [filteredPitches, selection]
  );
  const filteredSummary = useMemo(
    () => summarizePitcherInsightPitches(filteredPitches),
    [filteredPitches]
  );
  const selectionSummary = useMemo(
    () => summarizePitcherInsightPitches(selectedPitches),
    [selectedPitches]
  );

  const metricMeta =
    data.metricOptions.find((o) => o.id === metric) ?? data.metricOptions[0]!;
  const selectionTitle = selectionLabel(selection);
  const filteredGameCount = useMemo(
    () => uniqueCount(filteredPitches.map((p) => p.gameId)),
    [filteredPitches]
  );

  const zoneCells = useMemo(() => {
    const cells = IN_ZONE_CELL_IDS.map((cellId) => {
      const pitches = filteredPitches.filter((p) => p.locationCell === cellId);
      const aggregate = summarizePitcherInsightPitches(pitches);
      return {
        id: cellId,
        label: zoneCellLabel(cellId),
        pitches,
        aggregate,
        metricValue: metricValueForAggregate(aggregate, metric),
      };
    });

    const values = cells
      .map((c) => c.metricValue)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const maxSample = Math.max(1, ...cells.map((c) => c.aggregate.pitches));
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 1;

    return cells.map((cell) => {
      let heat = 0;
      if (cell.metricValue !== null) {
        if (metric === "pitchCount") {
          const mMax = max > 0 ? max : 1;
          heat = Math.max(0.08, cell.metricValue / mMax);
        } else {
          const bounds = getMetricBounds(metric);
          if (bounds) {
            const clamped = Math.max(bounds.min, Math.min(bounds.max, cell.metricValue));
            const raw = (clamped - bounds.min) / (bounds.max - bounds.min);
            const normalized = metricMeta.lowerBetter ? 1 - raw : raw;
            const sampleWeight = 0.35 + 0.65 * (cell.aggregate.pitches / maxSample);
            heat = Math.max(0.08, normalized * sampleWeight);
          } else {
            const raw = max === min ? 0.58 : (cell.metricValue - min) / (max - min);
            const normalized = metricMeta.lowerBetter ? 1 - raw : raw;
            const sampleWeight = 0.35 + 0.65 * (cell.aggregate.pitches / maxSample);
            heat = Math.max(0.08, normalized * sampleWeight);
          }
        }
      }
      return { ...cell, heat };
    });
  }, [filteredPitches, metric, metricMeta.lowerBetter]);

  const pitchTypeBreakdown = useMemo(
    () =>
      availablePitchTypes
        .map((pitchType) => {
          const subset = selectedPitches.filter((p) => p.pitchType === pitchType);
          return { pitchType, aggregate: summarizePitcherInsightPitches(subset) };
        })
        .filter((row) => row.aggregate.pitches > 0),
    [availablePitchTypes, selectedPitches]
  );

  const velocityBreakdown = useMemo(
    () =>
      availableVelocityBands
        .map((band) => {
          const subset = selectedPitches.filter((p) => p.velocityBand === band);
          return { band, aggregate: summarizePitcherInsightPitches(subset) };
        })
        .filter((row) => row.aggregate.pitches > 0),
    [availableVelocityBands, selectedPitches]
  );

  const resultBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of selectedPitches) {
      counts.set(p.pitchResult, (counts.get(p.pitchResult) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count }));
  }, [selectedPitches]);

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (filters.dateFrom || filters.dateTo) {
      chips.push(`${filters.dateFrom ?? "Start"} → ${filters.dateTo ?? "Now"}`);
    }
    if (filters.pitchTypes.length > 0) {
      chips.push(`${filters.pitchTypes.length} pitch type${filters.pitchTypes.length === 1 ? "" : "s"}`);
    }
    if (filters.velocityBands.length > 0) {
      chips.push(filters.velocityBands.map((b) => velocityBandLabel(b)).join(", "));
    }
    if (filters.countCategory !== "all") {
      chips.push(
        filters.countCategory === "twoStrike"
          ? "2-strike counts"
          : filters.countCategory === "hitter"
            ? "Hitter counts"
            : filters.countCategory === "pitcher"
              ? "Pitcher counts"
              : "Full counts"
      );
    }
    if (filters.zoneScope !== "all") {
      chips.push(filters.zoneScope === "inZone" ? "In-zone only" : "Out-of-zone only");
    }
    if (filters.batterHand !== "all") {
      chips.push(`vs ${filters.batterHand}HH`);
    }
    return chips;
  }, [filters]);

  const summaryDeltas = [
    {
      label: "Strike% vs filter",
      value: deltaText("strikePct", selectionSummary.strikePct, filteredSummary.strikePct),
    },
    {
      label: "Whiff% vs filter",
      value: deltaText("whiffPct", selectionSummary.whiffPct, filteredSummary.whiffPct),
    },
    {
      label: "K% vs filter",
      value: deltaText("kPct", selectionSummary.kPct, filteredSummary.kPct),
    },
    {
      label: "BAA vs filter",
      value: deltaText("baa", selectionSummary.baa, filteredSummary.baa),
    },
  ];

  const setPitchTypeFilter = (pitchType: PitcherInsightPitchRecord["pitchType"]) => {
    setFilters((current) => ({
      ...current,
      pitchTypes: current.pitchTypes.includes(pitchType)
        ? current.pitchTypes.filter((t) => t !== pitchType)
        : [...current.pitchTypes, pitchType].sort(comparePitchTypes),
    }));
  };

  const setVelocityFilter = (band: PitcherInsightVelocityBandId) => {
    setFilters((current) => ({
      ...current,
      velocityBands: current.velocityBands.includes(band)
        ? current.velocityBands.filter((b) => b !== band)
        : [...current.velocityBands, band],
    }));
  };

  const noFilteredData = filteredPitches.length === 0;

  return (
    <section className="space-y-5">
      <LeaderboardPanel className="overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(45,212,191,0.14),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(34,197,94,0.1),transparent_24%),linear-gradient(180deg,rgba(12,18,17,0.72),rgba(9,9,11,0.94))]" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <LeaderboardPill tone="emerald">Pitcher Insights</LeaderboardPill>
            <LeaderboardPill tone="neutral">{data.pitcherName}</LeaderboardPill>
            <LeaderboardPill tone="neutral">{describeDateRange(filteredPitches)}</LeaderboardPill>
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-[1.65rem] font-black tracking-tight text-zinc-50 sm:text-[2rem]">
                Pitcher zone performance
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Charting pitch-by-pitch outcomes by zone, pitch type, and velocity band.
                Click a zone or shortcut to narrow the detail panels instantly.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-5">
              <MiniStat label="Strike%" value={formatPct(filteredSummary.strikePct)} tone="emerald" />
              <MiniStat label="K%" value={formatPct(filteredSummary.kPct)} tone="emerald" />
              <MiniStat label="BB%" value={formatPct(filteredSummary.bbPct)} />
              <MiniStat label="Whiff%" value={formatPct(filteredSummary.whiffPct)} tone="sky" />
              <MiniStat
                label="Pitches"
                value={formatCount(filteredSummary.pitches)}
                note={`${filteredGameCount} game${filteredGameCount === 1 ? "" : "s"}`}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            {activeFilterChips.length > 0 ? (
              activeFilterChips.map((chip) => (
                <span key={chip} className="rounded-full border border-zinc-800 bg-zinc-950/75 px-3 py-1">
                  {chip}
                </span>
              ))
            ) : (
              <span>All charted pitches are included.</span>
            )}
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              Active selection: {selectionTitle}
            </span>
          </div>
        </div>
      </LeaderboardPanel>

      <LeaderboardPanel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-zinc-200">
              <Filter className="h-4 w-4 text-emerald-300" />
              <h3 className="text-sm font-bold tracking-tight">Filters</h3>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-zinc-500">
              Date, pitch type, velocity, count, and zone-scope filters update the full module.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
              <SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />
              {filtersOpen ? "Hide filters" : "Show filters"}
            </FilterChip>
            <FilterChip active={false} onClick={() => setSelection({ kind: "all" })}>
              Clear zone selection
            </FilterChip>
            <FilterChip
              active={false}
              onClick={() => {
                setFilters(DEFAULT_PITCHER_INSIGHT_FILTERS);
                setSelection({ kind: "all" });
              }}
            >
              <RotateCcw className="mr-1 inline h-3.5 w-3.5" />
              Clear filters
            </FilterChip>
          </div>
        </div>

        {filtersOpen ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)]">
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  From
                  <input
                    type="date"
                    value={filters.dateFrom ?? ""}
                    onChange={(e) =>
                      setFilters((current) => ({ ...current, dateFrom: e.target.value || null }))
                    }
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition-smooth focus:border-emerald-500/35"
                  />
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  To
                  <input
                    type="date"
                    value={filters.dateTo ?? ""}
                    onChange={(e) =>
                      setFilters((current) => ({ ...current, dateTo: e.target.value || null }))
                    }
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition-smooth focus:border-emerald-500/35"
                  />
                </label>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Count category
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["all", "All counts"],
                      ["hitter", "Hitter counts"],
                      ["pitcher", "Pitcher counts"],
                      ["twoStrike", "2-strike"],
                      ["full", "3-2"],
                    ] as const
                  ).map(([id, label]) => (
                    <FilterChip
                      key={id}
                      active={filters.countCategory === id}
                      onClick={() =>
                        setFilters((current) => ({ ...current, countCategory: id }))
                      }
                    >
                      {label}
                    </FilterChip>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Zone scope
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["all", "All locations"],
                      ["inZone", "In-zone"],
                      ["outOfZone", "Out-of-zone"],
                    ] as const
                  ).map(([id, label]) => (
                    <FilterChip
                      key={id}
                      active={filters.zoneScope === id}
                      onClick={() =>
                        setFilters((current) => ({ ...current, zoneScope: id }))
                      }
                    >
                      {label}
                    </FilterChip>
                  ))}
                </div>
              </div>

              {data.capabilities.batterHand && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Batter hand
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        ["all", "All"],
                        ["R", "RHH"],
                        ["L", "LHH"],
                      ] as const
                    ).map(([id, label]) => (
                      <FilterChip
                        key={id}
                        active={filters.batterHand === id}
                        onClick={() =>
                          setFilters((current) => ({ ...current, batterHand: id }))
                        }
                      >
                        {label}
                      </FilterChip>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Pitch type
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {availablePitchTypes.map((pitchType) => (
                    <FilterChip
                      key={pitchType}
                      active={filters.pitchTypes.includes(pitchType)}
                      onClick={() => setPitchTypeFilter(pitchType)}
                    >
                      {pitchDisplayName(pitchType)}
                    </FilterChip>
                  ))}
                </div>
              </div>

              {availableVelocityBands.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Velocity band
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableVelocityBands.map((band) => (
                      <FilterChip
                        key={band}
                        active={filters.velocityBands.includes(band)}
                        onClick={() => setVelocityFilter(band)}
                      >
                        {velocityBandLabel(band)}
                      </FilterChip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </LeaderboardPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.16fr)_minmax(22rem,0.84fr)]">
        <LeaderboardPanel className="p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-zinc-200">
                  <Target className="h-4 w-4 text-emerald-300" />
                  <h3 className="text-sm font-bold tracking-tight">Strike zone view</h3>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                  Grid shows in-zone performance. Use shortcut selectors for rows, columns, or chase-space reads.
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {data.metricOptions.map((option) => (
                  <FilterChip
                    key={option.id}
                    active={metric === option.id}
                    onClick={option.available ? () => setMetric(option.id) : undefined}
                    disabled={!option.available}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[29rem] rounded-[2.2rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.08),_transparent_48%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="grid h-full grid-cols-3 grid-rows-3 gap-3">
                {zoneCells.map((cell) => {
                  const isSelected = selection.kind === "cell" && selection.cell === cell.id;
                  return (
                    <button
                      key={cell.id}
                      type="button"
                      onClick={() =>
                        setSelection((current) =>
                          toggleSelection(current, { kind: "cell", cell: cell.id })
                        )
                      }
                      className="relative overflow-hidden rounded-[1.4rem] border p-3 text-left transition-smooth"
                      style={metricHeatStyle({
                        heat: cell.heat,
                        selected: isSelected,
                        empty: cell.aggregate.pitches === 0,
                      })}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300/80">
                        {cell.label}
                      </div>
                      <div className="mt-5 text-[1.4rem] font-black tracking-tight text-white">
                        {formatMetric(metric, cell.metricValue)}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-300/75">
                        {formatCount(cell.aggregate.pitches)} pitches
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-4 rounded-[1.8rem] border border-white/5" />
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Row shortcuts
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[0, 1, 2].map((row) => (
                    <FilterChip
                      key={row}
                      active={selection.kind === "row" && selection.row === row}
                      onClick={() =>
                        setSelection((current) =>
                          toggleSelection(current, { kind: "row", row })
                        )
                      }
                    >
                      {zoneRowLabel(row)}
                    </FilterChip>
                  ))}
                  <FilterChip
                    active={selection.kind === "inZone"}
                    onClick={() =>
                      setSelection((current) => toggleSelection(current, { kind: "inZone" }))
                    }
                  >
                    Entire zone
                  </FilterChip>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Lane shortcuts
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[0, 1, 2].map((column) => (
                    <FilterChip
                      key={column}
                      active={selection.kind === "column" && selection.column === column}
                      onClick={() =>
                        setSelection((current) =>
                          toggleSelection(current, { kind: "column", column })
                        )
                      }
                    >
                      {zoneColumnLabel(column)}
                    </FilterChip>
                  ))}
                  <FilterChip
                    active={selection.kind === "outOfZone"}
                    onClick={() =>
                      setSelection((current) => toggleSelection(current, { kind: "outOfZone" }))
                    }
                  >
                    Chase
                  </FilterChip>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-zinc-800/80 bg-zinc-950/65 px-4 py-3 text-[11px] text-zinc-500">
              <span>{metricMeta.description}</span>
              <span>
                {filters.zoneScope === "outOfZone"
                  ? "Grid stays in-zone while the detail panels reflect chase-only filters."
                  : "Zone cells update from the current filter set."}
              </span>
            </div>
          </div>
        </LeaderboardPanel>

        <div className="grid gap-5">
          <DetailPanel
            icon={TrendingUp}
            title="Zone summary"
            subtitle="Coach-facing readout for the current selection."
          >
            {noFilteredData ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
                No pitches match the current filter set.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <MiniStat label="Pitches" value={formatCount(selectionSummary.pitches)} />
                  <MiniStat label="Strikes" value={formatCount(selectionSummary.strikes)} tone="emerald" />
                  <MiniStat label="Swings" value={formatCount(selectionSummary.swings)} />
                  <MiniStat label="Whiffs" value={formatCount(selectionSummary.whiffs)} tone="sky" />
                  <MiniStat label="Fouls" value={formatCount(selectionSummary.fouls)} />
                  <MiniStat label="Balls in play" value={formatCount(selectionSummary.ballsInPlay)} />
                  <MiniStat label="K" value={formatCount(selectionSummary.strikeouts)} tone="emerald" />
                  <MiniStat label="BB" value={formatCount(selectionSummary.walks)} />
                  <MiniStat label="Hits" value={formatCount(selectionSummary.hits)} />
                  <MiniStat label="Strike%" value={formatPct(selectionSummary.strikePct)} tone="emerald" />
                  <MiniStat label="Whiff%" value={formatPct(selectionSummary.whiffPct)} tone="sky" />
                  <MiniStat label="Chase%" value={formatPct(selectionSummary.chasePct)} />
                  <MiniStat label="K%" value={formatPct(selectionSummary.kPct)} tone="emerald" />
                  <MiniStat label="BB%" value={formatPct(selectionSummary.bbPct)} />
                  <MiniStat label="BAA" value={formatRate(selectionSummary.baa)} />
                </div>

                <div className="rounded-[1.4rem] border border-zinc-800/80 bg-zinc-950/70 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Selected area vs filtered baseline
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {summaryDeltas.map((delta) => (
                      <div
                        key={delta.label}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          {delta.label}
                        </div>
                        <div className="mt-2 text-lg font-black tracking-tight text-zinc-100">
                          {delta.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DetailPanel>

          <DetailPanel
            icon={Activity}
            title="Result mix"
            subtitle="Distribution of pitch results in the current selection."
          >
            {resultBreakdown.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
                No results in the current selection.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {resultBreakdown.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-[11px]"
                  >
                    <span className="font-semibold text-zinc-200">
                      {item.label.replace(/_/g, " ")}
                    </span>
                    <span className="ml-2 text-zinc-500">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </DetailPanel>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DetailPanel
          icon={Grid3x3}
          title="Pitch type breakdown"
          subtitle="Click a row to add or remove that pitch type from the active filter."
        >
          <div className="space-y-3">
            {pitchTypeBreakdown.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
                No pitch-type samples in the current selection.
              </div>
            ) : (
              pitchTypeBreakdown.map((row) => (
                <PitcherBreakdownRow
                  key={row.pitchType}
                  active={filters.pitchTypes.includes(row.pitchType)}
                  label={pitchDisplayName(row.pitchType)}
                  pitches={row.aggregate.pitches}
                  strikePct={row.aggregate.strikePct}
                  whiffPct={row.aggregate.whiffPct}
                  kPct={row.aggregate.kPct}
                  baa={row.aggregate.baa}
                  onClick={() => setPitchTypeFilter(row.pitchType)}
                />
              ))
            )}
          </div>
        </DetailPanel>

        <DetailPanel
          icon={Target}
          title="Velocity breakdown"
          subtitle="Click a bucket to add or remove it from the filter set."
        >
          <div className="space-y-3">
            {velocityBreakdown.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
                No velocity samples in the current selection.
              </div>
            ) : (
              velocityBreakdown.map((row) => (
                <PitcherBreakdownRow
                  key={row.band}
                  active={filters.velocityBands.includes(row.band)}
                  label={velocityBandLabel(row.band)}
                  pitches={row.aggregate.pitches}
                  strikePct={row.aggregate.strikePct}
                  whiffPct={row.aggregate.whiffPct}
                  kPct={row.aggregate.kPct}
                  baa={row.aggregate.baa}
                  onClick={() => setVelocityFilter(row.band)}
                  accent="sky"
                />
              ))
            )}
          </div>
        </DetailPanel>
      </div>

      <LeaderboardPanel className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500">
          <span>
            Zone, pitch type, velocity, and count insights are powered by live charting data.
          </span>
          <span>
            Batter hand and velocity will populate automatically once those fields are charted.
          </span>
        </div>
      </LeaderboardPanel>
    </section>
  );
}
