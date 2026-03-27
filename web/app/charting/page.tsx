import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  FilePenLine,
  Plus,
  Search,
} from "lucide-react";
import { count, desc } from "drizzle-orm";
import { chartingDb as db } from "@/db";
import { chartingGames, chartingPlateAppearances } from "@/db/schema";
import { EditableChartingGameNameInList } from "@/app/charting/_components/EditableChartingGameNameInList";
import { HubActionCard, HubStatCard } from "@/app/components/hub/HubHeader";

export const revalidate = 0;

type HubStatusFilter = "all" | "active" | "final" | "draft";

function normalizeStatusFilter(value: string | string[] | undefined): HubStatusFilter {
  if (value === "active" || value === "final" || value === "draft") {
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
    "game",
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
    return "border-[#D1FAE5] bg-[#ECFDF5] text-[#10B981] dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (status === "final") {
    return "border-[#DBEAFE] bg-[#EFF6FF] text-[#0EA5E9] dark:border-sky-500/35 dark:bg-sky-950/40 dark:text-sky-300";
  }
  return "border-[#FDE68A] bg-[#FFFBEB] text-[#D97706] dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-300";
}

export default async function ChartingHubPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const searchQuery = typeof searchParams.q === "string" ? searchParams.q : "";
  const statusFilter = normalizeStatusFilter(searchParams.status);

  const allGames = await db.select().from(chartingGames).orderBy(desc(chartingGames.gameDate));
  const games = allGames.filter((game) => game.sessionType === "game");

  const paCounts = await db
    .select({ gameId: chartingPlateAppearances.gameId, paCount: count() })
    .from(chartingPlateAppearances)
    .groupBy(chartingPlateAppearances.gameId);
  const paCountByGame = new Map(paCounts.map((row) => [row.gameId, row.paCount]));

  const totalGames = games.length;
  const activeGames = games.filter((game) => game.status === "active").length;
  const finalGames = games.filter((game) => game.status === "final").length;
  const draftGames = games.filter((game) => game.status === "draft").length;

  const filteredGames = games.filter((game) => {
    const matchesStatus = statusFilter === "all" ? true : game.status === statusFilter;
    return matchesStatus && matchesQuery(game, searchQuery);
  });

  const hasFilters = statusFilter !== "all" || searchQuery.trim().length > 0;

  const quickActionClass =
    "flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-[13px] font-semibold text-slate-900 transition-colors hover:border-[var(--brand-primary-border)] hover:bg-surface hover:text-[var(--brand-primary-subtle-text)] dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-100 dark:hover:border-[rgba(var(--brand-primary-rgb),0.35)] dark:hover:bg-zinc-900 dark:hover:text-[var(--brand-primary-spotlight)]";
  const quickActionIconClass = "h-4 w-4 shrink-0 text-slate-500 dark:text-zinc-400";

  return (
    <div className="font-display min-h-full bg-[#F9FAFB] text-slate-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-[0_24px_54px_rgba(0,0,0,0.42)]">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6366F1] dark:border-indigo-500/30 dark:bg-indigo-950/45 dark:text-indigo-200">
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  Workspace
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.85rem] sm:leading-[1.02]">
                  Charting Hub
                </h1>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
                <HubActionCard
                  href="/charting/faq"
                  iconName="bookOpen"
                  sectionTitle="Dictionary"
                  buttonLabel="Metrics Glossary"
                />
                <HubActionCard
                  href="/charting/leaderboard"
                  iconName="trophy"
                  sectionTitle="Process Board"
                  buttonLabel="Open Leaderboard"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <HubStatCard
                label="Total games"
                value={String(totalGames)}
                detail="All charted games in the hub."
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
                label="Draft"
                value={String(draftGames)}
                detail="Game sessions still in progress."
                tone="violet"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-[#EEF2F7] pt-5 dark:border-zinc-800 sm:grid-cols-2">
              <Link href="/charting/insights" className={quickActionClass}>
                <Eye className={quickActionIconClass} aria-hidden />
                Player Visuals
              </Link>
              <Link href="/charting/new" className={quickActionClass}>
                <Plus className={quickActionIconClass} aria-hidden />
                New Game
              </Link>
            </div>
          </div>
        </header>

        <section>
          <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-[0_24px_54px_rgba(0,0,0,0.42)]">
            <div className="border-b border-[#EEF2F7] px-5 py-4 dark:border-zinc-800 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Game Queue</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    Search, filter, and jump into any charted game.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone="brand">{filteredGames.length} visible</Pill>
                  {activeGames > 0 ? <Pill tone="emerald">{activeGames} active</Pill> : null}
                  {hasFilters ? <Pill tone="neutral">Filtered</Pill> : null}
                </div>
              </div>
            </div>

            <form action="/charting" className="grid gap-4 border-b border-[#EEF2F7] px-5 py-5 dark:border-zinc-800 sm:px-6 lg:grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)_auto] lg:items-end">
              <Field label="Status">
                <select
                  name="status"
                  defaultValue={statusFilter}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-[#C7D2FE] focus:bg-surface dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-100 dark:focus:border-indigo-400/35 dark:focus:bg-zinc-900"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="final">Final</option>
                  <option value="draft">Draft</option>
                </select>
              </Field>

              <Field label="Search">
                <label className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 transition-colors focus-within:border-[#C7D2FE] focus-within:bg-surface dark:border-zinc-700 dark:bg-zinc-900/85 dark:focus-within:border-indigo-400/35 dark:focus-within:bg-zinc-900">
                  <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Search opponent, date, or status..."
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                </label>
              </Field>

              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#6366F1] px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#4F46E5] dark:bg-indigo-500 dark:hover:bg-indigo-400"
                >
                  Apply Filters
                </button>
                {hasFilters ? (
                  <Link
                    href="/charting"
                    className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400 transition-colors hover:border-slate-300 dark:hover:border-zinc-600 hover:text-slate-900 dark:hover:text-zinc-50"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>
            </form>

            {games.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
                <ClipboardList className="mb-5 h-14 w-14 text-[#CBD5E1] dark:text-zinc-700" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">No games yet</h2>
                <p className="mt-2 max-w-sm text-sm leading-7 text-slate-500 dark:text-zinc-400">
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
                <Search className="mb-5 h-12 w-12 text-[#CBD5E1] dark:text-zinc-700" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">No matches</h2>
                <p className="mt-2 max-w-sm text-sm leading-7 text-slate-500 dark:text-zinc-400">
                  No charting games match the current search and filter set.
                </p>
                <Link
                  href="/charting"
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400 transition-colors hover:border-slate-300 dark:hover:border-zinc-600 hover:text-slate-900 dark:hover:text-zinc-50"
                >
                  Clear Filters
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#EEF2F7] dark:divide-zinc-800">
                {filteredGames.map((game) => {
                  const pa = paCountByGame.get(game.id) ?? 0;

                  return (
                    <div key={game.id} className="group px-5 py-4 transition-colors hover:bg-background dark:hover:bg-zinc-900/55 sm:px-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <Link
                          href={`/charting/games/${game.id}`}
                          className="flex min-w-0 flex-1 items-center gap-4"
                          aria-label={`View data for game against ${game.opponent || "Unnamed Game"}`}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-[13px] font-bold text-slate-500 ring-1 ring-border dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
                            {initialsForOpponent(game.opponent)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Pill tone="status" className={statusPillClass(game.status)}>
                                {formatUpdatedBadge(game.status)}
                              </Pill>
                              {pa > 0 ? <Pill tone="neutral">{pa} PA{pa !== 1 ? "s" : ""}</Pill> : null}
                            </div>

                            <h3 className="mt-3 truncate text-[16px] font-bold text-slate-900 transition-colors group-hover:text-[#6366F1] dark:text-zinc-50 dark:group-hover:text-indigo-300">
                              <EditableChartingGameNameInList
                                gameId={game.id}
                                initialOpponent={game.opponent}
                                initialGameDate={game.gameDate}
                                revision={game.revision}
                              />
                            </h3>

                            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                              {format(parseISO(game.gameDate), "EEEE, MMMM d, yyyy")}
                            </p>
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 lg:gap-3">
                          <Link
                            href={`/charting/games/${game.id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Overview
                          </Link>
                          <Link
                            href={`/charting/games/${game.id}/edit`}
                            className="inline-flex items-center gap-2 rounded-full bg-[#6366F1]/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6366F1] transition-colors hover:bg-[#6366F1]/15 dark:bg-indigo-500/15 dark:text-indigo-200 dark:hover:bg-indigo-500/22"
                          >
                            <FilePenLine className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                          <ChevronRight className="hidden h-5 w-5 text-[#CBD5E1] transition-colors group-hover:text-[#6366F1] dark:text-zinc-700 dark:group-hover:text-indigo-300 lg:block" />
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500">
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
      ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#6366F1] dark:border-indigo-500/30 dark:bg-indigo-950/45 dark:text-indigo-200"
      : tone === "emerald"
        ? "border-[#D1FAE5] bg-[#ECFDF5] text-[#10B981] dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-emerald-300"
        : tone === "sky"
          ? "border-[#DBEAFE] bg-[#EFF6FF] text-[#0EA5E9] dark:border-sky-500/35 dark:bg-sky-950/40 dark:text-sky-300"
          : tone === "status"
            ? ""
            : "border-border bg-background text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${base} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
