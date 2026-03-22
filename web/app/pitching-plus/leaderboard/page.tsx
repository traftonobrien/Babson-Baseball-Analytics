"use client";

import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Layers3,
  Search,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useSmoothFilterTransition } from "@/app/components/leaderboards/useSmoothFilterTransition";
import { HubActionCard, HubStatCard } from "@/app/components/hub/HubHeader";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { getSlugForPlayerId } from "@/lib/canonicalPlayers";
import { mutedBadgeClasses, readinessBadgeClasses } from "@/lib/badgeStyles";
import { handBadgeClasses } from "@/lib/handBadge";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import type {
  PlusLeaderboardPayload,
  PlusPitchTypeRow,
  PlusPlayerRow,
  PlusSeasonFilter,
} from "@/lib/plusLeaderboardTypes";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

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

function metricValue(row: { pitchingPlus: number | null }): number | null {
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
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${mutedBadgeClasses()}`}
      >
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
      <span
        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${mutedBadgeClasses()}`}
      >
        —
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${handBadgeClasses(throws)}`}
    >
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

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition-all ${
        active
          ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function SegmentedRail<T extends string | number>({
  label,
  items,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  items: SegmentedItem<T>[];
  value: T;
  onChange: (next: T) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </div>
      <div
        className={`inline-flex flex-wrap gap-1 rounded-full border border-slate-200 bg-slate-100 p-1 ${
          compact ? "" : "w-full"
        }`}
      >
        {items.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
          const active = value === optionValue;
          return (
            <ToggleButton key={String(optionValue)} active={active} onClick={() => onChange(optionValue)}>
              <span className="inline-flex items-center gap-1.5">
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                <span>{optionLabel}</span>
              </span>
            </ToggleButton>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        No rows
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{title}</div>
      <div className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function HeaderTooltip({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <div className="group relative inline-flex items-center gap-1.5">
      <span>{label}</span>
      <button
        type="button"
        aria-label={`${label} explanation`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-smooth hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-[11px] normal-case tracking-normal text-slate-600 shadow-xl group-hover:block group-focus-within:block">
        {tooltip}
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
    <div className="overflow-x-auto overflow-y-visible rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <th className="px-5 py-3.5">Rank</th>
            <th className="px-5 py-3.5">Pitcher</th>
            <th className="px-5 py-3.5 text-center">Pitching+</th>
            <th className="px-5 py-3.5 text-center">
              <HeaderTooltip
                label="Command+"
                tooltip="Command+ measures how precisely a pitcher locates the ball relative to the intended target. Better miss quality and more consistent execution drive the grade higher."
              />
            </th>
            <th className="px-5 py-3.5 text-center">
              <HeaderTooltip
                label="W Stuff +"
                tooltip="Weighted Stuff+ is the player-level Stuff+ blend inside Pitching+. Each qualifying pitch type contributes by usage, so the offerings a pitcher throws most heavily shape this number the most."
              />
            </th>
            <th className="px-5 py-3.5">Overlap</th>
            <th className="px-5 py-3.5">Tracked</th>
            <th className="px-5 py-3.5">Outings</th>
            <th className="px-5 py-3.5">Status</th>
          </tr>
        </thead>
        <tbody key={`players-${transitionKey}`}>
          {rows.map((row, index) => {
            const rowTransition = getRowTransitionProps(index);
            return (
              <tr
                key={row.playerId}
                className={`${rowTransition.className} border-b border-slate-100 transition-smooth hover:bg-slate-50/80 last:border-b-0`}
                style={rowTransition.style}
              >
                <td className="px-5 py-4 font-semibold text-slate-500">{index + 1}</td>
                <td className="px-5 py-4">
                  <Link
                    href={playerHref(row.playerId)}
                    className="inline-flex items-center gap-2 font-semibold text-slate-900 transition-smooth hover:text-indigo-600"
                  >
                    <span>{row.playerName}</span>
                    {handBadge(row.throws)}
                  </Link>
                </td>
                <td className="px-5 py-4 text-center">{metricBadge(row.pitchingPlus)}</td>
                <td className="px-5 py-4 text-center">{metricBadge(row.commandPlus)}</td>
                <td className="px-5 py-4 text-center">{metricBadge(row.stuffPlus)}</td>
                <td className="px-5 py-4 text-slate-600">
                  <div className="font-medium text-slate-900">
                    {row.overlapPitchTypeCount} types
                  </div>
                  <div className="text-xs text-slate-500">{row.overlapPitchCount} pitches</div>
                </td>
                <td className="px-5 py-4 text-slate-600">{row.trackedPitchCount}</td>
                <td className="px-5 py-4 text-slate-600">{row.outingCount}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${readinessBadgeClasses(row.ready)}`}
                  >
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
    <div className="overflow-x-auto rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <th className="px-5 py-3.5">Rank</th>
            <th className="px-5 py-3.5">Pitcher</th>
            <th className="px-5 py-3.5">Pitch</th>
            <th className="px-5 py-3.5 text-center">Pitching+</th>
            <th className="px-5 py-3.5 text-center">
              <HeaderTooltip
                label="Command+"
                tooltip="Command+ measures how precisely that pitch type is located relative to the target. Stronger command grades come from tighter misses and more repeatable execution."
              />
            </th>
            <th className="px-5 py-3.5 text-center">Stuff+</th>
            <th className="px-5 py-3.5">Usage</th>
            <th className="px-5 py-3.5">Pitches</th>
            <th className="px-5 py-3.5">Status</th>
          </tr>
        </thead>
        <tbody key={`pitch-types-${transitionKey}`}>
          {rows.map((row, index) => {
            const rowTransition = getRowTransitionProps(index);
            return (
              <tr
                key={`${row.playerId}-${row.commandPitchType}`}
                className={`${rowTransition.className} border-b border-slate-100 transition-smooth hover:bg-slate-50/80 last:border-b-0`}
                style={rowTransition.style}
              >
                <td className="px-5 py-4 font-semibold text-slate-500">{index + 1}</td>
                <td className="px-5 py-4">
                  <Link
                    href={playerHref(row.playerId)}
                    className="inline-flex items-center gap-2 font-semibold text-slate-900 transition-smooth hover:text-indigo-600"
                  >
                    <span>{row.playerName}</span>
                    {handBadge(row.throws)}
                  </Link>
                </td>
                <td className="px-5 py-4">
                  <PitchTypeChip pitchType={row.commandPitchType} label={row.pitchLabel} />
                </td>
                <td className="px-5 py-4 text-center">{metricBadge(row.pitchingPlus)}</td>
                <td className="px-5 py-4 text-center">{metricBadge(row.commandPlus)}</td>
                <td className="px-5 py-4 text-center">{metricBadge(row.stuffPlus)}</td>
                <td className="px-5 py-4 text-slate-600">{fmtPct(row.usageShare)}</td>
                <td className="px-5 py-4 text-slate-600">{row.commandCount}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${readinessBadgeClasses(row.includedInPitchingPlus)}`}
                  >
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
        return (
          b.trackedPitchCount - a.trackedPitchCount ||
          a.playerName.localeCompare(b.playerName)
        );
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

  const headerStats = useMemo(() => {
    if (!payload) {
      return null;
    }
    return {
      playerRows: payload.players.length,
      pitchTypeRows: payload.pitchTypes.length,
      readyPitchers: payload.players.filter((p) => p.ready).length,
    };
  }, [payload]);

  const emptyStateTitle =
    q.length > 0
      ? "No rows match that search."
      : "No rows match the current filters.";
  const emptyStateDetail =
    q.length > 0
      ? "Try a broader player, pitch, or date search. The search box checks names, player IDs, and pitch labels where they apply."
      : `Loosen the ${sampleLabel(view).toLowerCase()} or switch handedness back to all.`;
  return (
    <div className={`${plusJakartaSans.className} min-h-full bg-[#F8FAFC] text-[#0F172A]`}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6366F1]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Pitching+
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-[#0F172A] sm:text-[2.85rem] sm:leading-[1.02]">
                  Pitching+ Leaderboard
                </h1>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
                <HubActionCard
                  href="/pitching-plus"
                  icon={Sparkles}
                  sectionTitle="Methodology"
                  buttonLabel="Full methodology"
                />
                <HubActionCard
                  href="/dictionary"
                  icon={BookOpen}
                  sectionTitle="Dictionary"
                  buttonLabel="Metrics glossary"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <HubStatCard
                label="Player rows"
                value={headerStats ? String(headerStats.playerRows) : "—"}
                detail={`Pitchers in the ${seasonFilter} season snapshot.`}
                tone="indigo"
              />
              <HubStatCard
                label="Pitch-type rows"
                value={headerStats ? String(headerStats.pitchTypeRows) : "—"}
                detail="Pitch-type × pitcher combinations on the board."
                tone="emerald"
              />
              <HubStatCard
                label="Pitching+ ready"
                value={headerStats ? String(headerStats.readyPitchers) : "—"}
                detail="Pitchers meeting overlap and live command requirements."
                tone="sky"
              />
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SegmentedRail
              label="View"
              items={VIEW_OPTIONS}
              value={view}
              onChange={(nextView) => runWithTransition(() => setView(nextView))}
            />
            <button
              type="button"
              onClick={() =>
                runWithTransition(() => {
                  setHandFilter("ALL");
                  setMinSample(sampleChoices[0]);
                  setSearch("");
                })
              }
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm transition-smooth hover:border-slate-300 hover:text-slate-900"
            >
              Reset filters
            </button>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[auto_minmax(14rem,16rem)_minmax(0,1fr)]">
            <SegmentedRail
              label="Handedness"
              items={HAND_OPTIONS}
              value={handFilter}
              onChange={(nextHand) => runWithTransition(() => setHandFilter(nextHand))}
              compact
            />

            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {sampleLabel(view)}
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-100 p-1">
                <select
                  value={activeMinSample}
                  onChange={(event) =>
                    runWithTransition(() => setMinSample(Number(event.target.value)))
                  }
                  className="h-10 w-full rounded-full border-0 bg-white px-4 text-sm font-semibold text-slate-900 outline-none ring-1 ring-transparent transition-all focus:ring-2 focus:ring-indigo-500/30"
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
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Search
              </div>
              <label className="flex h-11 items-center gap-3 rounded-full border border-slate-200 bg-slate-100 px-4 shadow-sm transition-all focus-within:border-indigo-300 focus-within:bg-white">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search pitcher, ID, or pitch"
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </label>
            </div>
          </div>
        </section>

        <section>
          <div className={contentTransitionClassName}>
            {loading ? (
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
                Loading Pitching+ Leaderboard…
              </div>
            ) : error ? (
              <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-10 text-center text-rose-700 shadow-sm">
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
      </div>
    </div>
  );
}
