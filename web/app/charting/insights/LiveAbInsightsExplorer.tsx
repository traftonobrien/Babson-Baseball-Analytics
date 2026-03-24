"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import {
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";
import { HubActionCard, HubStatCard } from "@/app/components/hub/HubHeader";
import {
  CHARTING_PLAYER_COMPARISON_PITCHER_HAND_OPTIONS,
  type ChartingPlayerComparisonPitcherHandFilter,
  type ChartingPlayerComparisonSummary,
} from "@/lib/charting/playerComparison";
import type { ComparisonZoneBucketId } from "@/lib/charting/comparisonZones";
import type { PitcherComparisonSummary } from "@/lib/charting/pitcherComparison";
import { useSelectedPlayer } from "@/lib/selectedPlayer";

import {
  ComparisonViewToggle,
  FilterSelect,
  MetricToggle,
  MiniStat,
  PitchMixPanel,
  SearchResultCard,
  VelocityRangeControl,
  ZoneDisplayModeToggle,
} from "./_components/controls";
import { EmptyState } from "./_components/empty-state";
import { SummaryTable } from "./_components/summary-table";
import { ZoneCanvas } from "./_components/zone-canvas";
import {
  buildCatalog,
  buildExplorerHref,
  buildExplorerPitchMix,
  buildExplorerZoneBuckets,
  countNounForView,
  defaultMetricForView,
  eventLabelForView,
  eventOptionsForView,
  filterExplorerPitches,
  formatCount,
  formatPct,
  formatRate,
  heroDescriptionForView,
  isPitcherView,
  metricOptionsForView,
  searchPlaceholderForView,
  summarizeExplorerPitches,
  hiddenExplorerZonePitchCount,
} from "./_lib/helpers";
import type {
  ComparisonEventId,
  ComparisonMetricId,
  ExplorerEntry,
  ExplorerSummary,
  ZoneDisplayMode,
} from "./_lib/types";
import { ZONE_COL_LABELS, ZONE_ROW_LABELS, cellCol, cellRow } from "./_lib/zone-display";
import {
  normalizeHitterEvent,
  normalizePitcherEvent,
  normalizePitcherHandFilter,
  readHitterExplorerQuery,
  readPitcherExplorerQuery,
  type ComparisonView,
} from "./explorerState";
import { TEAM_NAME } from "@/lib/teamConfig";

const SEARCH_RESULT_LIMIT = 8;

export default function LiveAbInsightsExplorer({
  entries,
  view,
}: {
  entries: ExplorerEntry[];
  view: ComparisonView;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { slug: pinnedSlug, setSelectedPlayer } = useSelectedPlayer();
  const hitterQuery = useMemo(() => readHitterExplorerQuery(searchParams), [searchParams]);
  const pitcherQuery = useMemo(() => readPitcherExplorerQuery(searchParams), [searchParams]);
  const isPitcher = isPitcherView(view);
  const initialQuery = isPitcher ? pitcherQuery : hitterQuery;
  const [searchInput, setSearchInput] = useState("");
  const [selectedMetric, setSelectedMetric] =
    useState<ComparisonMetricId>(defaultMetricForView(view));
  const [zoneDisplayMode, setZoneDisplayMode] = useState<ZoneDisplayMode>("heatmap");
  const [selectedBucketId, setSelectedBucketId] = useState<ComparisonZoneBucketId | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<number | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [selectedColId, setSelectedColId] = useState<number | null>(null);
  const [selectedPlayerSlug, setSelectedPlayerSlug] = useState<string | null>(
    initialQuery.playerSlug,
  );
  const [pitcherHandParam, setPitcherHandParam] =
    useState<ChartingPlayerComparisonPitcherHandFilter>(
      isPitcher ? "all" : hitterQuery.pitcherHand,
    );
  const [seasonParam, setSeasonParam] = useState<string | null>(initialQuery.season);
  const [pitchTypeParam, setPitchTypeParam] = useState<string | null>(initialQuery.pitchType);
  const [countParam, setCountParam] = useState<string | null>(initialQuery.count);
  const [eventParam, setEventParam] = useState<ComparisonEventId>(initialQuery.event);
  const [veloMinParam, setVeloMinParam] = useState<number | null>(initialQuery.veloMin);
  const [veloMaxParam, setVeloMaxParam] = useState<number | null>(initialQuery.veloMax);
  const deferredSearch = useDeferredValue(searchInput);
  const metricOptions = useMemo(() => metricOptionsForView(view), [view]);

  const entryBySlug = useMemo(
    () => new Map(entries.map((entry) => [entry.playerSlug, entry])),
    [entries],
  );
  const globalCatalog = useMemo(() => buildCatalog(entries), [entries]);
  const totalPitches = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.totalPitches, 0),
    [entries],
  );
  const totalSeasons = globalCatalog.seasons.length;

  const resolvedPlayerSlug =
    selectedPlayerSlug && entryBySlug.has(selectedPlayerSlug) ? selectedPlayerSlug : null;
  const selectedEntry = resolvedPlayerSlug ? entryBySlug.get(resolvedPlayerSlug) ?? null : null;

  const catalog = selectedEntry
    ? {
        seasons: selectedEntry.seasons,
        pitchTypes: selectedEntry.pitchTypes,
        counts: selectedEntry.counts,
        velocityRange: selectedEntry.velocityRange,
      }
    : globalCatalog;

  const latestSeason = catalog.seasons[0] ?? null;
  const resolvedSeasonUi =
    seasonParam === "all"
      ? "all"
      : seasonParam && catalog.seasons.includes(seasonParam)
        ? seasonParam
        : latestSeason ?? "all";
  const resolvedPitchType =
    pitchTypeParam && catalog.pitchTypes.includes(pitchTypeParam) ? pitchTypeParam : null;
  const resolvedCount = countParam && catalog.counts.includes(countParam) ? countParam : null;
  const resolvedEvent = isPitcher
    ? normalizePitcherEvent(eventParam)
    : normalizeHitterEvent(eventParam);

  const resolvedVeloMin =
    catalog.velocityRange && veloMinParam !== null
      ? Math.max(catalog.velocityRange.min, Math.min(veloMinParam, catalog.velocityRange.max))
      : null;
  const resolvedVeloMax =
    catalog.velocityRange && veloMaxParam !== null
      ? Math.max(catalog.velocityRange.min, Math.min(veloMaxParam, catalog.velocityRange.max))
      : null;
  const constrainedVeloMin =
    resolvedVeloMin !== null &&
    resolvedVeloMax !== null &&
    resolvedVeloMin > resolvedVeloMax
      ? resolvedVeloMax
      : resolvedVeloMin;
  const constrainedVeloMax =
    resolvedVeloMin !== null &&
    resolvedVeloMax !== null &&
    resolvedVeloMax < resolvedVeloMin
      ? resolvedVeloMin
      : resolvedVeloMax;

  useEffect(() => {
    if (resolvedPlayerSlug) {
      setSelectedPlayer(resolvedPlayerSlug);
    }
  }, [resolvedPlayerSlug, setSelectedPlayer]);

  useEffect(() => {
    const nextHref = buildExplorerHref({
      view,
      pathname,
      playerSlug: resolvedPlayerSlug,
      pitcherHand: isPitcher ? "all" : pitcherHandParam,
      season: resolvedSeasonUi,
      latestSeason,
      pitchType: resolvedPitchType,
      count: resolvedCount,
      event: resolvedEvent,
      veloMin: constrainedVeloMin,
      veloMax: constrainedVeloMax,
    });
    const currentHref = `${pathname}${window.location.search}`;
    if (currentHref !== nextHref) {
      window.history.replaceState(window.history.state, "", nextHref);
    }
  }, [
    constrainedVeloMax,
    constrainedVeloMin,
    isPitcher,
    latestSeason,
    pathname,
    pitcherHandParam,
    resolvedCount,
    resolvedEvent,
    resolvedPitchType,
    resolvedPlayerSlug,
    resolvedSeasonUi,
    view,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      const nextQuery = isPitcher
        ? readPitcherExplorerQuery(new URLSearchParams(window.location.search))
        : readHitterExplorerQuery(new URLSearchParams(window.location.search));
      setSelectedPlayerSlug(nextQuery.playerSlug);
      setPitcherHandParam(
        isPitcher ? "all" : (nextQuery as typeof hitterQuery).pitcherHand,
      );
      setSeasonParam(nextQuery.season);
      setPitchTypeParam(nextQuery.pitchType);
      setCountParam(nextQuery.count);
      setEventParam(nextQuery.event);
      setVeloMinParam(nextQuery.veloMin);
      setVeloMaxParam(nextQuery.veloMax);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hitterQuery.pitcherHand, isPitcher]);

  const filteredEntries = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return entries;
    }

    return entries.filter((entry) => {
      const aliases = "matchedHitterNames" in entry ? entry.matchedHitterNames : [];
      const haystack = [entry.displayName, entry.playerSlug, ...aliases]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredSearch, entries]);

  const filteredPitches = useMemo(() => {
    if (!selectedEntry) {
      return [];
    }

    return filterExplorerPitches({
      view,
      pitches: selectedEntry.pitches,
      season: resolvedSeasonUi === "all" ? null : resolvedSeasonUi,
      pitcherHand: isPitcher ? "all" : pitcherHandParam,
      pitchType: resolvedPitchType,
      count: resolvedCount,
      event: resolvedEvent,
      veloMin: constrainedVeloMin,
      veloMax: constrainedVeloMax,
    });
  }, [
    constrainedVeloMax,
    constrainedVeloMin,
    isPitcher,
    pitcherHandParam,
    resolvedCount,
    resolvedEvent,
    resolvedPitchType,
    resolvedSeasonUi,
    selectedEntry,
    view,
  ]);

  const filteredSummary = useMemo(
    () => summarizeExplorerPitches(view, filteredPitches),
    [filteredPitches, view],
  );
  const zoneBuckets = useMemo(
    () => buildExplorerZoneBuckets(view, filteredPitches),
    [filteredPitches, view],
  );
  const selectedBucket =
    selectedBucketId !== null
      ? zoneBuckets.find((bucket) => bucket.id === selectedBucketId) ?? null
      : null;
  const cellSummaries = useMemo(() => {
    const map = new Map<number, ExplorerSummary>();
    for (const cellId of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const cellPitches = filteredPitches.filter((pitch) => pitch.locationCell === cellId);
      map.set(cellId, summarizeExplorerPitches(view, cellPitches));
    }
    return map;
  }, [filteredPitches, view]);
  const rowSummaries = useMemo(() => {
    const map = new Map<number, ExplorerSummary>();
    for (const row of [0, 1, 2]) {
      const rowPitches = filteredPitches.filter(
        (pitch) =>
          pitch.locationCell !== undefined &&
          pitch.locationCell !== null &&
          cellRow(pitch.locationCell) === row,
      );
      map.set(row, summarizeExplorerPitches(view, rowPitches));
    }
    return map;
  }, [filteredPitches, view]);
  const colSummaries = useMemo(() => {
    const map = new Map<number, ExplorerSummary>();
    for (const col of [0, 1, 2]) {
      const colPitches = filteredPitches.filter(
        (pitch) =>
          pitch.locationCell !== undefined &&
          pitch.locationCell !== null &&
          cellCol(pitch.locationCell) === col,
      );
      map.set(col, summarizeExplorerPitches(view, colPitches));
    }
    return map;
  }, [filteredPitches, view]);
  const selectedCellSummary =
    selectedCellId !== null ? cellSummaries.get(selectedCellId) ?? null : null;
  const selectedRowSummary =
    selectedRowId !== null ? rowSummaries.get(selectedRowId) ?? null : null;
  const selectedColSummary =
    selectedColId !== null ? colSummaries.get(selectedColId) ?? null : null;
  const selectionSummary =
    selectedCellSummary ??
    selectedRowSummary ??
    selectedColSummary ??
    selectedBucket?.summary ??
    filteredSummary;
  const selectionPitches = useMemo(() => {
    if (selectedCellId !== null) {
      return filteredPitches.filter((pitch) => pitch.locationCell === selectedCellId);
    }
    if (selectedRowId !== null) {
      return filteredPitches.filter(
        (pitch) =>
          pitch.locationCell !== undefined &&
          pitch.locationCell !== null &&
          cellRow(pitch.locationCell) === selectedRowId,
      );
    }
    if (selectedColId !== null) {
      return filteredPitches.filter(
        (pitch) =>
          pitch.locationCell !== undefined &&
          pitch.locationCell !== null &&
          cellCol(pitch.locationCell) === selectedColId,
      );
    }

    return selectedBucket ? selectedBucket.pitches : filteredPitches;
  }, [filteredPitches, selectedBucket, selectedCellId, selectedColId, selectedRowId]);
  const selectionPitchMix = useMemo(
    () => buildExplorerPitchMix(view, selectionPitches),
    [selectionPitches, view],
  );
  const hiddenZonePitchCount = useMemo(
    () => hiddenExplorerZonePitchCount(view, filteredPitches),
    [filteredPitches, view],
  );
  const selectionLabel =
    selectedCellId !== null
      ? `Zone Cell ${selectedCellId}`
      : selectedRowId !== null
        ? `${ZONE_ROW_LABELS[selectedRowId]} Row`
        : selectedColId !== null
          ? `${ZONE_COL_LABELS[selectedColId]} Col`
          : selectedBucket
            ? selectedBucket.label
            : "Filtered Sample";

  const activeFilterChips = useMemo(() => {
    const chips = [
      { label: "Season", value: resolvedSeasonUi === "all" ? "All seasons" : resolvedSeasonUi },
    ];

    if (!isPitcher && pitcherHandParam !== "all") {
      chips.push({ label: "Pitcher Hand", value: `${pitcherHandParam}HP` });
    }
    if (resolvedPitchType) {
      chips.push({ label: "Pitch Type", value: resolvedPitchType });
    }
    if (resolvedCount) {
      chips.push({ label: "Count", value: resolvedCount });
    }
    if (resolvedEvent !== "all") {
      chips.push({ label: "Event", value: eventLabelForView(view, resolvedEvent) });
    }
    if (constrainedVeloMin !== null || constrainedVeloMax !== null) {
      chips.push({
        label: "Pitch Speed",
        value: `${constrainedVeloMin ?? catalog.velocityRange?.min ?? "—"}-${constrainedVeloMax ?? catalog.velocityRange?.max ?? "—"} mph`,
      });
    }

    return chips;
  }, [
    catalog.velocityRange?.max,
    catalog.velocityRange?.min,
    constrainedVeloMax,
    constrainedVeloMin,
    isPitcher,
    pitcherHandParam,
    resolvedCount,
    resolvedEvent,
    resolvedPitchType,
    resolvedSeasonUi,
    view,
  ]);

  function handleSelectPlayer(playerSlug: string) {
    setSearchInput("");
    setSelectedBucketId(null);
    setSelectedCellId(null);
    setSelectedRowId(null);
    setSelectedColId(null);
    setSelectedPlayerSlug(playerSlug);
  }

  function handleChangeView(nextView: ComparisonView) {
    if (nextView === view) {
      return;
    }

    const nextHref = buildExplorerHref({
      view: nextView,
      pathname,
      playerSlug: resolvedPlayerSlug,
      pitcherHand: nextView === "hitters" ? pitcherHandParam : "all",
      season: resolvedSeasonUi,
      latestSeason,
      pitchType: resolvedPitchType,
      count: resolvedCount,
      event:
        nextView === "pitchers"
          ? normalizePitcherEvent(resolvedEvent)
          : normalizeHitterEvent(resolvedEvent),
      veloMin: constrainedVeloMin,
      veloMax: constrainedVeloMax,
    });

    setSearchInput("");
    router.replace(nextHref);
  }

  const resultsVisible = deferredSearch.trim().length > 0;
  const visibleResults = resultsVisible ? filteredEntries.slice(0, SEARCH_RESULT_LIMIT) : [];

  return (
    <div className="min-h-full bg-background text-slate-900 dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">

      {/* ── Hub header ── */}
      <header className="rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_24px_56px_rgba(0,0,0,0.34)]">
        <div className="flex flex-col gap-6 p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6366F1] dark:border-indigo-500/20 dark:bg-indigo-500/12 dark:text-indigo-200">
                <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                Charting
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.85rem] sm:leading-[1.02]">
                Player Insights
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-zinc-400">
                {heroDescriptionForView(view)}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
              <HubActionCard
                href={`/charting/leaderboard?tab=${isPitcher ? "pitchers" : "hitters"}`}
                icon={BarChart3}
                sectionTitle="Compare"
                buttonLabel={isPitcher ? "Pitcher Board" : "Hitter Board"}
              />
              <HubActionCard
                href="/charting/faq"
                icon={BookOpen}
                sectionTitle="Reference"
                buttonLabel="Charting FAQ"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <HubStatCard
              label={`${countNounForView(view)}s`}
              value={String(entries.length)}
              detail="With charted session data"
              tone="indigo"
            />
            <HubStatCard
              label="Charted Pitches"
              value={formatCount(totalPitches)}
              detail="Across all seasons and players"
              tone="emerald"
            />
            <HubStatCard
              label="Seasons"
              value={String(totalSeasons)}
              detail="Seasons of data available"
              tone="sky"
            />
          </div>
        </div>
      </header>

      {/* ── Filter toolbar ── */}
      <section className="rounded-[28px] border border-border bg-surface p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_24px_56px_rgba(0,0,0,0.34)] sm:p-5">
        <div className="grid gap-5">
          <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1.2fr)_auto] xl:items-end">
            <ComparisonViewToggle view={view} onChange={handleChangeView} />

            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
                Player Search
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-background px-4 py-3 transition-colors focus-within:border-[var(--brand-primary-border)] focus-within:bg-surface focus-within:shadow-[0_0_0_4px_rgba(var(--brand-primary-rgb),0.10)]">
                <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={searchPlaceholderForView(view)}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              {selectedEntry ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBucketId(null);
                    setSelectedCellId(null);
                    setSelectedRowId(null);
                    setSelectedColId(null);
                    setSelectedPlayerSlug(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-background px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400 transition-smooth hover:border-slate-300 dark:hover:border-zinc-600 hover:text-slate-900 dark:hover:text-zinc-50"
                >
                  Clear Player
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setPitcherHandParam("all");
                  setSeasonParam(null);
                  setPitchTypeParam(null);
                  setCountParam(null);
                  setEventParam("all");
                  setVeloMinParam(null);
                  setVeloMaxParam(null);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-subtle-text)] transition-smooth hover:opacity-90"
              >
                <RotateCcw className="h-4 w-4" />
                Clear Filters
              </button>
            </div>
          </div>

          {resultsVisible ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {visibleResults.length === 0 ? (
                <div className="col-span-full flex min-h-32 items-center justify-center rounded-[1.4rem] border border-dashed border-slate-200 dark:border-zinc-700 bg-background px-5 text-center text-sm text-slate-400 dark:text-zinc-500">
                  No {countNounForView(view)}s match this search.
                </div>
              ) : (
                visibleResults.map((entry) => (
                  <SearchResultCard
                    key={entry.playerSlug}
                    view={view}
                    entry={entry}
                    active={resolvedPlayerSlug === entry.playerSlug}
                    onClick={() => handleSelectPlayer(entry.playerSlug)}
                  />
                ))
              )}
            </div>
          ) : null}

          <div
            className={[
              "grid gap-4 md:grid-cols-2",
              isPitcher ? "xl:grid-cols-4" : "xl:grid-cols-5",
            ].join(" ")}
          >
            <FilterSelect
              label="Season"
              value={resolvedSeasonUi}
              onChange={(value) => setSeasonParam(value === (latestSeason ?? "all") ? null : value)}
            >
              {latestSeason ? (
                <option value={latestSeason}>{latestSeason}</option>
              ) : (
                <option value="all">All seasons</option>
              )}
              <option value="all">All seasons</option>
              {catalog.seasons
                .filter((season) => season !== latestSeason)
                .map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
            </FilterSelect>

            {!isPitcher ? (
              <FilterSelect
                label="Pitcher Hand"
                value={pitcherHandParam}
                onChange={(value) => setPitcherHandParam(normalizePitcherHandFilter(value))}
              >
                {CHARTING_PLAYER_COMPARISON_PITCHER_HAND_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </FilterSelect>
            ) : null}

            <FilterSelect
              label="Pitch Type"
              value={resolvedPitchType ?? "all"}
              onChange={(value) => setPitchTypeParam(value === "all" ? null : value)}
            >
              <option value="all">All pitch types</option>
              {catalog.pitchTypes.map((pitchType) => (
                <option key={pitchType} value={pitchType}>
                  {pitchType}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Count"
              value={resolvedCount ?? "all"}
              onChange={(value) => setCountParam(value === "all" ? null : value)}
            >
              <option value="all">All counts</option>
              {catalog.counts.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Event / Result"
              value={resolvedEvent}
              onChange={(value) =>
                setEventParam(isPitcher ? normalizePitcherEvent(value) : normalizeHitterEvent(value))
              }
            >
              {eventOptionsForView(view).map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                </option>
              ))}
            </FilterSelect>
          </div>

          <div className="grid gap-4 xl:grid-cols-2 xl:items-end">
            <VelocityRangeControl
              label="Pitch Speed Min"
              boundary="min"
              value={constrainedVeloMin}
              fallback={catalog.velocityRange?.min ?? null}
              range={catalog.velocityRange}
              onChange={(next) => {
                if (!catalog.velocityRange) return;
                const safeMax = constrainedVeloMax ?? catalog.velocityRange.max;
                const safeNext = next === null ? null : Math.min(next, safeMax);
                setVeloMinParam(safeNext);
              }}
            />

            <VelocityRangeControl
              label="Pitch Speed Max"
              boundary="max"
              value={constrainedVeloMax}
              fallback={catalog.velocityRange?.max ?? null}
              range={catalog.velocityRange}
              onChange={(next) => {
                if (!catalog.velocityRange) return;
                const safeMin = constrainedVeloMin ?? catalog.velocityRange.min;
                const safeNext = next === null ? null : Math.max(next, safeMin);
                setVeloMaxParam(safeNext);
              }}
            />
          </div>
        </div>
      </section>

      {/* ── Selected player panel ── */}
      {selectedEntry ? (
        <>
          <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_24px_56px_rgba(0,0,0,0.34)]">
            <div className="border-b border-slate-100 dark:border-zinc-800 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Current {isPitcher ? "Pitcher" : "Hitter"}
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50">
                    {selectedEntry.displayName}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500 dark:text-zinc-400">
                    {isPitcher
                      ? `Single-player charting visuals modeled after the Savant workflow, scoped to the filters currently applied across this pitcher’s ${TEAM_NAME} charting data.`
                      : `Single-player charting visuals modeled after the Savant workflow, scoped to the filters currently applied across this hitter’s ${TEAM_NAME} charting data.`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/players/${selectedEntry.playerSlug}?tab=live-ab`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-zinc-700 bg-background px-4 py-2 text-sm font-semibold text-[#334155] transition-smooth hover:border-slate-300 dark:hover:border-zinc-600 hover:text-slate-900 dark:text-zinc-200 dark:hover:text-zinc-50"
                  >
                    Open player page
                  </Link>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <LeaderboardPill key={`${chip.label}-${chip.value}`} tone="neutral" variant="light">
                    {chip.label}: {chip.value}
                  </LeaderboardPill>
                ))}
              </div>
            </div>

            <div className="grid gap-6 px-5 py-5 sm:px-6 sm:py-6 xl:grid-cols-[minmax(20rem,0.95fr)_minmax(0,1.05fr)]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <MetricToggle view={view} value={selectedMetric} onChange={setSelectedMetric} />
                  <ZoneDisplayModeToggle value={zoneDisplayMode} onChange={setZoneDisplayMode} />
                </div>
                <ZoneCanvas
                  view={view}
                  buckets={zoneBuckets}
                  metricId={selectedMetric}
                  metricOptions={metricOptions}
                  displayMode={zoneDisplayMode}
                  selectedBucketId={selectedBucketId}
                  selectedCellId={selectedCellId}
                  selectedRowId={selectedRowId}
                  selectedColId={selectedColId}
                  cellSummaries={cellSummaries}
                  rowSummaries={rowSummaries}
                  colSummaries={colSummaries}
                  allSummary={filteredSummary}
                  allPitchCount={filteredSummary.totalPitches}
                  onSelectBucket={(id) => {
                    setSelectedBucketId(id);
                    setSelectedCellId(null);
                    setSelectedRowId(null);
                    setSelectedColId(null);
                  }}
                  onSelectCell={(id) => {
                    setSelectedCellId(id);
                    setSelectedBucketId(null);
                    setSelectedRowId(null);
                    setSelectedColId(null);
                  }}
                  onSelectRow={(id) => {
                    setSelectedRowId(id);
                    setSelectedCellId(null);
                    setSelectedBucketId(null);
                    setSelectedColId(null);
                  }}
                  onSelectCol={(id) => {
                    setSelectedColId(id);
                    setSelectedCellId(null);
                    setSelectedBucketId(null);
                    setSelectedRowId(null);
                  }}
                />
                <div className="rounded-[1.5rem] border border-slate-200 dark:border-zinc-700 bg-background px-4 py-3 text-[11px] text-slate-400 dark:text-zinc-500">
                  {hiddenZonePitchCount > 0
                    ? `${hiddenZonePitchCount} filtered pitch${hiddenZonePitchCount === 1 ? "" : "es"} fall outside the visible rough-zone buckets and are omitted from the grid.`
                    : "All mapped pitches in the current sample land inside the visible rough-zone schema."}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.6rem] border border-slate-200 dark:border-zinc-700 bg-background px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                    Selection Scope
                  </div>
                  <div className="mt-2 text-lg font-black tracking-tight text-slate-900 dark:text-zinc-50">
                    {selectionLabel}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
                    {selectionSummary.totalPitches === filteredSummary.totalPitches
                      ? "Current filters with no zone slice applied."
                      : "Current filters with a zone-level slice applied."}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Pitches" value={formatCount(selectionSummary.totalPitches)} tone="emerald" />
                  {isPitcher ? (
                    <>
                      <MiniStat
                        label="TBF"
                        value={formatCount(
                          (selectionSummary as PitcherComparisonSummary).plateAppearances,
                        )}
                      />
                      <MiniStat
                        label="Strike%"
                        value={formatPct(
                          (selectionSummary as PitcherComparisonSummary).strikePct,
                          1,
                        )}
                        tone="sky"
                      />
                      <MiniStat
                        label="Whiff%"
                        value={formatPct(
                          (selectionSummary as PitcherComparisonSummary).whiffPct,
                          1,
                        )}
                      />
                      <MiniStat
                        label="BAA"
                        value={formatRate((selectionSummary as PitcherComparisonSummary).baa)}
                        tone="emerald"
                      />
                      <MiniStat
                        label="K%"
                        value={formatPct((selectionSummary as PitcherComparisonSummary).kPct, 1)}
                        tone="sky"
                      />
                    </>
                  ) : (
                    <>
                      <MiniStat
                        label="PA"
                        value={formatCount(
                          (selectionSummary as ChartingPlayerComparisonSummary).plateAppearances,
                        )}
                      />
                      <MiniStat
                        label="Swing%"
                        value={formatPct(
                          (selectionSummary as ChartingPlayerComparisonSummary).swingPct,
                          1,
                        )}
                        tone="sky"
                      />
                      <MiniStat
                        label="Whiff%"
                        value={formatPct(
                          (selectionSummary as ChartingPlayerComparisonSummary).whiffPct,
                          1,
                        )}
                      />
                      <MiniStat
                        label="AVG"
                        value={formatRate(
                          (selectionSummary as ChartingPlayerComparisonSummary).battingAverage,
                        )}
                        tone="emerald"
                      />
                      <MiniStat
                        label="wOBA"
                        value={formatRate((selectionSummary as ChartingPlayerComparisonSummary).woba)}
                        tone="sky"
                      />
                    </>
                  )}
                </div>

                <PitchMixPanel
                  title={
                    selectedCellId !== null
                      ? `Cell ${selectedCellId} Mix`
                      : selectedRowId !== null
                        ? `${ZONE_ROW_LABELS[selectedRowId]} Row Mix`
                        : selectedColId !== null
                          ? `${ZONE_COL_LABELS[selectedColId]} Col Mix`
                          : selectedBucket
                            ? `${selectedBucket.label} Mix`
                            : "Filtered Pitch Mix"
                  }
                  subtitle={
                    selectedCellId !== null
                      ? "Pitch distribution in this zone cell."
                      : selectedRowId !== null
                        ? "Pitch distribution across this horizontal row."
                        : selectedColId !== null
                          ? "Pitch distribution across this vertical column."
                          : selectedBucket
                            ? "Pitch distribution inside the active rough bucket."
                            : `Pitch distribution for the full filtered ${countNounForView(view)} scope.`
                  }
                  pitches={selectionPitchMix}
                />

              </div>
            </div>
          </div>

          <SummaryTable
            view={view}
            entry={selectedEntry}
            seasonLabel={resolvedSeasonUi}
            summary={filteredSummary}
          />
        </>
      ) : (
        <EmptyState
          view={view}
          filteredEntries={filteredEntries}
          pinnedSlug={pinnedSlug}
          onOpenPinned={
            pinnedSlug && entryBySlug.has(pinnedSlug)
              ? () => setSelectedPlayerSlug(pinnedSlug)
              : null
          }
        />
      )}
      </div>
    </div>
  );
}
