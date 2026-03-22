"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import {
  Activity,
  ArrowRight,
  BarChart3,
  ClipboardList,
  Film,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
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

type PulseMetricProps = {
  title: string;
  value: string;
  detail: string;
  series: number[];
  loading?: boolean;
};

type QuickLaunchItem = {
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
};

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

function getGameTimestamp(game: ChartingGame): number {
  const candidates = [game.updatedAt, game.gameDate]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return parseISO(value).getTime();
      } catch {
        return 0;
      }
    });

  return Math.max(0, ...candidates);
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

function PulseMetric({
  title,
  value,
  detail,
  series,
  loading = false,
}: PulseMetricProps) {
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-[26px] border border-[#E7EDF5] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-24 rounded-full bg-[#E2E8F0]" />
          <div className="h-9 w-32 rounded-xl bg-[#F1F5F9]" />
          <div className="h-3 w-44 rounded-full bg-[#F1F5F9]" />
          <div className="mt-4 flex h-12 items-end gap-1">
            {[40, 22, 58, 34, 28, 46, 18].map((height) => (
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

  return (
    <article className="group relative overflow-hidden rounded-[26px] border border-[#E7EDF5] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#DCE5EF] hover:shadow-[0_22px_56px_rgba(15,23,42,0.07)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-90"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(var(--brand-primary-rgb), 0.08), transparent 42%)",
        }}
      />
      <div className="relative z-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
            {title}
          </p>
          <h3 className={`${plusJakarta.className} mt-2 text-[2rem] font-extrabold tracking-tight text-[#0F172A]`}>
            {value}
          </h3>
        </div>

        <p className="mt-3 text-[13px] text-[#64748B]">{detail}</p>

        <div className="mt-5 flex h-12 items-end gap-1 opacity-50 transition-opacity duration-300 group-hover:opacity-70">
          {series.map((height, index) => (
            <div
              key={`${title}-${index}`}
              className="w-full rounded-t-md bg-[#BDE0F6]"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function QuickLaunchTile({
  item,
}: {
  item: QuickLaunchItem;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group rounded-[22px] border border-[#E7EDF5] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.03)] transition-all duration-300 hover:border-[var(--brand-primary-border)] hover:bg-[var(--brand-primary-surface)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-subtle-text)]">
          <Icon className="h-4 w-4" />
        </div>
        <ArrowRight className="h-4 w-4 text-[#94A3B8] transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--brand-primary-subtle-text)]" />
      </div>
      <p className={`${plusJakarta.className} mt-4 text-[15px] font-bold tracking-tight text-[#0F172A]`}>
        {item.title}
      </p>
      <p className="mt-1 text-[13px] leading-6 text-[#64748B]">{item.detail}</p>
    </Link>
  );
}

function SessionRow({
  game,
}: {
  game: ChartingGame;
}) {
  return (
    <Link
      href={`/charting/games/${game.id}`}
      className="group flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-[#F8FAFC] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8FAFC] text-[13px] font-bold text-[#64748B] ring-1 ring-[#F1F5F9]">
          {getInitials(game.opponent ?? "Game")}
        </div>
        <div className="min-w-0">
          <p className={`${plusJakarta.className} truncate text-[15px] font-bold text-[#0F172A] transition-colors group-hover:text-[var(--brand-primary-subtle-text)]`}>
            {gameTitle(game)}
          </p>
          <p className="mt-1 text-[13px] text-[#64748B]">{gameMeta(game)}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-left sm:text-right">
          <p className={`${plusJakarta.className} text-[14px] font-semibold text-[#0F172A]`}>
            {game.sessionType === "live_ab" ? "Live AB" : "Game Log"}
          </p>
          <p className="text-[12px] text-[#94A3B8]">{formatUpdatedLabel(game.updatedAt)}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${statusPillClasses(game.status)}`}
        >
          {statusLabel(game.status)}
        </span>
        <ArrowRight className="h-4 w-4 text-[#94A3B8] transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--brand-primary-subtle-text)]" />
      </div>
    </Link>
  );
}

export default function HomeContent() {
  const [pitchers, setPitchers] = useState<PitcherRow[]>([]);
  const [hitters, setHitters] = useState<HitterRow[]>([]);
  const [games, setGames] = useState<ChartingGame[]>([]);
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
      }

      if (battingResult.status === "fulfilled") {
        setHitters(battingResult.value.hitters ?? []);
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

  const pulseMetrics = [
    {
      title: "Team ERA",
      value: teamERA,
      detail: `${pitchers.length} pitcher${pitchers.length === 1 ? "" : "s"} logged · ${totalIP.toFixed(1)} IP tracked`,
      series: [58, 36, 66, 46, 28, 42, 18],
    },
    {
      title: "Team OPS",
      value: teamOPS,
      detail: `${hitters.length} hitter${hitters.length === 1 ? "" : "s"} with NCAA stats · ${totalAB} AB`,
      series: [22, 36, 30, 52, 48, 66, 74],
    },
    {
      title: "Run Differential",
      value: runDifferentialLabel,
      detail: `${totalRunsScored} scored · ${totalRunsAllowed} allowed`,
      series: [18, 24, 22, 38, 50, 68, 82],
    },
  ] satisfies PulseMetricProps[];

  const sortedGames = [...games].sort((left, right) => getGameTimestamp(right) - getGameTimestamp(left));
  const recentGames = sortedGames.filter((game) => game.sessionType === "game").slice(0, 5);

  const quickLaunch: QuickLaunchItem[] = [
    {
      title: "Team Stats",
      detail: "Team-wide NCAA output and season leaderboard context.",
      href: "/team-stats/leaderboard",
      icon: BarChart3,
    },
    {
      title: "Players",
      detail: "Roster access, player pages, and dossier views.",
      href: "/players",
      icon: Users,
    },
    {
      title: "Session Hub",
      detail: "Game logs, drafts, and live session work.",
      href: "/charting",
      icon: ClipboardList,
    },
    {
      title: "Trackman",
      detail: "Arsenal movement and session history.",
      href: "/trackman",
      icon: Activity,
    },
    {
      title: "Command",
      detail: "Command+ reports and outing access.",
      href: "/command",
      icon: Target,
    },
    {
      title: "Mechanics",
      detail: "Video review and pitcher-specific checkpoints.",
      href: "/mechanics",
      icon: Film,
    },
  ];

  return (
    <div className={`min-h-full bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_30%,#f8fafc_100%)] text-[#0F172A] ${manrope.className}`}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background:
            "radial-gradient(circle at top center, rgba(var(--brand-primary-rgb), 0.09), transparent 60%)",
        }}
      />

      <main className="relative mx-auto max-w-[1360px] px-4 py-6 sm:px-8 sm:py-8">
        <section className="relative overflow-hidden rounded-[32px] border border-[var(--brand-primary-border)] bg-white px-6 py-6 shadow-[0_24px_64px_rgba(15,23,42,0.06)] sm:px-8 sm:py-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top left, rgba(var(--brand-primary-rgb), 0.1), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94))",
            }}
          />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[30px] border border-[var(--brand-primary-border)] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
              <Image
              src="/babson-logo.svg"
              alt={`${TEAM_NAME} logo`}
              width={66}
              height={66}
              priority
              className="h-auto w-auto max-h-full max-w-full"
            />
            </div>

            <div className="min-w-0 flex-1">
              <h1
                className={`${plusJakarta.className} text-[2rem] font-extrabold leading-[0.98] tracking-tight text-[#0F172A] sm:text-[2.7rem] lg:text-[clamp(3rem,3.35vw,3.7rem)] lg:whitespace-nowrap`}
              >
                {TEAM_NAME} Baseball Data Insights Portal
              </h1>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="grid gap-5 lg:grid-cols-3">
            {pulseMetrics.map((metric) => (
              <PulseMetric
                key={metric.title}
                title={metric.title}
                value={metric.value}
                detail={metric.detail}
                series={metric.series}
                loading={statsLoading}
              />
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border border-[#E7EDF5] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quickLaunch.map((item) => (
              <QuickLaunchTile key={item.title} item={item} />
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border border-[#E7EDF5] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
          <div className="overflow-hidden rounded-[24px] border border-[#F1F5F9] bg-white">
            {gamesLoading ? (
              <div className="space-y-4 p-5">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="flex animate-pulse items-center justify-between gap-4 rounded-[18px] border border-[#F8FAFC] bg-[#FCFDFE] p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 rounded-full bg-[#E2E8F0]" />
                      <div className="space-y-2">
                        <div className="h-4 w-40 rounded-full bg-[#E2E8F0]" />
                        <div className="h-3 w-28 rounded-full bg-[#F1F5F9]" />
                      </div>
                    </div>
                    <div className="h-7 w-16 rounded-full bg-[#F1F5F9]" />
                  </div>
                ))}
              </div>
            ) : recentGames.length > 0 ? (
              recentGames.map((game, index) => (
                <div
                  key={game.id}
                  className={index < recentGames.length - 1 ? "border-b border-[#F1F5F9]" : ""}
                >
                  <SessionRow game={game} />
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className={`${plusJakarta.className} text-[15px] font-semibold text-[#0F172A]`}>
                  No recent game logs yet.
                </p>
                <p className="mt-2 text-sm text-[#64748B]">
                  Start a session to build the archive.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
