"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import {
  ChevronDown,
  ChevronRight,
  LineChart,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import LogoutButton from "./components/LogoutButton";
import { TEAM_NAME } from "@/lib/teamConfig";

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });
const manrope = Manrope({ subsets: ["latin"] });

type PitcherRow = {
  playerId: string;
  playerName: string;
  slug?: string;
  ip: number;
  r: number;
  er: number;
  so: number;
  kMinusBbPct: number;
};

type HitterRow = {
  playerId: string;
  playerName: string;
  slug?: string;
  pa: number;
  ab: number;
  h: number;
  bb: number;
  hbp: number;
  sf: number;
  tb: number;
  r: number;
  ops: number;
};

type TeamStatsPitchingResponse = {
  year?: string;
  pitchers?: PitcherRow[];
};

type TeamStatsBattingResponse = {
  year?: string;
  hitters?: HitterRow[];
};

type ChartingGame = {
  id: string;
  opponent: string | null;
  gameDate: string;
  status: "active" | "draft" | "final" | string;
  sessionType: "game" | "live_ab" | null;
  babsonVenueSide: "home" | "away" | null;
  updatedAt?: string;
};

type ChartingGamesResponse = {
  games?: ChartingGame[];
};

type MetricCardProps = {
  title: string;
  value: string;
  trend: string;
  trendDirection: "up" | "down";
  positive: boolean;
  series: number[];
  loading?: boolean;
};

type PerformerCard = {
  key: string;
  name: string;
  href: string | null;
  statLabel: string;
  accent: "emerald" | "sky";
};

function formatSignedValue(value: number, digits: number): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

function formatRate(value: number): string {
  return value > 0 ? value.toFixed(3).replace(/^0/, "") : ".000";
}

function formatDateLabel(value: string | undefined): string {
  if (!value) return "Unknown date";

  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

function formatUpdatedLabel(value: string | undefined): string {
  if (!value) return "Awaiting updates";

  try {
    return `Updated ${format(parseISO(value), "MMM d")}`;
  } catch {
    return "Awaiting updates";
  }
}

function getInitials(value: string): string {
  const parts = value
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
}

function statusPillClasses(status: string): string {
  if (status === "final") {
    return "bg-[#E0F2FE] text-[#0EA5E9]";
  }
  if (status === "active") {
    return "bg-[#D1FAE5] text-[#10B981]";
  }
  return "bg-[#FEF3C7] text-[#D97706]";
}

function statusLabel(status: string): string {
  if (status === "final") return "Final";
  if (status === "active") return "Active";
  return "Draft";
}

function gameTitle(game: ChartingGame): string {
  const opponent = game.opponent?.trim() || "Unnamed Opponent";
  return game.babsonVenueSide === "away" ? `@ ${opponent}` : `vs. ${opponent}`;
}

function gameMeta(game: ChartingGame): string {
  const venueLabel = game.babsonVenueSide === "away" ? "Away" : "Home";
  const sessionLabel = game.sessionType === "live_ab" ? "Live AB" : "Game";
  return `${formatDateLabel(game.gameDate)} • ${venueLabel} • ${sessionLabel}`;
}

function MacroMetric({
  title,
  value,
  trend,
  trendDirection,
  positive,
  series,
  loading = false,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="relative h-[138px] overflow-hidden rounded-[22px] border border-[#F1F5F9] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-20 rounded-full bg-[#E2E8F0]" />
          <div className="h-8 w-28 rounded-xl bg-[#F1F5F9]" />
          <div className="mt-6 flex items-end gap-1">
            {[32, 24, 38, 28, 20, 26, 16].map((height) => (
              <div
                key={height}
                className="w-full rounded-t-sm bg-[#E2E8F0]"
                style={{ height }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const TrendIcon = trendDirection === "down" ? TrendingDown : TrendingUp;

  return (
    <article className="group relative h-[138px] overflow-hidden rounded-[22px] border border-[#F1F5F9] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#E2E8F0] hover:shadow-[0_24px_60px_rgba(15,23,42,0.07)]">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
            {title}
          </p>
          <h3 className={`${plusJakarta.className} mt-2 text-[2rem] font-extrabold tracking-tight text-[#0F172A]`}>
            {value}
          </h3>
        </div>
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${positive ? "bg-[#D1FAE5] text-[#10B981]" : "bg-[#FCE7F3] text-[#EC4899]"}`}
        >
          <TrendIcon className="h-3.5 w-3.5" />
          <span>{trend}</span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 px-5 pb-4 opacity-45 transition-opacity duration-300 group-hover:opacity-65">
        <div className="flex h-full items-end gap-1">
          {series.map((height, index) => (
            <div
              key={`${title}-${index}`}
              className="w-full rounded-t-sm bg-[#7DD3FC]"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

export default function HomeContent() {
  const [pitchers, setPitchers] = useState<PitcherRow[]>([]);
  const [hitters, setHitters] = useState<HitterRow[]>([]);
  const [games, setGames] = useState<ChartingGame[]>([]);
  const [seasonYear, setSeasonYear] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [gamesLoading, setGamesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      const [pitchingResult, battingResult, gamesResult] = await Promise.allSettled([
        fetch("/api/team-stats?statType=pitching").then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to load pitching stats");
          }

          return (await response.json()) as TeamStatsPitchingResponse;
        }),
        fetch("/api/team-stats?statType=batting").then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to load batting stats");
          }

          return (await response.json()) as TeamStatsBattingResponse;
        }),
        fetch("/api/charting/games").then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to load recent games");
          }

          return (await response.json()) as ChartingGamesResponse;
        }),
      ]);

      if (cancelled) {
        return;
      }

      if (pitchingResult.status === "fulfilled") {
        setPitchers(pitchingResult.value.pitchers ?? []);
        if (pitchingResult.value.year) {
          setSeasonYear(pitchingResult.value.year);
        }
      }

      if (battingResult.status === "fulfilled") {
        setHitters(battingResult.value.hitters ?? []);
        if (pitchingResult.status !== "fulfilled" && battingResult.value.year) {
          setSeasonYear(battingResult.value.year);
        }
      }

      if (gamesResult.status === "fulfilled") {
        setGames(gamesResult.value.games ?? []);
      }

      setStatsLoading(false);
      setGamesLoading(false);
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalER = pitchers.reduce((sum, pitcher) => sum + (pitcher.er || 0), 0);
  const totalIP = pitchers.reduce((sum, pitcher) => sum + (pitcher.ip || 0), 0);
  const totalRunsAllowed = pitchers.reduce((sum, pitcher) => sum + (pitcher.r || 0), 0);

  const totalAB = hitters.reduce((sum, hitter) => sum + (hitter.ab || 0), 0);
  const totalHits = hitters.reduce((sum, hitter) => sum + (hitter.h || 0), 0);
  const totalWalks = hitters.reduce((sum, hitter) => sum + (hitter.bb || 0), 0);
  const totalHitByPitch = hitters.reduce((sum, hitter) => sum + (hitter.hbp || 0), 0);
  const totalSacrificeFlies = hitters.reduce((sum, hitter) => sum + (hitter.sf || 0), 0);
  const totalBases = hitters.reduce((sum, hitter) => sum + (hitter.tb || 0), 0);
  const totalRunsScored = hitters.reduce((sum, hitter) => sum + (hitter.r || 0), 0);

  const teamERA = totalIP > 0 ? ((totalER * 9) / totalIP).toFixed(2) : "0.00";
  const onBasePercentage =
    totalAB + totalWalks + totalHitByPitch + totalSacrificeFlies > 0
      ? (totalHits + totalWalks + totalHitByPitch) /
        (totalAB + totalWalks + totalHitByPitch + totalSacrificeFlies)
      : 0;
  const sluggingPercentage = totalAB > 0 ? totalBases / totalAB : 0;
  const teamOPS = formatRate(onBasePercentage + sluggingPercentage);

  const runDifferential = totalRunsScored - totalRunsAllowed;
  const runDifferentialLabel = runDifferential > 0 ? `+${runDifferential}` : `${runDifferential}`;

  const eraBenchmark = 4.0;
  const opsBenchmark = 0.8;

  const metricCards = [
    {
      title: "Team ERA",
      value: teamERA,
      trend: formatSignedValue(Number(teamERA) - eraBenchmark, 2),
      trendDirection: Number(teamERA) <= eraBenchmark ? "down" : "up",
      positive: Number(teamERA) <= eraBenchmark,
      series: [58, 36, 66, 46, 28, 42, 18],
    },
    {
      title: "Team OPS",
      value: teamOPS,
      trend: formatSignedValue(Number(teamOPS) - opsBenchmark, 3).replace(/^(-?)0\./, "$1."),
      trendDirection: Number(teamOPS) >= opsBenchmark ? "up" : "down",
      positive: Number(teamOPS) >= opsBenchmark,
      series: [22, 36, 30, 52, 48, 66, 74],
    },
    {
      title: "Run Differential",
      value: runDifferentialLabel,
      trend: runDifferential > 0 ? `+${runDifferential}` : `${runDifferential}`,
      trendDirection: runDifferential >= 0 ? "up" : "down",
      positive: runDifferential >= 0,
      series: [18, 24, 22, 38, 50, 68, 82],
    },
  ] satisfies MetricCardProps[];

  const topHitters = [...hitters]
    .filter((hitter) => hitter.pa > 0)
    .sort((left, right) => (right.ops || 0) - (left.ops || 0))
    .slice(0, 2)
    .map<PerformerCard>((hitter) => ({
      key: `hitter-${hitter.playerId}`,
      name: hitter.playerName,
      href: hitter.slug ? `/players/${hitter.slug}` : null,
      statLabel: `OPS ${formatRate(hitter.ops)}`,
      accent: "emerald",
    }));

  const topPitcher = [...pitchers]
    .filter((pitcher) => pitcher.ip > 0)
    .sort(
      (left, right) =>
        (right.kMinusBbPct || 0) - (left.kMinusBbPct || 0) || (right.so || 0) - (left.so || 0),
    )
    .slice(0, 1)
    .map<PerformerCard>((pitcher) => ({
      key: `pitcher-${pitcher.playerId}`,
      name: pitcher.playerName,
      href: pitcher.slug ? `/players/${pitcher.slug}` : null,
      statLabel:
        pitcher.kMinusBbPct > 0
          ? `K-BB% ${pitcher.kMinusBbPct.toFixed(1)}%`
          : `${pitcher.so} SO`,
      accent: "sky",
    }));

  const topPerformers = [...topHitters, ...topPitcher].slice(0, 3);
  const recentGames = games.filter((game) => game.sessionType === "game").slice(0, 3);

  return (
    <div className={`min-h-full bg-[#F8FAFC] text-[#0F172A] ${manrope.className}`}>
      <header className="border-b border-[#F1F5F9] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <h1 className={`${plusJakarta.className} text-[1.85rem] font-extrabold tracking-tight text-[#0F172A]`}>
              Dashboard Overview
            </h1>
            <div className="hidden h-5 w-px bg-[#E2E8F0] md:block" />
            <div className="hidden items-center gap-3 md:flex">
              <span
                className={`${plusJakarta.className} rounded-full bg-[#EEF2FF] px-3 py-1 text-[12px] font-bold text-[#6366F1]`}
              >
                Varsity
              </span>
              <span
                className={`${plusJakarta.className} text-[12px] font-semibold text-[#94A3B8]`}
              >
                {seasonYear ? `${seasonYear} season` : "NCAA sync"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/charting/new"
              className={`${plusJakarta.className} hidden items-center gap-2 rounded-full bg-[#6366F1] px-4 py-2 text-[12px] font-bold text-white shadow-[0_12px_28px_rgba(99,102,241,0.18)] transition-all duration-300 hover:bg-[#4F46E5] sm:inline-flex`}
            >
              <Upload className="h-4 w-4" />
              New Session
            </Link>
            <div className="hidden items-center gap-2 rounded-full border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2 sm:flex">
              <LineChart className="h-4 w-4 text-[#94A3B8]" />
              <span className={`${plusJakarta.className} text-[12px] font-semibold text-[#475569]`}>
                {seasonYear ? `${seasonYear} season` : "Season view"}
              </span>
              <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
            </div>
            <div className="rounded-full border border-[#F1F5F9] bg-white px-4 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <LogoutButton className={`${plusJakarta.className} text-[12px] font-semibold uppercase tracking-[0.14em] text-[#64748B] hover:text-[#0F172A]`} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8 sm:py-8">
        <section className="grid gap-5 md:grid-cols-3">
          {metricCards.map((card) => (
            <MacroMetric
              key={card.title}
              title={card.title}
              value={card.value}
              trend={card.trend}
              trendDirection={card.trendDirection}
              positive={card.positive}
              series={card.series}
              loading={statsLoading}
            />
          ))}
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.95fr)]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className={`${plusJakarta.className} text-xl font-extrabold tracking-tight text-[#0F172A]`}>
                  Recent Games
                </h2>
                <p className="mt-1 text-sm text-[#64748B]">
                  Latest charting sessions available for {TEAM_NAME}.
                </p>
              </div>
              <Link
                href="/charting"
                className={`${plusJakarta.className} text-[13px] font-semibold text-[#6366F1] transition-colors hover:text-[#4F46E5]`}
              >
                View All
              </Link>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-[#F1F5F9] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
              {gamesLoading ? (
                <div className="space-y-4 p-5">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="flex animate-pulse items-center justify-between gap-4 rounded-[18px] border border-[#F8FAFC] bg-[#FCFDFE] p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-full bg-[#E2E8F0]" />
                        <div className="space-y-2">
                          <div className="h-4 w-36 rounded-full bg-[#E2E8F0]" />
                          <div className="h-3 w-28 rounded-full bg-[#F1F5F9]" />
                        </div>
                      </div>
                      <div className="h-7 w-16 rounded-full bg-[#F1F5F9]" />
                    </div>
                  ))}
                </div>
              ) : recentGames.length > 0 ? (
                recentGames.map((game, index) => (
                  <Link
                    href={`/charting/games/${game.id}`}
                    key={game.id}
                    className={`group flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-[#F8FAFC] sm:flex-row sm:items-center sm:justify-between ${index < recentGames.length - 1 ? "border-b border-[#F1F5F9]" : ""}`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8FAFC] text-[13px] font-bold text-[#64748B] ring-1 ring-[#F1F5F9]">
                        {getInitials(game.opponent ?? "Game")}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`${plusJakarta.className} truncate text-[15px] font-bold text-[#0F172A] transition-colors group-hover:text-[#6366F1]`}
                        >
                          {gameTitle(game)}
                        </p>
                        <p className="mt-1 text-[13px] text-[#64748B]">{gameMeta(game)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-left sm:text-right">
                        <p className={`${plusJakarta.className} text-[14px] font-semibold text-[#0F172A]`}>
                          {game.sessionType === "live_ab" ? "Live AB Session" : "Game Log"}
                        </p>
                        <p className="text-[12px] text-[#94A3B8]">{formatUpdatedLabel(game.updatedAt)}</p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${statusPillClasses(game.status)}`}
                      >
                        {statusLabel(game.status)}
                      </span>
                      <ChevronRight className="h-5 w-5 text-[#94A3B8] transition-colors group-hover:text-[#6366F1]" />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className={`${plusJakarta.className} text-[15px] font-semibold text-[#0F172A]`}>
                    No recent charting games yet.
                  </p>
                  <p className="mt-2 text-sm text-[#64748B]">
                    Start a new session to populate the game log.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className={`${plusJakarta.className} text-xl font-extrabold tracking-tight text-[#0F172A]`}>
                  Top Performers
                </h2>
                <p className="mt-1 text-sm text-[#64748B]">
                  Live standouts from the current NCAA sync.
                </p>
              </div>
              <span className={`${plusJakarta.className} text-[11px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]`}>
                {seasonYear ? `${seasonYear} season` : "Season"}
              </span>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-[#F1F5F9] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
              {statsLoading ? (
                <div className="space-y-4 p-5">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex animate-pulse items-center gap-4">
                      <div className="h-11 w-11 rounded-full bg-[#E2E8F0]" />
                      <div className="space-y-2">
                        <div className="h-4 w-28 rounded-full bg-[#E2E8F0]" />
                        <div className="h-3 w-20 rounded-full bg-[#F1F5F9]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : topPerformers.length > 0 ? (
                topPerformers.map((performer, index) => {
                  const content = (
                    <div
                      className={`group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F8FAFC] ${index < topPerformers.length - 1 ? "border-b border-[#F1F5F9]" : ""}`}
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${performer.accent === "emerald" ? "border-[#D1FAE5] bg-[#ECFDF5] text-[#10B981]" : "border-[#DBEAFE] bg-[#EFF6FF] text-[#0EA5E9]"}`}
                      >
                        <span className={`${plusJakarta.className} text-[12px] font-bold`}>
                          {getInitials(performer.name)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`${plusJakarta.className} truncate text-[15px] font-bold text-[#0F172A] transition-colors group-hover:text-[#6366F1]`}
                        >
                          {performer.name}
                        </p>
                        <p className="mt-1 text-[13px] text-[#64748B]">{performer.statLabel}</p>
                      </div>
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${performer.accent === "emerald" ? "text-[#10B981]" : "text-[#0EA5E9]"}`}
                      >
                        <TrendingUp className="h-4 w-4" />
                      </div>
                    </div>
                  );

                  if (performer.href) {
                    return (
                      <Link href={performer.href} key={performer.key}>
                        {content}
                      </Link>
                    );
                  }

                  return <div key={performer.key}>{content}</div>;
                })
              ) : (
                <div className="p-8 text-center">
                  <p className={`${plusJakarta.className} text-[15px] font-semibold text-[#0F172A]`}>
                    No season leaders available.
                  </p>
                  <p className="mt-2 text-sm text-[#64748B]">
                    Sync team stats to populate the leaderboard.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
