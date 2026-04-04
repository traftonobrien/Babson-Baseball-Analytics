"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Trophy, Search, BookOpen, ChevronDown, Check, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { HubActionCard, HubStatCard } from "@/app/components/hub/HubHeader";
import { LeaderboardExportPdfButton } from "@/app/components/leaderboards/LeaderboardExportPdfButton";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { useSmoothFilterTransition } from "@/app/components/leaderboards/useSmoothFilterTransition";
import { useKeyedState } from "@/app/hooks/useKeyedState";
import { LeaderboardPageFrame, LeaderboardToolbar } from "@/app/components/leaderboards/LeaderboardChrome";
import { pitchColor } from "@/lib/pitchColors";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";
import { getCanonicalName, getSlugForPlayerId } from "@/lib/canonicalPlayers";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { computeTotalStuffPlus, plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  playerSlug: string;
  team?: string;
  sessionCount?: number;
  value: number;
  pitch_type?: string;
}

interface PitchMix {
  pitch_type: string;
  count: number;
  pct: number;
}

interface Leaderboards {
  generated_at?: string;
  session_count: number;
  leaderboards: Record<string, LeaderboardEntry[]>;
  pitch_mix?: PitchMix[];
}

interface StuffPlusRow {
  playerId: string;
  playerName: string | null;
  pitchType: string;
  meanStuffPlus: number;
  avgVeloMph: number | null;
  nSessions: number | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  stuff_plus: "Stuff+",
  max_fb_velo: "Max FB Velo",
  avg_fb_velo: "Avg Fastball Velo",
  avg_fb_spin: "Avg Spin Rate (Fastballs)",
  avg_bb_spin: "Avg Spin Rate (Breaking Balls)",
  avg_extension: "Avg Extension",
};

/** Compact labels for the desktop metric grid (full names stay in tooltips + mobile dropdown). */
const CATEGORY_SHORT_LABELS: Record<string, string> = {
  stuff_plus: "Stuff+",
  max_fb_velo: "Max FB",
  avg_fb_velo: "Avg FB velo",
  avg_fb_spin: "FB spin",
  avg_bb_spin: "BB spin",
  avg_extension: "Extension",
};

const CATEGORY_UNITS: Record<string, string> = {
  max_fb_velo: "mph",
  avg_fb_velo: "mph",
  avg_fb_spin: "rpm",
  avg_bb_spin: "rpm",
  avg_extension: "ft",
};

const CATEGORY_TOOLTIPS: Record<string, string> = {
  stuff_plus: "Pitch quality metric (100 = league average). Higher = better movement/velo/spin.",
  max_fb_velo: "Maximum fastball velocity from session. Primary fastball type used.",
  avg_fb_velo: "Average fastball velocity across sessions.",
  avg_fb_spin: "Average spin rate for fastballs (4-seam, sinker).",
  avg_bb_spin: "Average spin rate for breaking balls (slider, curve, sweeper).",
  avg_extension: "Average release extension (feet from rubber).",
};

const STUFF_PLUS_PITCH_ORDER = [
  "Fastball", "Sinker", "Cutter",
  "Slider", "Curveball", "Sweeper",
  "Changeup", "Splitter",
];

const BASE_CATEGORIES = [
  "stuff_plus",
  "max_fb_velo",
  "avg_fb_velo",
  "avg_fb_spin",
  "avg_bb_spin",
  "avg_extension",
] as const;

function fmt(v: number, cat: string): string {
  if (cat.includes("spin")) return v.toFixed(0);
  return v.toFixed(1);
}

interface DropdownFilterProps<T extends string> {
  label: string;
  options: { value: T; display: string; chip?: string }[];
  selected: T;
  onChange: (v: T) => void;
}

function DropdownFilter<T extends string>({ label, options, selected, onChange }: DropdownFilterProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === selected) ?? options[0];

  return (
    <div className="relative w-full space-y-2" ref={containerRef}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
        {label}
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-w-[14rem] w-full items-center justify-between rounded-full border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-smooth hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-600"
      >
        <span className="flex items-center gap-2">
          {selectedOption?.chip && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
              style={{ backgroundColor: pitchColor(selectedOption.chip) }}
            />
          )}
          {selectedOption?.display}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 dark:text-zinc-500 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-full z-50 mt-2 min-w-full rounded-2xl border border-slate-200 bg-surface p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="custom-scrollbar flex max-h-[300px] flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-0.5">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-sm font-medium transition-smooth",
                    selected === opt.value
                      ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
                  )}
                >
                  <span className="flex items-center gap-2 truncate whitespace-nowrap">
                    {opt.chip && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                        style={{ backgroundColor: pitchColor(opt.chip) }}
                      />
                    )}
                    {opt.display}
                  </span>
                  {selected === opt.value ? <Check className="ml-6 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" /> : null}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function rankColor(i: number): string {
  const glow = "[text-shadow:0_0_6px_rgba(234,179,8,0.35)]";
  if (i === 0) return `text-amber-600 ${glow} dark:text-amber-400`;
  if (i === 1) return `text-slate-400 ${glow} dark:text-zinc-400`;
  if (i === 2) return `text-amber-700 ${glow} dark:text-amber-500`;
  return "text-slate-500 dark:text-zinc-400";
}

function lightPill(active: boolean): string {
  return cn(
    "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition-all",
    active
      ? "bg-surface text-slate-900 shadow-sm ring-1 ring-slate-200 dark:text-zinc-100 dark:ring-zinc-700"
      : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100",
  );
}

/** Denser pill for multi-metric grid / filter rails. */
function metricSelectPill(active: boolean): string {
  return cn(
    "inline-flex min-h-[2.25rem] w-full items-center justify-center rounded-xl px-2 py-1.5 text-center text-[11px] font-semibold leading-tight transition-all sm:text-xs sm:leading-snug",
    active
      ? "bg-surface text-slate-900 shadow-sm ring-1 ring-slate-200 dark:text-zinc-100 dark:ring-zinc-700"
      : "text-slate-500 hover:bg-surface/60 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100",
  );
}

function trackmanPlayerHref(playerId: string): string {
  const slug = getSlugForPlayerId(playerId);
  return `/trackman/player/${slug ?? playerId}`;
}

export default function TrackmanLeaderboardsPage() {
  const {
    runWithTransition,
    contentTransitionClassName,
    getRowTransitionProps,
    transitionKey,
  } = useSmoothFilterTransition();
  const [data, setData] = useState<Leaderboards | null>(null);
  const [stuffPlusRows, setStuffPlusRows] = useState<StuffPlusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stuffPlusPitchFilter, setStuffPlusPitchFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { slug: selectedSlug } = useSelectedPlayer();

  useEffect(() => {
    Promise.all([
      fetch("/trackman/leaderboards.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/stuff-plus/leaderboard").then((r) => (r.ok ? r.json() : { rows: [] })).catch(() => ({ rows: [] })),
    ]).then(([lb, sp]) => {
      setData(lb);
      setStuffPlusRows(
        (sp?.rows ?? []).map((r: Record<string, unknown>) => ({
          playerId: r.playerId as string,
          playerName: r.playerName as string | null,
          pitchType: r.pitchType as string,
          meanStuffPlus: Number(r.meanStuffPlus),
          avgVeloMph: r.avgVeloMph != null ? Number(r.avgVeloMph) : null,
          nSessions: r.nSessions != null ? Number(r.nSessions) : null,
        }))
      );
      setLoading(false);
    });
  }, []);

  const categories = useMemo(() => {
    const cats: string[] = [];
    if (stuffPlusRows.length > 0) cats.push("stuff_plus");
    if (data?.leaderboards) {
      for (const k of BASE_CATEGORIES) {
        if (k !== "stuff_plus" && data.leaderboards[k]?.length > 0) cats.push(k);
      }
    }
    return cats.sort((a, b) => {
      const ia = (BASE_CATEGORIES as readonly string[]).indexOf(a);
      const ib = (BASE_CATEGORIES as readonly string[]).indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [data, stuffPlusRows]);

  const [activeCategoryState, setActiveCategory] = useKeyedState(
    categories.join("|"),
    () => categories[0] ?? "",
  );
  const activeCategory =
    activeCategoryState && categories.includes(activeCategoryState)
      ? activeCategoryState
      : (categories[0] ?? "");
  const [categoryPitchFilter, setCategoryPitchFilter] = useKeyedState(
    activeCategory,
    () => "all",
  );

  const categoryPitchOptions = useMemo(() => {
    if (activeCategory === "stuff_plus") return [];
    const fastballCats = ["max_fb_velo", "avg_fb_velo", "avg_fb_spin", "avg_extension"];
    const breakingCats = ["avg_bb_spin"];
    if (fastballCats.includes(activeCategory)) {
      return [
        { value: "all", label: "All Fastballs" },
        { value: "Fastball", label: "Fastball" },
        { value: "Sinker", label: "Sinker" },
      ];
    }
    if (breakingCats.includes(activeCategory)) {
      return [
        { value: "all", label: "All Breaking" },
        { value: "Slider", label: "Slider" },
        { value: "Curveball", label: "Curveball" },
        { value: "Sweeper", label: "Sweeper" },
      ];
    }
    return [];
  }, [activeCategory]);

  const entries = useMemo(() => {
    if (activeCategory === "stuff_plus") return [];
    // max_fb_velo: values from CSV, filter by pitch_type when not "all"
    const isMaxFbVelo = activeCategory === "max_fb_velo";
    let list: LeaderboardEntry[];
    if (isMaxFbVelo && categoryPitchFilter !== "all") {
      const base = data?.leaderboards?.[activeCategory] ?? [];
      list = base.filter((e: LeaderboardEntry) => e.pitch_type === categoryPitchFilter);
      // Re-rank after filter
      list = [...list].sort((a, b) => b.value - a.value).map((e, i) => ({ ...e, rank: i + 1 }));
    } else if (categoryPitchFilter === "all") {
      list = data?.leaderboards?.[activeCategory] ?? [];
    } else {
      const key = `${activeCategory}_${categoryPitchFilter.toLowerCase().replace(/\s+/g, "_")}`;
      list = data?.leaderboards?.[key] ?? data?.leaderboards?.[activeCategory] ?? [];
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e: LeaderboardEntry) =>
          getCanonicalName(e.playerName).toLowerCase().includes(q) ||
          e.playerSlug.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, activeCategory, categoryPitchFilter, search]);

  const stuffPlusPitchTypes = useMemo(() => {
    const set = new Set(
      stuffPlusRows.map((r) => getStuffPlusDisplayPitchType(r.playerId, r.pitchType))
    );
    return Array.from(set).sort((a, b) => {
      const ia = STUFF_PLUS_PITCH_ORDER.indexOf(a);
      const ib = STUFF_PLUS_PITCH_ORDER.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [stuffPlusRows]);

  const rankedStuffPlus = useMemo(() => {
    let d = stuffPlusRows;
    if (stuffPlusPitchFilter === "total") {
      // Group by player and average all pitch type scores
      const byPlayer = new Map<string, StuffPlusRow[]>();
      for (const r of d) {
        if (!byPlayer.has(r.playerId)) byPlayer.set(r.playerId, []);
        byPlayer.get(r.playerId)!.push(r);
      }
      d = Array.from(byPlayer.entries()).map(([, rows]) => {
        const avg = computeTotalStuffPlus(rows)!;
        return { ...rows[0], pitchType: "Total", meanStuffPlus: avg, avgVeloMph: null };
      });
    } else if (stuffPlusPitchFilter !== "all") {
      d = d.filter(
        (r) => getStuffPlusDisplayPitchType(r.playerId, r.pitchType) === stuffPlusPitchFilter
      );
    } else {
      const byPlayer = new Map<string, StuffPlusRow>();
      for (const r of d) {
        const existing = byPlayer.get(r.playerId);
        if (!existing || r.meanStuffPlus > existing.meanStuffPlus) {
          byPlayer.set(r.playerId, r);
        }
      }
      d = Array.from(byPlayer.values());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(
        (r) =>
          getCanonicalName(r.playerName ?? r.playerId ?? "").toLowerCase().includes(q) ||
          r.playerId.toLowerCase().includes(q)
      );
    }
    return [...d].sort((a, b) => b.meanStuffPlus - a.meanStuffPlus);
  }, [stuffPlusRows, stuffPlusPitchFilter, search]);

  const activeLabel = activeCategory ? (CATEGORY_LABELS[activeCategory] ?? activeCategory) : "Trackman";

  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-[1440px]">
      <div className="leaderboard-print-root font-display flex min-h-full flex-col gap-6">
        <Breadcrumbs
          className="leaderboard-print-hide"
          variant="light"
          items={[
            { label: "Home", href: "/" },
            { label: "Leaderboards", href: "/leaderboards-hub" },
            { label: "Trackman" },
          ]}
        />

        <header className="leaderboard-print-panel rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-800">
                  <Activity className="h-3.5 w-3.5" aria-hidden />
                  Trackman
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.85rem] sm:leading-[1.02]">
                  Trackman Leaderboard
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                  {activeLabel}
                  {data?.generated_at
                    ? ` · Updated ${new Date(data.generated_at).toLocaleDateString()}`
                    : ""}
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
                <LeaderboardExportPdfButton
                  fileStem={`trackman_leaderboard_${activeCategory}_${stuffPlusPitchFilter}`}
                  className="w-full sm:ml-auto sm:w-auto"
                />
                <div className="leaderboard-print-hide grid grid-cols-2 gap-3">
                  <HubActionCard
                    href="/trackman"
                    icon={Trophy}
                    sectionTitle="Trackman hub"
                    buttonLabel="View Hub"
                  />
                  <HubActionCard
                    href="/trackman/faq"
                    icon={BookOpen}
                    sectionTitle="Dictionary"
                    buttonLabel="Metrics FAQ"
                  />
                </div>
              </div>
            </div>

            <div className="leaderboard-print-hide grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <HubStatCard
                label="Sessions"
                value={loading ? "—" : String(data?.session_count ?? 0)}
                detail="Imported Trackman sessions in the published bundle."
                tone="indigo"
              />
              <HubStatCard
                label="Stuff+ rows"
                value={loading ? "—" : String(stuffPlusRows.length)}
                detail="Pitch-type rows from the Stuff+ API feed."
                tone="emerald"
              />
              <HubStatCard
                label="Metrics available"
                value={loading ? "—" : String(categories.length)}
                detail="Leaderboard columns with data for the current build."
                tone="sky"
              />
            </div>
          </div>
        </header>

      {loading ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-surface p-10 text-center text-slate-500 shadow-sm dark:border-zinc-700 dark:text-zinc-400 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          Loading leaderboards...
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-surface p-8 text-center shadow-sm dark:border-zinc-700 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-400 dark:text-zinc-500" />
          <p className="text-sm text-slate-600 dark:text-zinc-300">No leaderboard data yet.</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
            Import sessions with <code className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900/70">scripts/import_trackman_pdf.py</code>, run{" "}
            <code className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900/70">scripts/build_trackman_leaderboards.py</code>, or load Stuff+ with{" "}
            <code className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900/70">npm run load:stuff-plus</code>
          </p>
        </div>
      ) : (
        <>
          <LeaderboardToolbar variant="light" className="leaderboard-print-hide">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] xl:items-end">
              <div className="xl:hidden">
                <DropdownFilter<string>
                  label="Metric"
                  options={categories.map((cat) => ({
                    value: cat,
                    display: CATEGORY_LABELS[cat] ?? cat,
                  }))}
                  selected={activeCategory}
                  onChange={(cat) => runWithTransition(() => setActiveCategory(cat))}
                />
              </div>
              <div className="hidden min-w-0 space-y-2 xl:block">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
                  Metric
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-100 p-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(7.25rem,1fr))] gap-1">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => runWithTransition(() => setActiveCategory(cat))}
                        title={`${CATEGORY_LABELS[cat] ?? cat} — ${CATEGORY_TOOLTIPS[cat] ?? ""}`}
                        className={metricSelectPill(activeCategory === cat)}
                      >
                        {CATEGORY_SHORT_LABELS[cat] ?? CATEGORY_LABELS[cat] ?? cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
                    Search
                  </div>
                  <label className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-100 px-4 py-3 shadow-sm transition-all focus-within:border-sky-300 focus-within:bg-surface dark:border-zinc-700 dark:bg-zinc-900/70 dark:focus-within:border-sky-500/60">
                    <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search pitcher..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    />
                  </label>
                </div>

              </div>
            </div>
          </LeaderboardToolbar>

          <div
            className={contentTransitionClassName}
          >
            {categoryPitchOptions.length > 0 && (
              <div className="mt-4">
                <div className="xl:hidden">
                  <DropdownFilter<string>
                    label="Pitch Filter"
                    options={categoryPitchOptions.map((opt) => ({
                      value: opt.value,
                      display: opt.label,
                      chip: opt.value !== "all" ? opt.label : undefined,
                    }))}
                    selected={categoryPitchFilter}
                    onChange={(val) => runWithTransition(() => setCategoryPitchFilter(val))}
                  />
                </div>
                <div className="mt-3 hidden flex-wrap gap-1 rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-zinc-700 dark:bg-zinc-900/70 xl:flex">
                  {categoryPitchOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => runWithTransition(() => setCategoryPitchFilter(opt.value))}
                      className={`${lightPill(categoryPitchFilter === opt.value)} inline-flex items-center gap-1`}
                    >
                      {opt.value !== "all" && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full shadow-sm"
                          style={{ backgroundColor: pitchColor(opt.label) }}
                        />
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stuff+ section */}
            {activeCategory && activeCategory === "stuff_plus" ? (
              <>
                <div className="mt-4">
                  <div className="xl:hidden">
                    <DropdownFilter<string>
                      label="Pitch Filter"
                      options={[
                        { value: "total", display: "Total Grade" },
                        { value: "all", display: "Top Pitch" },
                        ...stuffPlusPitchTypes.map((pt) => ({
                          value: pt,
                          display: pt,
                          chip: pt,
                        })),
                      ]}
                      selected={stuffPlusPitchFilter}
                      onChange={(val) => runWithTransition(() => setStuffPlusPitchFilter(val))}
                    />
                  </div>
                  <div className="mt-3 hidden flex-wrap gap-1 rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-zinc-700 dark:bg-zinc-900/70 xl:flex">
                    <button
                      type="button"
                      onClick={() => runWithTransition(() => setStuffPlusPitchFilter("total"))}
                      className={lightPill(stuffPlusPitchFilter === "total")}
                    >
                      Total Grade
                    </button>
                    <button
                      type="button"
                      onClick={() => runWithTransition(() => setStuffPlusPitchFilter("all"))}
                      className={lightPill(stuffPlusPitchFilter === "all")}
                    >
                      Top Pitch
                    </button>
                    {stuffPlusPitchTypes.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => runWithTransition(() => setStuffPlusPitchFilter(pt))}
                        className={`${lightPill(stuffPlusPitchFilter === pt)} inline-flex items-center gap-1`}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full shadow-sm"
                          style={{ backgroundColor: pitchColor(pt) }}
                        />
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="leaderboard-print-panel mt-4 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-surface shadow-sm dark:border-zinc-700 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                  <div className="leaderboard-print-table-shell max-h-[70vh] overflow-auto">
                  <table className="leaderboard-print-table w-full text-sm">
                    <thead className="leaderboard-print-sticky-head sticky top-0 z-10 border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900/85">
                      <tr>
                        <th className="w-12 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">#</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Player</th>
                        {stuffPlusPitchFilter === "all" && (
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Pitch</th>
                        )}
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400" title={CATEGORY_TOOLTIPS.stuff_plus}>Stuff+</th>
                        {stuffPlusPitchFilter !== "total" && (
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Velo</th>
                        )}
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Sessions</th>
                      </tr>
                    </thead>
                    <tbody key={`stuff-${transitionKey}`}>
                      {rankedStuffPlus.map((r, i) => {
                        const isMe = getSlugForPlayerId(r.playerId) === selectedSlug;
                        const rowTransition = getRowTransitionProps(i);
                        return (
                        <tr
                          key={`${r.playerId}-${r.pitchType}-${i}`}
                          className={`${rowTransition.className} border-b border-slate-100 transition-smooth last:border-b-0 hover:bg-slate-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40 ${isMe ? "bg-emerald-50/80 dark:bg-emerald-950/40" : ""}`}
                          style={rowTransition.style}
                        >
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-zinc-100">
                            <Link
                              href={trackmanPlayerHref(r.playerId)}
                              className="text-slate-900 transition-smooth hover:text-sky-700 dark:text-zinc-100 dark:hover:text-sky-400"
                            >
                              {getCanonicalName(r.playerName ?? r.playerId ?? "")}
                              {isMe && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">You</span>}
                            </Link>
                          </td>
                          {stuffPlusPitchFilter === "all" && (
                            <td className="px-4 py-3">
                              <PitchTypeChip
                                pitchType={getStuffPlusDisplayPitchType(r.playerId, r.pitchType)}
                                label={getStuffPlusDisplayPitchType(r.playerId, r.pitchType)}
                                size="xs"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 text-right">
                            <span
                              className="inline-flex items-center justify-center rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold tracking-tight"
                              style={plusMetricBadgeStyle(r.meanStuffPlus)}
                            >
                              {r.meanStuffPlus.toFixed(1)}
                            </span>
                          </td>
                          {stuffPlusPitchFilter !== "total" && (
                            <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-zinc-400">
                              {r.avgVeloMph != null ? `${r.avgVeloMph.toFixed(1)} mph` : "—"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-zinc-400">
                            {r.nSessions ?? "—"}
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
                {rankedStuffPlus.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <p className="text-sm text-slate-500 dark:text-zinc-400">No players match your search.</p>
                    {search.trim() && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="text-sm font-medium text-sky-700 transition-smooth hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : activeCategory ? (
              <>
                {/* Trackman leaderboard table */}
                <div className="leaderboard-print-panel mt-4 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-surface shadow-sm dark:border-zinc-700 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                  <div className="leaderboard-print-table-shell max-h-[70vh] overflow-auto">
                  <table className="leaderboard-print-table w-full text-sm">
                    <thead className="leaderboard-print-sticky-head sticky top-0 z-10 border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900/85">
                      <tr>
                        <th className="w-12 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">#</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Player</th>
                        {activeCategory === "max_fb_velo" && categoryPitchOptions.length > 0 && (
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Pitch</th>
                        )}
                        {activeCategory !== "max_fb_velo" && (
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Sessions</th>
                        )}
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          {CATEGORY_LABELS[activeCategory] ?? activeCategory}
                        </th>
                      </tr>
                    </thead>
                    <tbody key={`metric-${activeCategory}-${transitionKey}`}>
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-slate-500 dark:text-zinc-400">No players match your search.</span>
                              {search.trim() && (
                                <button
                                  type="button"
                                  onClick={() => setSearch("")}
                                  className="text-sm font-medium text-sky-700 transition-smooth hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                                >
                                  Clear filters
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      {entries.map((e, i) => {
                        const pitchLabel = (e as LeaderboardEntry & { pitch_type?: string }).pitch_type ?? (categoryPitchFilter !== "all" ? categoryPitchFilter : null);
                        const isMe = e.playerSlug === selectedSlug;
                        const rowTransition = getRowTransitionProps(i);
                        return (
                        <tr
                          key={`${e.playerSlug}-${i}`}
                          className={`${rowTransition.className} border-b border-slate-100 transition-smooth last:border-b-0 hover:bg-slate-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40 ${isMe ? "bg-emerald-50/80 dark:bg-emerald-950/40" : ""}`}
                          style={rowTransition.style}
                        >
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>{e.rank}</td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-zinc-100">
                            <Link
                              href={`/trackman/player/${e.playerSlug}`}
                              className="transition-smooth hover:text-sky-700 dark:text-zinc-100 dark:hover:text-sky-400"
                            >
                              {getCanonicalName(e.playerName)}
                              {isMe && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">You</span>}
                            </Link>
                          </td>
                          {activeCategory === "max_fb_velo" && categoryPitchOptions.length > 0 && (
                            <td className="px-4 py-3">
                              {pitchLabel ? (
                                <PitchTypeChip
                                  pitchType={pitchLabel}
                                  label={pitchLabel}
                                  size="xs"
                                />
                              ) : (
                                <span className="text-slate-400 dark:text-zinc-500">—</span>
                              )}
                            </td>
                          )}
                          {activeCategory !== "max_fb_velo" && (
                            <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-zinc-400">
                              {e.sessionCount ?? "\u2014"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-zinc-100">
                            {fmt(e.value, activeCategory)}{" "}
                            <span className="text-slate-500 dark:text-zinc-500">
                              {CATEGORY_UNITS[activeCategory] ?? ""}
                            </span>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                  </div>
                </div>
              </>
            ) : null}

            {/* Pitch mix */}
            {data?.pitch_mix && data.pitch_mix.length > 0 && (
              <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-surface p-5 shadow-sm dark:border-zinc-700 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                <h3 className="mb-3 text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Team Pitch Mix
                </h3>
                <div className="flex flex-wrap gap-4">
                  {data.pitch_mix.map((pm) => (
                    <div key={pm.pitch_type} className="text-center">
                      <div className="text-lg font-mono font-semibold text-slate-900 dark:text-zinc-100">
                        {pm.pct}%
                      </div>
                      <div className="mt-1 flex justify-center">
                        <PitchTypeChip
                          pitchType={pm.pitch_type}
                          label={pm.pitch_type}
                          size="xs"
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-500">{pm.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </LeaderboardPageFrame>
  );
}
