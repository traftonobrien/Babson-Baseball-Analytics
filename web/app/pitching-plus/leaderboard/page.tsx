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
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useSmoothFilterTransition } from "@/app/components/leaderboards/useSmoothFilterTransition";
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

function ShellBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm">
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  trend: "up" | "down";
}) {
  const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;

  return (
    <div className="flex min-h-[132px] flex-col justify-between rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
            {label}
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </div>
        </div>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${
            trend === "up"
              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
              : "border-rose-200 bg-rose-50 text-rose-600"
          }`}
        >
          <TrendIcon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 max-w-[20rem] text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
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

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
      <span className="text-slate-400">{label}:</span> {value}
    </div>
  );
}

function InfoPanel({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action: ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
      <div className="mt-4">{action}</div>
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

  const leaderMetricText = leaderMetricValue === null ? "—" : leaderMetricValue.toFixed(0);
  const topTrend = leaderMetricValue === null ? "down" : leaderMetricValue >= 100 ? "up" : "down";
  const updatedAt = payload?.generatedAt
    ? new Date(payload.generatedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className={`${plusJakartaSans.className} min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#f6f7fb_40%,#eef2ff_100%)] text-slate-900`}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <ShellBadge>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-indigo-500" />
                  Pitching+
                </ShellBadge>
                <ShellBadge>{seasonFilter} season</ShellBadge>
                <ShellBadge>{view === "pitchTypes" ? "Pitch type view" : "Player view"}</ShellBadge>
              </div>

              <div className="mt-4 max-w-4xl">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-[2.75rem] sm:leading-[1.02]">
                  Pitching+ leaderboard
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                  {stuffReadout}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <StatPill label="Visible rows" value={`${activeCount}`} />
                <StatPill label="Stuff+ rows" value={`${stuffBackedCount}`} />
                <StatPill label="Scope" value={view === "pitchTypes" ? "Pitch Types" : "Players"} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[30rem]">
              <MetricCard
                label={`Top ${metricLabel()}`}
                value={leaderMetricText}
                detail={
                  leaderLabel === "—"
                    ? "Waiting on leaderboard data."
                    : `${leaderLabel}${updatedAt ? ` · Updated ${updatedAt}` : ""}`
                }
                trend={topTrend}
              />
              <MetricCard
                label="Visible rows"
                value={`${activeCount}`}
                detail={`${stuffBackedCount} of those rows currently carry Stuff+.`}
                trend="up"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <InfoPanel
              title="Guide"
              detail="Open the Pitching+ methodology for the grading logic and the definitions behind each leaderboard column."
              action={
                <Link
                  href="/pitching-plus"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-smooth hover:bg-slate-800"
                >
                  <BookOpen className="h-4 w-4" />
                  Full methodology
                  <ChevronRight className="h-4 w-4" />
                </Link>
              }
            />
            <InfoPanel
              title="Status"
              detail={updatedAt ? `Last refresh: ${updatedAt}.` : "Waiting on leaderboard data."}
              action={
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Live dataset
                </div>
              }
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
                Loading Pitching+ leaderboard…
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
