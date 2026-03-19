"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, ClipboardList } from "lucide-react";
import {
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardStatBlock,
} from "@/app/components/leaderboards/LeaderboardChrome";
import { PitcherZoneHeatmap } from "./PitcherZoneHeatmap";
import type { ChartingPlayerProfile, PitcherRawPitchRecord } from "@/lib/charting/playerProfile";

interface SeasonStat {
  label: string;
  value: string;
}

function formatDateLabel(raw: string): string {
  const [year, month, day] = raw.split("-");
  if (!year || !month || !day) {
    return raw;
  }

  return `${Number(month)}/${Number(day)}/${year.slice(2)}`;
}

function formatPct(value: number | null): string {
  return value !== null ? `${value.toFixed(1)}%` : "--";
}

function formatRate(value: number | null): string {
  return value !== null ? value.toFixed(3).replace(/^0\./, ".") : "--";
}

function formatNumber(value: number | null): string {
  return value !== null ? String(value) : "--";
}

// ---------------------------------------------------------------------------
// Pitch type accent palette
// ---------------------------------------------------------------------------

type PitchAccent = {
  text: string;
  bar: string;
  border: string;
  bg: string;
};

function pitchAccent(pitchType: string): PitchAccent {
  switch (pitchType) {
    case "Fastball":
      return {
        text: "text-emerald-300",
        bar: "bg-emerald-500",
        border: "border-emerald-500/20",
        bg: "bg-emerald-500/10",
      };
    case "Slider":
      return {
        text: "text-sky-300",
        bar: "bg-sky-500",
        border: "border-sky-500/20",
        bg: "bg-sky-500/10",
      };
    case "Curveball":
      return {
        text: "text-violet-300",
        bar: "bg-violet-500",
        border: "border-violet-500/20",
        bg: "bg-violet-500/10",
      };
    case "Changeup":
      return {
        text: "text-amber-300",
        bar: "bg-amber-500",
        border: "border-amber-500/20",
        bg: "bg-amber-500/10",
      };
    case "Split/Cut":
      return {
        text: "text-orange-300",
        bar: "bg-orange-500",
        border: "border-orange-500/20",
        bg: "bg-orange-500/10",
      };
    default:
      return {
        text: "text-zinc-300",
        bar: "bg-zinc-500",
        border: "border-zinc-500/20",
        bg: "bg-zinc-500/10",
      };
  }
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type ResultFilter = "all" | "called_strike" | "ball" | "swinging_strike" | "foul" | "in_play";

// ---------------------------------------------------------------------------
// Helpers for per-pitch-type stats from raw records
// ---------------------------------------------------------------------------

function buildLocationCounts(
  pitches: PitcherRawPitchRecord[],
  pitchType?: string,
  resultFilter: ResultFilter = "all"
): Partial<Record<number, number>> {
  const counts: Partial<Record<number, number>> = {};
  for (const p of pitches) {
    if (pitchType && p.pitchType !== pitchType) continue;
    if (resultFilter !== "all" && p.pitchResult !== resultFilter) continue;
    if (p.locationCell === null) continue;
    counts[p.locationCell] = (counts[p.locationCell] ?? 0) + 1;
  }
  return counts;
}

type PitchTypeStats = {
  pitchType: string;
  count: number;
  pct: number;
  strikePct: number | null;
  whiffPct: number | null;
  zonePct: number | null;
  locationCounts: Partial<Record<number, number>>;
};

const STRIKE_RESULTS = new Set([
  "called_strike",
  "swinging_strike",
  "foul",
  "bunt_foul",
  "in_play",
]);
const SWING_RESULTS = new Set(["swinging_strike", "foul", "bunt_foul", "in_play"]);

function computePitchTypeStats(
  pitches: PitcherRawPitchRecord[],
  pitchType: string,
  resultFilter: ResultFilter = "all"
): PitchTypeStats {
  const subset = pitches.filter((p) => p.pitchType === pitchType);
  const total = pitches.length;
  const count = subset.length;
  const pct = total > 0 ? (count / total) * 100 : 0;

  const strikes = subset.filter((p) => STRIKE_RESULTS.has(p.pitchResult)).length;
  const swings = subset.filter((p) => SWING_RESULTS.has(p.pitchResult)).length;
  const whiffs = subset.filter((p) => p.pitchResult === "swinging_strike").length;
  const located = subset.filter((p) => p.locationCell !== null);
  const inZone = located.filter(
    (p) => p.locationCell !== null && p.locationCell >= 1 && p.locationCell <= 9
  ).length;

  return {
    pitchType,
    count,
    pct,
    strikePct: count > 0 ? (strikes / count) * 100 : null,
    whiffPct: swings > 0 ? (whiffs / swings) * 100 : null,
    zonePct: located.length > 0 ? (inZone / located.length) * 100 : null,
    locationCounts: buildLocationCounts(subset, undefined, resultFilter),
  };
}

// ---------------------------------------------------------------------------
// Pitcher-side inline synthesis
// ---------------------------------------------------------------------------

const MIN_PITCH_SAMPLE = 10;

function derivePitchingSynthesis(stats: PitchTypeStats[]): string[] {
  if (stats.length === 0) return [];
  const takeaways: string[] = [];
  const sorted = [...stats].sort((a, b) => b.pct - a.pct);
  const top = sorted[0];
  const second = sorted[1];

  // Usage takeaway (at most 1)
  const spreadCount = stats.filter((s) => s.pct >= 15).length;
  if (top.pct >= 50) {
    takeaways.push(`Leans heavily on the ${top.pitchType} (${top.pct.toFixed(0)}% usage).`);
  } else if (second && top.pct + second.pct >= 65) {
    takeaways.push(`Works mostly off the ${top.pitchType} and ${second.pitchType} (${(top.pct + second.pct).toFixed(0)}% combined).`);
  } else if (spreadCount >= 3) {
    takeaways.push(`Shows a spread mix across ${spreadCount} pitch types.`);
  }

  // Bat-missing takeaway (at most 1)
  const withWhiff = stats.filter(
    (s) => s.count >= MIN_PITCH_SAMPLE && s.whiffPct !== null && s.whiffPct >= 20
  );
  if (withWhiff.length > 0) {
    const best = withWhiff.reduce((a, b) => (b.whiffPct! > a.whiffPct! ? b : a));
    takeaways.push(`${best.pitchType} is the best bat-missing pitch (${best.whiffPct!.toFixed(0)}% whiff rate).`);
  }

  // Strike/command takeaway (at most 1)
  const withStrike = stats.filter(
    (s) => s.count >= MIN_PITCH_SAMPLE && s.strikePct !== null && s.strikePct >= 60
  );
  if (withStrike.length > 0) {
    const best = withStrike.reduce((a, b) => (b.strikePct! > a.strikePct! ? b : a));
    takeaways.push(`${best.pitchType} is the most reliable strike-getter (${best.strikePct!.toFixed(0)}% strike rate).`);
  }

  return takeaways;
}

function deriveHittingSynthesis(stats: {
  totalPAs: number | null;
  contactPct: number | null;
  chasePct: number | null;
  kPct: number | null;
  bbPct: number | null;
} | null): string[] {
  if (!stats) return [];
  const { totalPAs, contactPct, chasePct, kPct, bbPct } = stats;
  if (!totalPAs || totalPAs < 15) return [];
  const takeaways: string[] = [];

  // Zone discipline (at most 1)
  if (chasePct !== null) {
    if (chasePct >= 35) {
      takeaways.push(`Chasing pitches out of the zone often (${chasePct.toFixed(0)}% chase rate).`);
    } else if (chasePct < 20) {
      takeaways.push(`Disciplined approach — rarely chases outside the zone (${chasePct.toFixed(0)}% chase rate).`);
    }
  }

  // Contact reliability (at most 1)
  if (contactPct !== null) {
    if (contactPct >= 80) {
      takeaways.push(`Makes contact consistently (${contactPct.toFixed(0)}% contact rate).`);
    } else if (contactPct < 65) {
      takeaways.push(`Trouble making contact when swinging (${contactPct.toFixed(0)}% contact rate).`);
    }
  }

  // Strikeout pressure (at most 1)
  if (kPct !== null && kPct >= 28) {
    takeaways.push(`High strikeout rate — ${kPct.toFixed(0)}% K% in this sample.`);
  }

  // Patience (only if under 3)
  if (takeaways.length < 3 && bbPct !== null && bbPct >= 12) {
    takeaways.push(`Draws walks at a solid rate (${bbPct.toFixed(0)}% BB%).`);
  }

  return takeaways.slice(0, 3);
}

const PITCH_TYPE_ORDER = [
  "Fastball",
  "Slider",
  "Curveball",
  "Changeup",
  "Split/Cut",
  "Other",
];

function buildAllPitchTypeStats(pitches: PitcherRawPitchRecord[], resultFilter: ResultFilter = "all"): PitchTypeStats[] {
  const seen = new Set<string>();
  for (const p of pitches) seen.add(p.pitchType);

  return [...seen]
    .sort((a, b) => {
      const ai = PITCH_TYPE_ORDER.indexOf(a);
      const bi = PITCH_TYPE_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .map((pt) => computePitchTypeStats(pitches, pt, resultFilter));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SessionList({
  title,
  sessions,
}: {
  title: string;
  sessions: Array<{ gameId: string; gameDate: string; opponent: string | null; label: string }>;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
            {title}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Recent charted Charting sessions for this player.
          </p>
        </div>
        <LeaderboardPill tone="emerald">
          {sessions.length} Session{sessions.length === 1 ? "" : "s"}
        </LeaderboardPill>
      </div>

      <LeaderboardPanel className="overflow-hidden p-2 sm:p-3">
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
            No Charting sessions yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={`${session.gameId}-${title}`}>
                <Link
                  href={`/charting/games/${session.gameId}`}
                  className="group flex items-center justify-between rounded-2xl border border-zinc-900 bg-zinc-950/50 px-4 py-4 transition-smooth hover:border-emerald-500/20 hover:bg-zinc-900/60"
                >
                  <div>
                    <div className="text-sm font-bold text-zinc-200 transition-smooth group-hover:text-white">
                      {formatDateLabel(session.gameDate)}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {session.opponent || "Charting"}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-600 opacity-70 transition-smooth group-hover:text-emerald-300 group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </LeaderboardPanel>
    </section>
  );
}

function PitchMixBar({ stats }: { stats: PitchTypeStats[] }) {
  if (stats.length === 0) return null;

  return (
    <div className="space-y-3">
      {stats.map((item) => {
        const accent = pitchAccent(item.pitchType);
        return (
          <div key={item.pitchType} className="flex items-center gap-3">
            <div className={`w-20 shrink-0 text-xs font-semibold ${accent.text}`}>
              {item.pitchType}
            </div>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800/60">
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${accent.bar} opacity-80`}
                style={{ width: `${Math.min(100, item.pct)}%` }}
              />
            </div>
            <div className="w-10 shrink-0 text-right text-xs font-bold text-zinc-300">
              {item.pct.toFixed(0)}%
            </div>
            <div className="w-10 shrink-0 text-right text-[11px] text-zinc-500">
              ({item.count})
            </div>
          </div>
        );
      })}
    </div>
  );
}

const RESULT_FILTER_OPTIONS: { label: string; value: ResultFilter }[] = [
  { label: "All", value: "all" },
  { label: "Called Strikes", value: "called_strike" },
  { label: "Balls", value: "ball" },
  { label: "Whiffs", value: "swinging_strike" },
  { label: "Fouls", value: "foul" },
  { label: "In Play", value: "in_play" },
];

function PitchZoneMaps({
  stats,
  resultFilter,
  onResultFilterChange,
}: {
  stats: PitchTypeStats[];
  resultFilter: ResultFilter;
  onResultFilterChange: (f: ResultFilter) => void;
}) {
  const eligible = stats.filter((s) => s.count >= 5);
  if (eligible.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
          Zone Maps by Pitch Type
        </h3>
        {/* Result filter buttons */}
        <div className="flex flex-wrap gap-1.5">
          {RESULT_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onResultFilterChange(opt.value)}
              className={
                resultFilter === opt.value
                  ? "rounded-xl px-3 py-1.5 text-xs font-semibold border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "rounded-xl px-3 py-1.5 text-xs font-semibold border border-transparent text-zinc-400 hover:text-zinc-100"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {eligible.map((item) => {
          const accent = pitchAccent(item.pitchType);
          return (
            <div
              key={item.pitchType}
              className={`rounded-[1.7rem] border ${accent.border} bg-zinc-950/80 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]`}
            >
              {/* Header */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <span
                    className={`text-xs font-black uppercase tracking-[0.2em] ${accent.text}`}
                  >
                    {item.pitchType}
                  </span>
                  <span className="ml-2 text-[11px] text-zinc-500">
                    {item.count} pitch{item.count === 1 ? "" : "es"}
                  </span>
                </div>
              </div>

              {/* Heatmap */}
              <PitcherZoneHeatmap counts={item.locationCounts} />

              {/* Per-type outcome summary */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-2 py-2 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Strike%
                  </div>
                  <div className={`mt-0.5 text-sm font-bold ${accent.text}`}>
                    {item.strikePct !== null ? `${item.strikePct.toFixed(1)}%` : "--"}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-2 py-2 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Whiff%
                  </div>
                  <div className={`mt-0.5 text-sm font-bold ${accent.text}`}>
                    {item.whiffPct !== null ? `${item.whiffPct.toFixed(1)}%` : "--"}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-2 py-2 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Zone%
                  </div>
                  <div className={`mt-0.5 text-sm font-bold ${accent.text}`}>
                    {item.zonePct !== null ? `${item.zonePct.toFixed(1)}%` : "--"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LiveAbProfilePanel({
  profile,
  seasonStats,
}: {
  profile: ChartingPlayerProfile;
  seasonStats?: SeasonStat[];
}) {
  const pitcher = profile.pitcher;
  const hitter = profile.hitter;

  // Session type toggle: "game" shows game sessions; "live" shows live_ab sessions
  const [sessionFilter, setSessionFilter] = useState<"game" | "live">("game");
  // Result filter for zone maps
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

  if (!pitcher && !hitter) {
    return (
      <LeaderboardPanel className="p-5 text-sm text-zinc-500">
        No charting data has been recorded for this player yet.
      </LeaderboardPanel>
    );
  }

  // Filter pitch records by session type
  const filteredRecords = pitcher
    ? pitcher.pitchRecords.filter(r =>
        sessionFilter === "game" ? r.sessionType === "game" : r.sessionType === "live_ab"
      )
    : [];

  const pitchTypeStats =
    filteredRecords.length > 0
      ? buildAllPitchTypeStats(filteredRecords, resultFilter)
      : [];

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <Link href="/charting/leaderboard">
          <div className="group rounded-[1.7rem] border border-emerald-500/25 bg-zinc-950/72 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.24)] transition-smooth hover:-translate-y-0.5 hover:border-emerald-400/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Charting Leaderboard</div>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                    Open the full charting leaderboard and cross-session rankings.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-emerald-300 opacity-70 transition-smooth group-hover:opacity-100" />
            </div>
          </div>
        </Link>
      </section>

      {pitcher ? (
        <section className="space-y-6">
          {/* Section header with session type toggle */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                Pitching Charting
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Charted workload and pitch-quality context from Charting sessions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Session type toggle */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSessionFilter("game")}
                  className={
                    sessionFilter === "game"
                      ? "rounded-xl px-3 py-1.5 text-xs font-semibold border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "rounded-xl px-3 py-1.5 text-xs font-semibold border border-transparent text-zinc-400 hover:text-zinc-100"
                  }
                >
                  Game
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilter("live")}
                  className={
                    sessionFilter === "live"
                      ? "rounded-xl px-3 py-1.5 text-xs font-semibold border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "rounded-xl px-3 py-1.5 text-xs font-semibold border border-transparent text-zinc-400 hover:text-zinc-100"
                  }
                >
                  Live
                </button>
              </div>
              <LeaderboardPill tone="emerald">
                {pitcher.stats?.sessions ?? pitcher.sessions.length} Session
                {(pitcher.stats?.sessions ?? pitcher.sessions.length) === 1 ? "" : "s"}
              </LeaderboardPill>
            </div>
          </div>

          {/* 8 stat blocks — different data depending on session tab */}
          {sessionFilter === "game" && seasonStats && seasonStats.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                {seasonStats.slice(0, 4).map((stat) => (
                  <LeaderboardStatBlock
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    detail="2026 season"
                    emphasisClassName="text-zinc-100"
                  />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {seasonStats.slice(4, 8).map((stat) => (
                  <LeaderboardStatBlock
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    detail="2026 season"
                    emphasisClassName="text-emerald-300"
                  />
                ))}
              </div>
            </>
          ) : sessionFilter === "game" ? (
            <div className="grid gap-3 sm:grid-cols-4">
              <LeaderboardStatBlock
                label="Sessions"
                value={formatNumber(pitcher.stats?.sessions ?? pitcher.sessions.length)}
                detail="charted game sessions"
                emphasisClassName="text-zinc-100"
              />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <LeaderboardStatBlock
                  label="Sessions"
                  value={formatNumber(pitcher.stats?.sessions ?? pitcher.sessions.length)}
                  detail="charted sessions"
                  emphasisClassName="text-zinc-100"
                />
                <LeaderboardStatBlock
                  label="Pitches"
                  value={formatNumber(pitcher.stats?.totalPitches ?? null)}
                  detail="total charted pitches"
                  emphasisClassName="text-zinc-100"
                />
                <LeaderboardStatBlock
                  label="TBF"
                  value={formatNumber(pitcher.stats?.totalPAs ?? null)}
                  detail="total batters faced"
                  emphasisClassName="text-zinc-100"
                />
                <LeaderboardStatBlock
                  label="Strike%"
                  value={formatPct(pitcher.stats?.strikePct ?? null)}
                  detail="all charted pitches"
                  emphasisClassName="text-emerald-300"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <LeaderboardStatBlock
                  label="Zone%"
                  value={formatPct(pitcher.stats?.zonePct ?? null)}
                  detail="located pitches in zone"
                  emphasisClassName="text-zinc-100"
                />
                <LeaderboardStatBlock
                  label="Whiff%"
                  value={formatPct(pitcher.stats?.whiffPct ?? null)}
                  detail="swinging strikes per swing"
                  emphasisClassName="text-zinc-100"
                />
                <LeaderboardStatBlock
                  label="K%"
                  value={formatPct(pitcher.stats?.kPct ?? null)}
                  detail="completed plate appearances"
                  emphasisClassName="text-zinc-100"
                />
                <LeaderboardStatBlock
                  label="BB%"
                  value={formatPct(pitcher.stats?.bbPct ?? null)}
                  detail="completed plate appearances"
                  emphasisClassName="text-zinc-100"
                />
              </div>
            </>
          )}

          {/* Pitch mix section */}
          {pitchTypeStats.length > 0 ? (
            <LeaderboardPanel className="p-5">
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                Pitch Mix
              </h3>
              <PitchMixBar stats={pitchTypeStats} />
            </LeaderboardPanel>
          ) : null}

          {/* Inline pitcher synthesis takeaways */}
          {(() => {
            const takeaways = derivePitchingSynthesis(pitchTypeStats);
            if (takeaways.length === 0) return null;
            return (
              <div className="rounded-[1.7rem] border border-zinc-800/50 bg-zinc-950/40 px-5 py-4">
                <ul className="space-y-1.5">
                  {takeaways.map((t) => (
                    <li key={t} className="text-sm leading-relaxed text-zinc-400">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* Zone maps per pitch type */}
          {pitchTypeStats.filter((s) => s.count >= 5).length > 0 ? (
            <PitchZoneMaps
              stats={pitchTypeStats}
              resultFilter={resultFilter}
              onResultFilterChange={setResultFilter}
            />
          ) : null}

          {/* Sessions list */}
          <SessionList title="Pitching Sessions" sessions={pitcher.sessions} />
        </section>
      ) : null}

      {hitter ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                Hitting Charting
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Charted approach and production from Charting plate appearances.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LeaderboardPill tone="emerald">
                {hitter.stats?.sessions ?? hitter.sessions.length} Session
                {(hitter.stats?.sessions ?? hitter.sessions.length) === 1 ? "" : "s"}
              </LeaderboardPill>
              {hitter.matchedHitterNames.length > 1 ? (
                <LeaderboardPill tone="neutral">
                  {hitter.matchedHitterNames.length} charted names merged
                </LeaderboardPill>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <LeaderboardStatBlock
              label="PAs"
              value={formatNumber(hitter.stats?.totalPAs ?? null)}
              detail="charted plate appearances"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="AVG"
              value={formatRate(hitter.stats?.avg ?? null)}
              detail="charted outcomes only"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="OPS"
              value={formatRate(hitter.stats?.ops ?? null)}
              detail="OBP + SLG"
              emphasisClassName="text-emerald-300"
            />
            <LeaderboardStatBlock
              label="Contact%"
              value={formatPct(hitter.stats?.contactPct ?? null)}
              detail="any contact per swing"
              emphasisClassName="text-zinc-100"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <LeaderboardStatBlock
              label="Chase%"
              value={formatPct(hitter.stats?.chasePct ?? null)}
              detail="swings outside zone"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="Z-Swing%"
              value={formatPct(hitter.stats?.zoneSwingPct ?? null)}
              detail="swings in zone"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="K%"
              value={formatPct(hitter.stats?.kPct ?? null)}
              detail="completed plate appearances"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="BB%"
              value={formatPct(hitter.stats?.bbPct ?? null)}
              detail="completed plate appearances"
              emphasisClassName="text-zinc-100"
            />
          </div>

          {/* Inline hitter synthesis takeaways */}
          {(() => {
            const takeaways = deriveHittingSynthesis(hitter.stats);
            if (takeaways.length === 0) return null;
            return (
              <div className="rounded-[1.7rem] border border-zinc-800/50 bg-zinc-950/40 px-5 py-4">
                <ul className="space-y-1.5">
                  {takeaways.map((t) => (
                    <li key={t} className="text-sm leading-relaxed text-zinc-400">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          <SessionList title="Hitting Sessions" sessions={hitter.sessions} />
        </section>
      ) : null}

      {profile.availableRoles.length > 1 ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <BarChart3 className="h-4 w-4" />
          This player has both pitcher and hitter Charting data in the charting system.
        </div>
      ) : null}
    </div>
  );
}
