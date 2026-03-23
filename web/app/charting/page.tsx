import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  FilePenLine,
  Plus,
  Search,
  Trophy,
} from "lucide-react";
import { count, desc } from "drizzle-orm";
import { Plus_Jakarta_Sans } from "next/font/google";
import { db } from "@/db";
import { chartingGames, chartingPlateAppearances } from "@/db/schema";
import { EditableChartingGameNameInList } from "@/app/charting/_components/EditableChartingGameNameInList";
import { HubActionCard, HubStatCard } from "@/app/components/hub/HubHeader";

export const revalidate = 0;

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

type HubStatusFilter = "all" | "active" | "final" | "draft";
type HubTypeFilter = "all" | "live_ab" | "game";

function normalizeStatusFilter(value: string | string[] | undefined): HubStatusFilter {
  if (value === "active" || value === "final" || value === "draft") {
    return value;
  }
  return "all";
}

function normalizeTypeFilter(value: string | string[] | undefined): HubTypeFilter {
  if (value === "live_ab" || value === "game" || value === "all") {
    return value;
  }
  return "all";
}

function matchesQuery(
  game: {
    opponent: string | null;
    gameDate: string;
    status: string;
    sessionType: string | null;
  },
  query: string,
): boolean {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const searchTarget = [
    game.opponent || "Unnamed Game",
    game.gameDate,
    format(parseISO(game.gameDate), "MMMM d yyyy"),
    game.status,
    game.sessionType === "game" ? "game" : "practice",
  ]
    .join(" ")
    .toLowerCase();

  return searchTarget.includes(normalizedQuery);
}

function formatUpdatedBadge(status: string): string {
  if (status === "active") return "Live";
  if (status === "final") return "Final";
  return "Draft";
}

function statusPillClass(status: string): string {
  if (status === "active") {
    return "border-[#D1FAE5] bg-[#ECFDF5] text-[#10B981]";
  }
  if (status === "final") {
    return "border-[#DBEAFE] bg-[#EFF6FF] text-[#0EA5E9]";
  }
  return "border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]";
}

function typePillClass(sessionType: string | null): string {
  if (sessionType === "game") {
    return "border-[#DBEAFE] bg-[#EFF6FF] text-[#0EA5E9]";
  }
  return "border-[#F3E8FF] bg-[#FAF5FF] text-[#8B5CF6]";
}

export default async function ChartingHubPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const searchQuery = typeof searchParams.q === "string" ? searchParams.q : "";
  const statusFilter = normalizeStatusFilter(searchParams.status);
  const typeFilter = normalizeTypeFilter(searchParams.type);

  const games = await db.select().from(chartingGames).orderBy(desc(chartingGames.gameDate));

  const paCounts = await db
    .select({ gameId: chartingPlateAppearances.gameId, paCount: count() })
    .from(chartingPlateAppearances)
    .groupBy(chartingPlateAppearances.gameId);
  const paCountByGame = new Map(paCounts.map((row) => [row.gameId, row.paCount]));

  const totalGames = games.length;
  const activeGames = games.filter((game) => game.status === "active").length;
  const finalGames = games.filter((game) => game.status === "final").length;
  const draftGames = games.filter((game) => game.status === "draft").length;
  const liveAbGames = games.filter((game) => game.sessionType === "live_ab").length;
  const gameGames = games.filter((game) => game.sessionType === "game").length;

  const filteredGames = games.filter((game) => {
    const matchesStatus = statusFilter === "all" ? true : game.status === statusFilter;
    const matchesType = typeFilter === "all" ? true : game.sessionType === typeFilter;
    return matchesStatus && matchesType && matchesQuery(game, searchQuery);
  });

  const hasFilters = statusFilter !== "all" || typeFilter !== "all" || searchQuery.trim().length > 0;

  const quickActionClass =
    "flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-[13px] font-semibold text-[#0F172A] transition-colors hover:border-[var(--brand-primary-border)] hover:bg-white hover:text-[var(--brand-primary-subtle-text)]";
  const quickActionIconClass = "h-4 w-4 shrink-0 text-[#64748B]";

  return (
    <div className={`min-h-full bg-[#F9FAFB] text-[#0F172A] ${plusJakarta.className}`}>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6366F1]">
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  Workspace
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-[#0F172A] sm:text-[2.85rem] sm:leading-[1.02]">
                  Charting Hub
                </h1>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
                <HubActionCard
                  href="/charting/faq"
                  icon={BookOpen}
                  sectionTitle="Dictionary"
                  buttonLabel="Metrics glossary"
                />
                <HubActionCard
                  href="/charting/leaderboard"
                  icon={Trophy}
                  sectionTitle="Leaderboards"
                  buttonLabel="Open rankings"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <HubStatCard
                label="Total sessions"
                value={String(totalGames)}
                detail="All charting records in the hub."
                tone="indigo"
              />
              <HubStatCard
                label="Active"
                value={String(activeGames)}
                detail="Ready-to-reopen games."
                tone="emerald"
              />
              <HubStatCard
                label="Final"
                value={String(finalGames)}
                detail="Completed charting sessions."
                tone="sky"
              />
              <HubStatCard
                label="Draft / Live AB"
                value={`${draftGames} / ${liveAbGames}`}
                detail={`${gameGames} game sessions tracked.`}
                tone="violet"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-[#EEF2F7] pt-5 sm:grid-cols-2">
              <Link href="/charting/insights" className={quickActionClass}>
                <Eye className={quickActionIconClass} aria-hidden />
                Player Insights
              </Link>
              <Link href="/charting/new" className={quickActionClass}>
                <Plus className={quickActionIconClass} aria-hidden />
                New Session
              </Link>
            </div>
          </div>
        </header>

        <section>
          <div className="overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
            <div className="border-b border-[#EEF2F7] px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#0F172A]">Session Queue</h2>
                  <p className="mt-1 text-sm text-[#64748B]">
                    Search, filter, and jump into any charting session.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone="brand">{filteredGames.length} visible</Pill>
                  {activeGames > 0 ? <Pill tone="emerald">{activeGames} active</Pill> : null}
                  {hasFilters ? <Pill tone="neutral">Filtered</Pill> : null}
                </div>
              </div>
            </div>

            <form action="/charting" className="grid gap-4 border-b border-[#EEF2F7] px-5 py-5 sm:px-6 lg:grid-cols-[minmax(11rem,13rem)_minmax(10rem,12rem)_minmax(0,1fr)_auto] lg:items-end">
              <Field label="Status">
                <select
                  name="status"
                  defaultValue={statusFilter}
                  className="w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm font-semibold text-[#0F172A] outline-none transition-colors focus:border-[#C7D2FE] focus:bg-white"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="final">Final</option>
                  <option value="draft">Draft</option>
                </select>
              </Field>

              <Field label="Type">
                <select
                  name="type"
                  defaultValue={typeFilter}
                  className="w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm font-semibold text-[#0F172A] outline-none transition-colors focus:border-[#C7D2FE] focus:bg-white"
                >
                  <option value="all">All types</option>
                  <option value="game">Games</option>
                  <option value="live_ab">Live AB</option>
                </select>
              </Field>

              <Field label="Search">
                <label className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 transition-colors focus-within:border-[#C7D2FE] focus-within:bg-white">
                  <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                  <input
                    type="text"
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Search opponent, date, or status..."
                    className="w-full bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                  />
                </label>
              </Field>

              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#6366F1] px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#4F46E5]"
                >
                  Apply Filters
                </button>
                {hasFilters ? (
                  <Link
                    href="/charting"
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-[#64748B] transition-colors hover:border-[#CBD5E1] hover:text-[#0F172A]"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>
            </form>

            {games.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
                <ClipboardList className="mb-5 h-14 w-14 text-[#CBD5E1]" />
                <h2 className="text-xl font-bold text-[#0F172A]">No games yet</h2>
                <p className="mt-2 max-w-sm text-sm leading-7 text-[#64748B]">
                  Start a new charting session to populate the hub.
                </p>
                <Link
                  href="/charting/new"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#6366F1] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#4F46E5]"
                >
                  <Plus className="h-4 w-4" />
                  New Game
                </Link>
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
                <Search className="mb-5 h-12 w-12 text-[#CBD5E1]" />
                <h2 className="text-xl font-bold text-[#0F172A]">No matches</h2>
                <p className="mt-2 max-w-sm text-sm leading-7 text-[#64748B]">
                  No charting games match the current search and filter set.
                </p>
                <Link
                  href="/charting"
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#475569] transition-colors hover:border-[#CBD5E1] hover:text-[#0F172A]"
                >
                  Clear Filters
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#EEF2F7]">
                {filteredGames.map((game) => {
                  const pa = paCountByGame.get(game.id) ?? 0;

                  return (
                    <div key={game.id} className="group px-5 py-4 transition-colors hover:bg-[#F8FAFC] sm:px-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <Link
                          href={`/charting/games/${game.id}`}
                          className="flex min-w-0 flex-1 items-center gap-4"
                          aria-label={`View data for game against ${game.opponent || "Unnamed Game"}`}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8FAFC] text-[13px] font-bold text-[#64748B] ring-1 ring-[#E5E7EB]">
                            {initialsForOpponent(game.opponent)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Pill tone="status" className={statusPillClass(game.status)}>
                                {formatUpdatedBadge(game.status)}
                              </Pill>
                              <Pill tone="status" className={typePillClass(game.sessionType)}>
                                {game.sessionType === "game" ? "Game" : "Live AB"}
                              </Pill>
                              {pa > 0 ? <Pill tone="neutral">{pa} PA{pa !== 1 ? "s" : ""}</Pill> : null}
                            </div>

                            <h3 className="mt-3 truncate text-[16px] font-bold text-[#0F172A] transition-colors group-hover:text-[#6366F1]">
                              <EditableChartingGameNameInList
                                gameId={game.id}
                                initialOpponent={game.opponent}
                                initialGameDate={game.gameDate}
                                revision={game.revision}
                              />
                            </h3>

                            <p className="mt-1 text-sm text-[#64748B]">
                              {format(parseISO(game.gameDate), "EEEE, MMMM d, yyyy")}
                            </p>
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 lg:gap-3">
                          <Link
                            href={`/charting/games/${game.id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569] transition-colors hover:border-[#CBD5E1] hover:text-[#0F172A]"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Overview
                          </Link>
                          <Link
                            href={`/charting/games/${game.id}/edit`}
                            className="inline-flex items-center gap-2 rounded-full bg-[#6366F1]/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6366F1] transition-colors hover:bg-[#6366F1]/15"
                          >
                            <FilePenLine className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                          <ChevronRight className="hidden h-5 w-5 text-[#CBD5E1] transition-colors group-hover:text-[#6366F1] lg:block" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function initialsForOpponent(opponent: string | null): string {
  if (!opponent) return "NG";
  const parts = opponent
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) return "NG";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#94A3B8]">
        {label}
      </div>
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "brand" | "neutral" | "emerald" | "sky" | "status";
  className?: string;
}) {
  const base =
    tone === "brand"
      ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#6366F1]"
      : tone === "emerald"
        ? "border-[#D1FAE5] bg-[#ECFDF5] text-[#10B981]"
        : tone === "sky"
          ? "border-[#DBEAFE] bg-[#EFF6FF] text-[#0EA5E9]"
          : tone === "status"
            ? ""
            : "border-[#E5E7EB] bg-[#F8FAFC] text-[#64748B]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${base} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
