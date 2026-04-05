"use client";

import type { CSSProperties } from "react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Filter,
  Grid3x3,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
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
  DEFAULT_HITTER_INSIGHT_FILTERS,
  IN_ZONE_CELL_IDS,
  filterHitterInsightPitches,
  metricValueForAggregate,
  selectHitterInsightPitches,
  selectionLabel,
  summarizeHitterInsightPitches,
  velocityBandLabel,
  zoneCellLabel,
  zoneColumnLabel,
  zoneRowLabel,
  type HitterInsightMetricId,
  type HitterInsightPitchRecord,
  type HitterInsightSelection,
  type HitterPerformanceInsightsData,
  type HitterInsightsFilters,
  type HitterInsightVelocityBandId,
} from "@/lib/charting/hitterInsights";

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

function formatMetric(metric: HitterInsightMetricId, value: number | null): string {
  switch (metric) {
    case "avg":
    case "slg":
    case "woba":
    case "xwoba":
      return formatRate(value);
    case "pitchCount":
      return formatCount(value ?? 0);
    case "swingPct":
    case "whiffPct":
    case "contactPct":
    case "chasePct":
    case "hardHitPct":
      return formatPct(value, 0);
  }
}

function deltaText(metric: HitterInsightMetricId, value: number | null, baseline: number | null): string {
  if (value === null || baseline === null) return "—";
  const delta = value - baseline;
  const prefix = delta > 0 ? "+" : "";
  switch (metric) {
    case "avg":
    case "slg":
    case "woba":
    case "xwoba":
      return `${prefix}${delta.toFixed(3).replace(/^0(?=\.)/, "")}`;
    case "pitchCount":
      return `${prefix}${Math.round(delta)}`;
    default:
      return `${prefix}${delta.toFixed(1)} pts`;
  }
}

function describeDateRange(pitches: HitterInsightPitchRecord[]): string {
  if (pitches.length === 0) return "No charted dates";
  const dates = [...new Set(pitches.map((pitch) => pitch.gameDate).filter(Boolean))].sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return "No charted dates";
  if (first === last) return first;
  return `${first} to ${last}`;
}

function uniqueCount(values: string[]): number {
  return new Set(values).size;
}

function selectionMatches(current: HitterInsightSelection, next: HitterInsightSelection): boolean {
  if (current.kind !== next.kind) return false;
  if (current.kind === "cell" && next.kind === "cell") return current.cell === next.cell;
  if (current.kind === "row" && next.kind === "row") return current.row === next.row;
  if (current.kind === "column" && next.kind === "column") return current.column === next.column;
  return true;
}

function toggleSelection(current: HitterInsightSelection, next: HitterInsightSelection): HitterInsightSelection {
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
      background:
        "linear-gradient(180deg, rgba(24,24,27,0.82), rgba(9,9,11,0.96))",
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

function getMetricBounds(metricId: HitterInsightMetricId): { min: number; max: number } | null {
  switch (metricId) {
    case "avg":
      return { min: 0.150, max: 0.350 };
    case "slg":
      return { min: 0.250, max: 0.550 };
    case "woba":
    case "xwoba":
      return { min: 0.250, max: 0.450 };
    case "swingPct":
      return { min: 35, max: 60 };
    case "whiffPct":
      return { min: 10, max: 40 };
    case "contactPct":
      return { min: 60, max: 90 };
    case "chasePct":
      return { min: 15, max: 35 };
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
      <div className={joinClasses("mt-2 text-xl font-black tracking-tight", emphasis)}>{value}</div>
      {note ? <div className="mt-1 text-[11px] text-zinc-500">{note}</div> : null}
    </div>
  );
}

function BreakdownRow({
  active,
  label,
  pitches,
  swingPct,
  whiffPct,
  avg,
  slg,
  onClick,
  accent = "emerald",
}: {
  active: boolean;
  label: string;
  pitches: number;
  swingPct: number | null;
  whiffPct: number | null;
  avg: number | null;
  slg: number | null;
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
          <span className="text-zinc-500">Swing%</span>
          <span>{formatPct(swingPct)}</span>
          <span className="text-zinc-500">Whiff%</span>
          <span>{formatPct(whiffPct)}</span>
          <span className="text-zinc-500">AVG</span>
          <span>{formatRate(avg)}</span>
          <span className="text-zinc-500">SLG</span>
          <span>{formatRate(slg)}</span>
        </div>
      </div>
    </button>
  );
}

function OutcomePill({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-[11px]">
      <span className="font-semibold text-zinc-200">{label}</span>
      <span className="ml-2 text-zinc-500">{count}</span>
    </div>
  );
}

export default function HitterPerformanceInsights({
  data,
}: {
  data: HitterPerformanceInsightsData;
}) {
  const [metric, setMetric] = useState<HitterInsightMetricId>("woba");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selection, setSelection] = useState<HitterInsightSelection>({ kind: "all" });
  const [filters, setFilters] = useState<HitterInsightsFilters>(DEFAULT_HITTER_INSIGHT_FILTERS);

  const availablePitchTypes = useMemo(
    () =>
      [...new Set(data.pitches.map((pitch) => pitch.pitchType))].sort((left, right) =>
        comparePitchTypes(left, right)
      ),
    [data.pitches]
  );

  const availableVelocityBands = useMemo(
    () =>
      [
        "lt80",
        "80_84",
        "85_89",
        "90_94",
        "95_plus",
        "untracked",
      ].filter((band) =>
        data.pitches.some((pitch) => pitch.velocityBand === band)
      ) as HitterInsightVelocityBandId[],
    [data.pitches]
  );

  const filteredPitches = useMemo(
    () => filterHitterInsightPitches(data.pitches, filters),
    [data.pitches, filters]
  );
  const selectedPitches = useMemo(
    () => selectHitterInsightPitches(filteredPitches, selection),
    [filteredPitches, selection]
  );
  const filteredSummary = useMemo(
    () => summarizeHitterInsightPitches(filteredPitches),
    [filteredPitches]
  );
  const selectionSummary = useMemo(
    () => summarizeHitterInsightPitches(selectedPitches),
    [selectedPitches]
  );

  const metricMeta = data.metricOptions.find((option) => option.id === metric) ?? data.metricOptions[0]!;
  const selectionTitle = selectionLabel(selection, data.batterHand);
  const filteredGameCount = useMemo(
    () => uniqueCount(filteredPitches.map((pitch) => pitch.gameId)),
    [filteredPitches]
  );

  const zoneCells = useMemo(() => {
    const cells = IN_ZONE_CELL_IDS.map((cellId) => {
      const pitches = filteredPitches.filter((pitch) => pitch.locationCell === cellId);
      const aggregate = summarizeHitterInsightPitches(pitches);
      return {
        id: cellId,
        label: zoneCellLabel(cellId, data.batterHand),
        pitches,
        aggregate,
        metricValue: metricValueForAggregate(aggregate, metric),
      };
    });

    const values = cells
      .map((cell) => cell.metricValue)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const maxSample = Math.max(1, ...cells.map((cell) => cell.aggregate.pitches));
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

      return {
        ...cell,
        heat,
      };
    });
  }, [data.batterHand, filteredPitches, metric, metricMeta.lowerBetter]);

  const pitchTypeBreakdown = useMemo(
    () =>
      availablePitchTypes.map((pitchType) => {
        const subset = selectedPitches.filter((pitch) => pitch.pitchType === pitchType);
        return {
          pitchType,
          aggregate: summarizeHitterInsightPitches(subset),
        };
      }).filter((row) => row.aggregate.pitches > 0),
    [availablePitchTypes, selectedPitches]
  );

  const velocityBreakdown = useMemo(
    () =>
      availableVelocityBands.map((band) => {
        const subset = selectedPitches.filter((pitch) => pitch.velocityBand === band);
        return {
          band,
          aggregate: summarizeHitterInsightPitches(subset),
        };
      }).filter((row) => row.aggregate.pitches > 0),
    [availableVelocityBands, selectedPitches]
  );

  const outcomeBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pitch of selectedPitches) {
      counts.set(pitch.outcomeLabel, (counts.get(pitch.outcomeLabel) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
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
      chips.push(filters.velocityBands.map((band) => velocityBandLabel(band)).join(", "));
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
    return chips;
  }, [filters]);

  const summaryDeltas = [
    {
      label: "AVG vs filter",
      value: deltaText("avg", selectionSummary.avg, filteredSummary.avg),
    },
    {
      label: "SLG vs filter",
      value: deltaText("slg", selectionSummary.slg, filteredSummary.slg),
    },
    {
      label: "Contact vs filter",
      value: deltaText("contactPct", selectionSummary.contactPct, filteredSummary.contactPct),
    },
    {
      label: "Whiff vs filter",
      value: deltaText("whiffPct", selectionSummary.whiffPct, filteredSummary.whiffPct),
    },
  ];

  const setPitchTypeFilter = (pitchType: HitterInsightPitchRecord["pitchType"]) => {
    setFilters((current) => ({
      ...current,
      pitchTypes: current.pitchTypes.includes(pitchType)
        ? current.pitchTypes.filter((item) => item !== pitchType)
        : [...current.pitchTypes, pitchType].sort(comparePitchTypes),
    }));
  };

  const setVelocityFilter = (band: HitterInsightVelocityBandId) => {
    setFilters((current) => ({
      ...current,
      velocityBands: current.velocityBands.includes(band)
        ? current.velocityBands.filter((item) => item !== band)
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
            <LeaderboardPill tone="emerald">Performance Insights</LeaderboardPill>
            <LeaderboardPill tone="neutral">{data.hitterName}</LeaderboardPill>
            {data.batterHand ? <LeaderboardPill tone="neutral">{data.batterHand}HH</LeaderboardPill> : null}
            <LeaderboardPill tone="neutral">{describeDateRange(filteredPitches)}</LeaderboardPill>
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-[1.65rem] font-black tracking-tight text-zinc-50 sm:text-[2rem]">
                Hitter zone performance
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Charting pitch-by-pitch performance by zone, pitch type, and velocity band.
                Click a zone or shortcut to narrow the detail panels instantly.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-5">
              <MiniStat label="AVG" value={formatRate(filteredSummary.avg)} tone="emerald" />
              <MiniStat label="OBP" value={formatRate(filteredSummary.obp)} />
              <MiniStat label="SLG" value={formatRate(filteredSummary.slg)} tone="sky" />
              <MiniStat label="OPS" value={formatRate(filteredSummary.ops)} />
              <MiniStat label="Pitches" value={formatCount(filteredSummary.pitches)} note={`${filteredGameCount} games`} />
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
            <FilterChip active={filtersOpen} onClick={() => setFiltersOpen((current) => !current)}>
              <SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />
              {filtersOpen ? "Hide filters" : "Show filters"}
            </FilterChip>
            <FilterChip
              active={false}
              onClick={() => setSelection({ kind: "all" })}
            >
              Clear zone selection
            </FilterChip>
            <FilterChip
              active={false}
              onClick={() => {
                setFilters(DEFAULT_HITTER_INSIGHT_FILTERS);
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
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        dateFrom: event.target.value || null,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition-smooth focus:border-emerald-500/35"
                  />
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  To
                  <input
                    type="date"
                    value={filters.dateTo ?? ""}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        dateTo: event.target.value || null,
                      }))
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
                  {[
                    ["all", "All counts"],
                    ["hitter", "Hitter counts"],
                    ["pitcher", "Pitcher counts"],
                    ["twoStrike", "2-strike"],
                    ["full", "3-2"],
                  ].map(([id, label]) => (
                    <FilterChip
                      key={id}
                      active={filters.countCategory === id}
                      onClick={() =>
                        setFilters((current) => ({
                          ...current,
                          countCategory: id as HitterInsightsFilters["countCategory"],
                        }))
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
                  {[
                    ["all", "All locations"],
                    ["inZone", "In-zone"],
                    ["outOfZone", "Out-of-zone"],
                  ].map(([id, label]) => (
                    <FilterChip
                      key={id}
                      active={filters.zoneScope === id}
                      onClick={() =>
                        setFilters((current) => ({
                          ...current,
                          zoneScope: id as HitterInsightsFilters["zoneScope"],
                        }))
                      }
                    >
                      {label}
                    </FilterChip>
                  ))}
                </div>
              </div>
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
                      onClick={() => setSelection((current) => toggleSelection(current, { kind: "cell", cell: cell.id }))}
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
                        setSelection((current) => toggleSelection(current, { kind: "row", row }))
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
                      {zoneColumnLabel(column, data.batterHand)}
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
                  <MiniStat label="Swings" value={formatCount(selectionSummary.swings)} />
                  <MiniStat label="Takes" value={formatCount(selectionSummary.takes)} />
                  <MiniStat label="Whiffs" value={formatCount(selectionSummary.whiffs)} />
                  <MiniStat label="Fouls" value={formatCount(selectionSummary.fouls)} />
                  <MiniStat label="Balls in play" value={formatCount(selectionSummary.ballsInPlay)} />
                  <MiniStat label="Hits" value={formatCount(selectionSummary.hits)} tone="emerald" />
                  <MiniStat label="XBH" value={formatCount(selectionSummary.extraBaseHits)} tone="sky" />
                  <MiniStat label="K / BB" value={`${formatCount(selectionSummary.strikeouts)} / ${formatCount(selectionSummary.walks)}`} />
                  <MiniStat label="AVG" value={formatRate(selectionSummary.avg)} tone="emerald" />
                  <MiniStat label="SLG" value={formatRate(selectionSummary.slg)} tone="sky" />
                  <MiniStat label="wOBA" value={formatRate(selectionSummary.woba)} />
                  <MiniStat label="Chase%" value={formatPct(selectionSummary.chasePct)} />
                  <MiniStat label="Z-Swing%" value={formatPct(selectionSummary.zoneSwingPct)} />
                  <MiniStat label="Contact%" value={formatPct(selectionSummary.contactPct)} />
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
            icon={Sparkles}
            title="Outcome mix"
            subtitle="Distribution of charted pitch outcomes inside the current selection."
          >
            {outcomeBreakdown.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
                No outcomes in the current selection.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {outcomeBreakdown.map((item) => (
                  <OutcomePill key={item.label} label={item.label} count={item.count} />
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
                <BreakdownRow
                  key={row.pitchType}
                  active={filters.pitchTypes.includes(row.pitchType)}
                  label={pitchDisplayName(row.pitchType)}
                  pitches={row.aggregate.pitches}
                  swingPct={row.aggregate.swingPct}
                  whiffPct={row.aggregate.whiffPct}
                  avg={row.aggregate.avg}
                  slg={row.aggregate.slg}
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
                <BreakdownRow
                  key={row.band}
                  active={filters.velocityBands.includes(row.band)}
                  label={velocityBandLabel(row.band)}
                  pitches={row.aggregate.pitches}
                  swingPct={row.aggregate.swingPct}
                  whiffPct={row.aggregate.whiffPct}
                  avg={row.aggregate.avg}
                  slg={row.aggregate.slg}
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
            Current charting feed powers zone, pitch type, velocity, and count insights across player pages.
          </span>
          <span>
            Pitcher hand, exact `plate_x`/`plate_z`, hard-hit, and xwOBA will light up automatically once those fields are charted.
          </span>
        </div>
      </LeaderboardPanel>
    </section>
  );
}
