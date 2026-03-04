"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  BookOpen,
  Layers3,
  Search,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { useSmoothFilterTransition } from "@/app/components/leaderboards/useSmoothFilterTransition";
import {
  Button,
  leaderboardFilterButtonAmberActiveClassName,
  leaderboardFilterButtonBaseClassName,
  leaderboardFilterButtonGhostInactiveClassName,
  leaderboardFilterButtonZincActiveClassName,
} from "@/components/ui/neon-button";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { getSlugForPlayerId } from "@/lib/canonicalPlayers";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import type {
  PlusLeaderboardPayload,
  PlusPitchTypeRow,
  PlusPlayerRow,
  PlusSeasonFilter,
} from "@/lib/plusLeaderboardTypes";

type ViewMode = "players" | "pitchTypes";
type HandFilter = "ALL" | "R" | "L";
type RowTransitionProps = { className: string; style: CSSProperties };

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function reasonCopy(reason: string | null): string {
  switch (reason) {
    case "missing_live_command":
      return "Waiting on qualified live command";
    case "missing_stuff":
      return "Waiting on Stuff+";
    case "no_overlap":
      return "No clean overlap yet";
    case "ambiguous_stuff_match":
      return "Ambiguous pitch match";
    default:
      return "Ready";
  }
}

function metricValue(
  row: { pitchingPlus: number | null },
): number | null {
  return row.pitchingPlus;
}

function compareMetric(
  a: { pitchingPlus: number | null },
  b: { pitchingPlus: number | null },
): number {
  const av = metricValue(a);
  const bv = metricValue(b);
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  return bv - av;
}

function metricBadge(value: number | null) {
  if (value === null) {
    return (
      <span className="inline-flex rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-500">
        —
      </span>
    );
  }

  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold"
      style={plusMetricBadgeStyle(value)}
    >
      {value.toFixed(0)}
    </span>
  );
}

function handBadge(throws: "R" | "L" | null) {
  if (!throws) {
    return (
      <span className="inline-flex rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        —
      </span>
    );
  }

  const classes =
    throws === "L"
      ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
      : "border-amber-500/40 bg-amber-500/10 text-amber-300";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${classes}`}>
      {throws === "L" ? "LHP" : "RHP"}
    </span>
  );
}

function playerHref(playerId: string): string {
  const slug = getSlugForPlayerId(playerId);
  return slug ? `/players/${slug}` : `/player/${playerId}`;
}

interface SegmentedItem<T extends string | number> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

const VIEW_OPTIONS: SegmentedItem<ViewMode>[] = [
  { value: "players", label: "Players", icon: Trophy },
  { value: "pitchTypes", label: "Pitch Types", icon: Layers3 },
];

const HAND_OPTIONS: SegmentedItem<HandFilter>[] = [
  { value: "ALL", label: "All Hands" },
  { value: "R", label: "RHP" },
  { value: "L", label: "LHP" },
];

function metricLabel(): string {
  return "Pitching+";
}

function sampleLabel(view: ViewMode): string {
  return view === "players" ? "Min Tracked Pitches" : "Min Pitch Count";
}

function sampleOptions(view: ViewMode): number[] {
  if (view === "players") return [0, 10, 25, 50, 100];
  return [0, 5, 10, 20, 40];
}

function sampleValueForPlayer(row: PlusPlayerRow): number {
  return row.trackedPitchCount;
}

function sampleOptionLabel(value: number): string {
  return value === 0 ? "Any" : `${value}+`;
}

function SegmentedRail<T extends string | number>({
  label,
  items,
  value,
  onChange,
  tone,
  activeClassName,
  compact = false,
}: {
  label: string;
  items: SegmentedItem<T>[];
  value: T;
  onChange: (next: T) => void;
  tone: "amber" | "zinc";
  activeClassName: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        {label}
      </div>
      <div className={`inline-flex flex-wrap gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5 ${compact ? "" : "w-full"}`}>
        {items.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
          const active = value === optionValue;
          return (
            <Button
              key={String(optionValue)}
              type="button"
              size="sm"
              variant="ghost"
              neon
              tone={tone}
              onClick={() => onChange(optionValue)}
              className={`${leaderboardFilterButtonBaseClassName} inline-flex items-center justify-center gap-1.5 ${
                active
                  ? activeClassName
                  : leaderboardFilterButtonGhostInactiveClassName
              } ${compact ? "min-w-[4.75rem]" : "flex-1"}`}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              <span>{optionLabel}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-10 text-center">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        No Rows
      </div>
      <div className="mt-3 text-2xl font-black text-zinc-100">{title}</div>
      <div className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
        {detail}
      </div>
    </div>
  );
}

function PlayerTable({
  rows,
  transitionKey,
  getRowTransitionProps,
}: {
  rows: PlusPlayerRow[];
  transitionKey: number;
  getRowTransitionProps: (index: number) => RowTransitionProps;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-zinc-800/80 bg-zinc-950/65">
      <table className="min-w-full text-sm">
        <thead className="border-b border-zinc-800/80 bg-zinc-900/80">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Pitcher</th>
            <th className="px-4 py-3">Pitching+</th>
            <th className="px-4 py-3">Command+</th>
            <th className="px-4 py-3">Stuff+</th>
            <th className="px-4 py-3">Overlap</th>
            <th className="px-4 py-3">Tracked</th>
            <th className="px-4 py-3">Outings</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody key={`players-${transitionKey}`}>
          {rows.map((row, index) => {
            const rowTransition = getRowTransitionProps(index);
            return (
              <tr
                key={row.playerId}
                className={`${rowTransition.className} border-b border-zinc-900/80 transition-smooth hover:bg-zinc-900/35 last:border-b-0`}
                style={rowTransition.style}
              >
                <td className="px-4 py-3 font-semibold text-zinc-500">{index + 1}</td>
                <td className="px-4 py-3">
                  <Link href={playerHref(row.playerId)} className="inline-flex items-center gap-2 font-semibold text-zinc-100 hover:text-cyan-300 transition-smooth">
                    <span>{row.playerName}</span>
                    {handBadge(row.throws)}
                  </Link>
                </td>
                <td className="px-4 py-3">{metricBadge(row.pitchingPlus)}</td>
                <td className="px-4 py-3">{metricBadge(row.commandPlus)}</td>
                <td className="px-4 py-3">{metricBadge(row.stuffPlus)}</td>
                <td className="px-4 py-3 text-zinc-300">
                  <div className="font-medium">{row.overlapPitchTypeCount} types</div>
                  <div className="text-xs text-zinc-500">{row.overlapPitchCount} pitches</div>
                </td>
                <td className="px-4 py-3 text-zinc-300">{row.trackedPitchCount}</td>
                <td className="px-4 py-3 text-zinc-300">{row.outingCount}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${row.ready ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-400"}`}>
                    {reasonCopy(row.notReadyReason)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PitchTypeTable({
  rows,
  transitionKey,
  getRowTransitionProps,
}: {
  rows: PlusPitchTypeRow[];
  transitionKey: number;
  getRowTransitionProps: (index: number) => RowTransitionProps;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-zinc-800/80 bg-zinc-950/65">
      <table className="min-w-full text-sm">
        <thead className="border-b border-zinc-800/80 bg-zinc-900/80">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Pitcher</th>
            <th className="px-4 py-3">Pitch</th>
            <th className="px-4 py-3">Pitching+</th>
            <th className="px-4 py-3">Command+</th>
            <th className="px-4 py-3">Stuff+</th>
            <th className="px-4 py-3">Usage</th>
            <th className="px-4 py-3">Pitches</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody key={`pitch-types-${transitionKey}`}>
          {rows.map((row, index) => {
            const rowTransition = getRowTransitionProps(index);
            return (
              <tr
                key={`${row.playerId}-${row.commandPitchType}`}
                className={`${rowTransition.className} border-b border-zinc-900/80 transition-smooth hover:bg-zinc-900/35 last:border-b-0`}
                style={rowTransition.style}
              >
                <td className="px-4 py-3 font-semibold text-zinc-500">{index + 1}</td>
                <td className="px-4 py-3">
                  <Link href={playerHref(row.playerId)} className="inline-flex items-center gap-2 font-semibold text-zinc-100 hover:text-cyan-300 transition-smooth">
                    <span>{row.playerName}</span>
                    {handBadge(row.throws)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <PitchTypeChip
                    pitchType={row.commandPitchType}
                    label={row.pitchLabel}
                  />
                </td>
                <td className="px-4 py-3">{metricBadge(row.pitchingPlus)}</td>
                <td className="px-4 py-3">{metricBadge(row.commandPlus)}</td>
                <td className="px-4 py-3">{metricBadge(row.stuffPlus)}</td>
                <td className="px-4 py-3 text-zinc-300">{fmtPct(row.usageShare)}</td>
                <td className="px-4 py-3 text-zinc-300">{row.commandCount}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${row.includedInPitchingPlus ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-400"}`}>
                    {reasonCopy(row.reason)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PlusLeaderboardsPage() {
  const seasonFilter: PlusSeasonFilter = 2026;
  const {
    runWithTransition,
    contentTransitionClassName,
    getRowTransitionProps,
    transitionKey,
  } = useSmoothFilterTransition();
  const [view, setView] = useState<ViewMode>("players");
  const [handFilter, setHandFilter] = useState<HandFilter>("ALL");
  const [minSample, setMinSample] = useState(10);
  const [search, setSearch] = useState("");
  const [payload, setPayload] = useState<PlusLeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/plus/leaderboard", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`plus_${response.status}`);
        }
        return response.json() as Promise<PlusLeaderboardPayload>;
      })
      .then((next) => {
        if (!active) return;
        setPayload(next);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load plus leaderboard");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const deferredSearch = useDeferredValue(search);
  const q = deferredSearch.trim().toLowerCase();
  const sampleChoices = sampleOptions(view);
  const activeMinSample = sampleChoices.includes(minSample)
    ? minSample
    : sampleChoices[0];

  const filteredPlayers = useMemo(() => {
    const rows = payload?.players ?? [];
    return [...rows]
      .filter((row) => (handFilter === "ALL" ? true : row.throws === handFilter))
      .filter((row) => sampleValueForPlayer(row) >= activeMinSample)
      .filter((row) =>
        q.length === 0
          ? true
          : row.playerName.toLowerCase().includes(q) ||
            row.playerId.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const diff = compareMetric(a, b);
        if (diff !== 0) return diff;
        return b.trackedPitchCount - a.trackedPitchCount || a.playerName.localeCompare(b.playerName);
      });
  }, [payload, handFilter, activeMinSample, q]);

  const filteredPitchTypes = useMemo(() => {
    const rows = payload?.pitchTypes ?? [];
    return [...rows]
      .filter((row) => (handFilter === "ALL" ? true : row.throws === handFilter))
      .filter((row) => row.commandCount >= activeMinSample)
      .filter((row) =>
        q.length === 0
          ? true
          : row.playerName.toLowerCase().includes(q) ||
            row.playerId.toLowerCase().includes(q) ||
            row.pitchLabel.toLowerCase().includes(q) ||
            row.commandPitchType.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const diff = compareMetric(a, b);
        if (diff !== 0) return diff;
        return b.commandCount - a.commandCount || a.playerName.localeCompare(b.playerName);
      });
  }, [payload, handFilter, activeMinSample, q]);

  const activeCount = view === "players" ? filteredPlayers.length : filteredPitchTypes.length;

  const stuffBackedCount =
    view === "players"
      ? filteredPlayers.filter((row) => row.stuffPlus !== null).length
      : filteredPitchTypes.filter((row) => row.stuffPlus !== null).length;

  const leaderLabel =
    view === "players"
      ? filteredPlayers[0]?.playerName ?? "—"
      : filteredPitchTypes[0]
        ? `${filteredPitchTypes[0].playerName} · ${filteredPitchTypes[0].pitchLabel}`
        : "—";

  const leaderMetricValue =
    view === "players"
      ? metricValue(filteredPlayers[0] ?? { pitchingPlus: null })
      : metricValue(filteredPitchTypes[0] ?? { pitchingPlus: null });

  const emptyStateTitle =
    q.length > 0
      ? "No rows match that search."
      : "No rows match the current filters.";
  const emptyStateDetail =
    q.length > 0
      ? "Try a broader player, pitch, or date search. The search box checks names, player IDs, and pitch labels where they apply."
      : `Loosen the ${sampleLabel(view).toLowerCase()} or switch handedness back to all.`;
  const stuffReadout =
    stuffBackedCount > 0
      ? `${stuffBackedCount} visible ${
          stuffBackedCount === 1 ? "row already carries" : "rows already carry"
        } Stuff+.`
      : "No visible rows are carrying Stuff+ under the current filters.";

  return (
    <LeaderboardPageFrame maxWidth="max-w-7xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Leaderboards", href: "/leaderboards-hub" },
            { label: "Pitching+" },
          ]}
        />

        <section className="mt-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-amber-500/20 bg-zinc-950/80 shadow-2xl shadow-black/30">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(245,158,11,0.16),transparent_28%),radial-gradient(circle_at_86%_22%,rgba(56,189,248,0.12),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.88),rgba(3,7,18,0.96))]" />
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

            <div className="relative p-6 sm:p-8">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Pitching+ Leaderboard
                  </div>
                  <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-zinc-50 sm:text-[2.9rem] sm:leading-[1.02]">
                    <span className="text-amber-300">Pitching+</span> Leaderboard
                  </h1>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    <span className="inline-flex rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1">
                      2026 live season
                    </span>
                    <span className="inline-flex rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1">
                      {view === "pitchTypes" ? "Pitch mix view" : "Player view"}
                    </span>
                  </div>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                    {stuffReadout}
                  </p>
                </div>

                <div className="grid gap-2 content-start">
                  <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                      Top {metricLabel()}
                    </div>
                    <div className="mt-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold text-zinc-100">{leaderLabel}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {payload?.generatedAt
                            ? `Updated ${new Date(payload.generatedAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}`
                            : "Waiting on data"}
                        </div>
                      </div>
                      <span className="shrink-0">
                        {metricBadge(leaderMetricValue)}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                      Guide
                    </div>
                    <Link
                      href="/pitching-plus"
                      className="mt-2.5 inline-flex items-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3.5 text-sm font-semibold text-amber-300 transition-smooth hover:border-amber-400/40 hover:text-amber-200"
                    >
                      <BookOpen className="h-4 w-4" />
                      Full Methodology
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(17,24,39,0.7),rgba(9,9,11,0.92))] p-4">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <SegmentedRail
                      label="View"
                      items={VIEW_OPTIONS}
                      value={view}
                      onChange={(nextView) => runWithTransition(() => setView(nextView))}
                      tone="amber"
                      activeClassName={leaderboardFilterButtonAmberActiveClassName}
                    />
                    <div className="flex items-end xl:min-w-[12rem]">
                      <button
                        onClick={() =>
                          runWithTransition(() => {
                            setHandFilter("ALL");
                            setMinSample(sampleChoices[0]);
                            setSearch("");
                          })
                        }
                        className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[auto_minmax(14rem,16rem)_minmax(0,1fr)]">
                    <SegmentedRail
                      label="Handedness"
                      items={HAND_OPTIONS}
                      value={handFilter}
                      onChange={(nextHand) => runWithTransition(() => setHandFilter(nextHand))}
                      tone="zinc"
                      activeClassName={leaderboardFilterButtonZincActiveClassName}
                      compact
                    />

                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                        {sampleLabel(view)}
                      </div>
                      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                        <select
                          value={activeMinSample}
                          onChange={(event) =>
                            runWithTransition(() => setMinSample(Number(event.target.value)))
                          }
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none"
                        >
                          {sampleChoices.map((value) => (
                            <option key={value} value={value}>
                              {sampleOptionLabel(value)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                        Search
                      </div>
                      <label className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search pitcher, ID, or pitch"
                          className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div
            className={contentTransitionClassName}
          >
            {loading ? (
              <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-10 text-center text-zinc-500">
                Loading plus leaderboard…
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-10 text-center text-rose-200">
                {error}
              </div>
            ) : activeCount === 0 ? (
              <EmptyState title={emptyStateTitle} detail={emptyStateDetail} />
            ) : view === "players" ? (
              <PlayerTable
                rows={filteredPlayers}
                transitionKey={transitionKey}
                getRowTransitionProps={getRowTransitionProps}
              />
            ) : (
              <PitchTypeTable
                rows={filteredPitchTypes}
                transitionKey={transitionKey}
                getRowTransitionProps={getRowTransitionProps}
              />
            )}
          </div>
        </section>
    </LeaderboardPageFrame>
  );
}
