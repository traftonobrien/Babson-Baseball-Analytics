"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Trophy, Search, BookOpen, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Button,
  leaderboardFilterButtonBaseClassName,
  leaderboardFilterButtonBlueActiveClassName,
  leaderboardFilterButtonBlueInactiveClassName,
  leaderboardFilterButtonGhostInactiveClassName,
} from "@/components/ui/neon-button";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { useSmoothFilterTransition } from "@/app/components/leaderboards/useSmoothFilterTransition";
import { useKeyedState } from "@/app/hooks/useKeyedState";
import {
  LeaderboardHero,
  LeaderboardIntro,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";
import { pitchColor } from "@/lib/pitchColors";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";
import { getCanonicalName, getSlugForPlayerId } from "@/lib/canonicalPlayers";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { computeTotalStuffPlus, plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";

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
    <div className="space-y-2 relative w-full" ref={containerRef}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        {label}
      </div>
      <Button
        type="button"
        variant="default"
        neon
        tone="blue"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between min-w-[14rem] w-full px-3.5 py-2 font-medium"
      >
        <span className="flex items-center gap-2">
          {selectedOption?.chip && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: pitchColor(selectedOption.chip) }}
            />
          )}
          {selectedOption?.display}
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 top-full left-0 min-w-full mt-2 rounded-2xl border border-zinc-800/90 bg-zinc-900/95 backdrop-blur-xl p-1.5 shadow-2xl"
          >
            <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto overflow-x-hidden p-0.5 custom-scrollbar">
              {options.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={selected === opt.value ? "default" : "ghost"}
                  neon
                  tone="blue"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3.5 py-2 font-medium rounded-xl ${
                    selected === opt.value
                      ? leaderboardFilterButtonBlueActiveClassName
                      : "text-zinc-300 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate whitespace-nowrap">
                    {opt.chip && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                        style={{ backgroundColor: pitchColor(opt.chip) }}
                      />
                    )}
                    {opt.display}
                  </span>
                  {selected === opt.value && <Check className="w-4 h-4 ml-6 shrink-0 text-blue-400" />}
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function rankColor(i: number): string {
  const glow = "[text-shadow:0_0_8px_currentColor]";
  if (i === 0) return `text-amber-400 ${glow}`; // gold
  if (i === 1) return `text-zinc-400 ${glow}`; // silver
  if (i === 2) return `text-amber-600 ${glow}`; // bronze
  return "text-zinc-500";
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
    <LeaderboardPageFrame maxWidth="max-w-7xl">
      <LeaderboardIntro
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Leaderboards", href: "/leaderboards-hub" },
          { label: "Trackman" },
        ]}
      >
        <LeaderboardHero
          tone="blue"
          icon={Trophy}
          eyebrow="Stuff And Trackman"
          title={<>Trackman Leaderboard</>}
          meta={(
            <>
              <LeaderboardPill tone="blue">{activeLabel}</LeaderboardPill>
              <LeaderboardPill tone="neutral">
                {data?.session_count ?? 0} session{data?.session_count === 1 ? "" : "s"}
              </LeaderboardPill>
              {data?.generated_at ? (
                <LeaderboardPill tone="neutral">
                  Updated {new Date(data.generated_at).toLocaleDateString()}
                </LeaderboardPill>
              ) : null}
            </>
          )}
          side={(
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Guide</div>
              <Link
                href="/trackman/faq"
                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-blue-500/25 bg-blue-500/10 px-4 py-3.5 text-sm font-semibold text-blue-300 transition-smooth hover:border-blue-400/40 hover:text-blue-200"
              >
                <BookOpen className="h-4 w-4" />
                Metrics Dictionary
              </Link>
            </div>
          )}
        />
      </LeaderboardIntro>

      {loading ? (
        <LeaderboardPanel className="mt-6 p-10 text-center text-zinc-500">
          Loading leaderboards...
        </LeaderboardPanel>
      ) : categories.length === 0 ? (
        <LeaderboardPanel className="mt-6 p-8 text-center">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">No leaderboard data yet.</p>
          <p className="mt-2 text-xs text-zinc-600">
            Import sessions with <code className="rounded bg-zinc-800 px-1 py-0.5">scripts/import_trackman_pdf.py</code>, run{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5">scripts/build_trackman_leaderboards.py</code>, or load Stuff+ with{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5">npm run load:stuff-plus</code>
          </p>
        </LeaderboardPanel>
      ) : (
        <>
          <LeaderboardToolbar>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(18rem,22rem)] xl:items-end">
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
              <div className="hidden xl:block space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Metric
                </div>
                <div className="flex min-h-[3.75rem] flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                  {categories.map((cat) => (
                    <Button
                      key={cat}
                      type="button"
                      size="sm"
                      variant="default"
                      neon
                      tone="blue"
                      onClick={() => runWithTransition(() => setActiveCategory(cat))}
                      title={CATEGORY_TOOLTIPS[cat]}
                      className={`${leaderboardFilterButtonBaseClassName} ${
                        activeCategory === cat
                          ? leaderboardFilterButtonBlueActiveClassName
                          : leaderboardFilterButtonBlueInactiveClassName
                      }`}
                    >
                      {CATEGORY_LABELS[cat] ?? cat}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                    Search
                  </div>
                  <label className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search pitcher..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
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
                <div className="hidden xl:flex mt-3 flex-wrap gap-1.5">
                  {categoryPitchOptions.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      size="sm"
                      variant="default"
                      neon
                      tone="blue"
                      onClick={() => runWithTransition(() => setCategoryPitchFilter(opt.value))}
                      className={`${leaderboardFilterButtonBaseClassName} flex items-center gap-1 ${
                        categoryPitchFilter === opt.value
                          ? leaderboardFilterButtonBlueActiveClassName
                          : leaderboardFilterButtonBlueInactiveClassName
                      }`}
                    >
                      {opt.value !== "all" && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: pitchColor(opt.label) }}
                        />
                      )}
                      {opt.label}
                    </Button>
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
                  <div className="hidden xl:flex mt-3 flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      neon
                      tone="blue"
                      onClick={() => runWithTransition(() => setStuffPlusPitchFilter("total"))}
                      className={`${leaderboardFilterButtonBaseClassName} ${
                        stuffPlusPitchFilter === "total"
                          ? leaderboardFilterButtonBlueActiveClassName
                          : leaderboardFilterButtonBlueInactiveClassName
                      }`}
                    >
                      Total Grade
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      neon
                      tone="blue"
                      onClick={() => runWithTransition(() => setStuffPlusPitchFilter("all"))}
                      className={`${leaderboardFilterButtonBaseClassName} ${
                        stuffPlusPitchFilter === "all"
                          ? leaderboardFilterButtonBlueActiveClassName
                          : leaderboardFilterButtonBlueInactiveClassName
                      }`}
                    >
                      Top Pitch
                    </Button>
                    {stuffPlusPitchTypes.map((pt) => (
                      <Button
                        key={pt}
                        type="button"
                        size="sm"
                        variant="default"
                        neon
                        tone="blue"
                        onClick={() => runWithTransition(() => setStuffPlusPitchFilter(pt))}
                        className={`${leaderboardFilterButtonBaseClassName} flex items-center gap-1 ${
                          stuffPlusPitchFilter === pt
                            ? leaderboardFilterButtonBlueActiveClassName
                            : leaderboardFilterButtonBlueInactiveClassName
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: pitchColor(pt) }}
                        />
                        {pt}
                      </Button>
                    ))}
                  </div>
                </div>
                <LeaderboardPanel className="mt-4 overflow-hidden">
                  <div className="max-h-[70vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">#</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Player</th>
                        {stuffPlusPitchFilter === "all" && (
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Pitch</th>
                        )}
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider" title={CATEGORY_TOOLTIPS.stuff_plus}>Stuff+</th>
                        {stuffPlusPitchFilter !== "total" && (
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Velo</th>
                        )}
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Sessions</th>
                      </tr>
                    </thead>
                    <tbody key={`stuff-${transitionKey}`}>
                      {rankedStuffPlus.map((r, i) => {
                        const isMe = getSlugForPlayerId(r.playerId) === selectedSlug;
                        const rowTransition = getRowTransitionProps(i);
                        return (
                        <tr
                          key={`${r.playerId}-${r.pitchType}-${i}`}
                          className={`${rowTransition.className} border-b border-zinc-800/50 hover:bg-blue-500/5 transition-smooth ${isMe ? "bg-emerald-500/5" : ""}`}
                          style={rowTransition.style}
                        >
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>{i + 1}</td>
                          <td className="px-4 py-3 font-medium">
                            <Link
                              href={trackmanPlayerHref(r.playerId)}
                              className="text-blue-400 hover:text-blue-300 transition-smooth"
                            >
                              {getCanonicalName(r.playerName ?? r.playerId ?? "")}
                              {isMe && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">You</span>}
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
                            <td className="px-4 py-3 text-right font-mono text-zinc-400">
                              {r.avgVeloMph != null ? `${r.avgVeloMph.toFixed(1)} mph` : "—"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-mono text-zinc-500">
                            {r.nSessions ?? "—"}
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                  </div>
                </LeaderboardPanel>
                {rankedStuffPlus.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <p className="text-zinc-500 text-sm">No players match your search.</p>
                    {search.trim() && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-smooth"
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
                <LeaderboardPanel className="mt-4 overflow-hidden">
                  <div className="max-h-[70vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">#</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Player</th>
                        {activeCategory === "max_fb_velo" && categoryPitchOptions.length > 0 && (
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Pitch</th>
                        )}
                        {activeCategory !== "max_fb_velo" && (
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Sessions</th>
                        )}
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          {CATEGORY_LABELS[activeCategory] ?? activeCategory}
                        </th>
                      </tr>
                    </thead>
                    <tbody key={`metric-${activeCategory}-${transitionKey}`}>
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-zinc-500">No players match your search.</span>
                              {search.trim() && (
                                <button
                                  type="button"
                                  onClick={() => setSearch("")}
                                  className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-smooth"
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
                          className={`${rowTransition.className} border-b border-zinc-800/50 hover:bg-blue-500/5 transition-smooth ${isMe ? "bg-emerald-500/5" : ""}`}
                          style={rowTransition.style}
                        >
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>{e.rank}</td>
                          <td className="px-4 py-3 font-medium">
                            <Link
                              href={`/trackman/player/${e.playerSlug}`}
                              className="text-blue-400 hover:text-blue-300 transition-smooth"
                            >
                              {getCanonicalName(e.playerName)}
                              {isMe && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">You</span>}
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
                                <span className="text-zinc-500">—</span>
                              )}
                            </td>
                          )}
                          {activeCategory !== "max_fb_velo" && (
                            <td className="px-4 py-3 text-right text-zinc-500 font-mono">
                              {e.sessionCount ?? "\u2014"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-mono font-medium">
                            {fmt(e.value, activeCategory)}{" "}
                            <span className="text-zinc-500">
                              {CATEGORY_UNITS[activeCategory] ?? ""}
                            </span>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                  </div>
                </LeaderboardPanel>
              </>
            ) : null}

            {/* Pitch mix */}
            {data?.pitch_mix && data.pitch_mix.length > 0 && (
              <LeaderboardPanel className="mt-6 p-5">
                <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">
                  Team Pitch Mix
                </h3>
                <div className="flex gap-4 flex-wrap">
                  {data.pitch_mix.map((pm) => (
                    <div key={pm.pitch_type} className="text-center">
                      <div className="text-lg font-mono font-semibold">
                        {pm.pct}%
                      </div>
                      <div className="mt-1 flex justify-center">
                        <PitchTypeChip
                          pitchType={pm.pitch_type}
                          label={pm.pitch_type}
                          size="xs"
                        />
                      </div>
                      <div className="text-[10px] text-zinc-600">{pm.count}</div>
                    </div>
                  ))}
                </div>
              </LeaderboardPanel>
            )}
          </div>
          </>
        )}
    </LeaderboardPageFrame>
  );
}
