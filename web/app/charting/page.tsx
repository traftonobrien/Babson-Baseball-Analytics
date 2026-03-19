import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
    BarChart3,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    FilePenLine,
    Plus,
    Search,
    Target,
} from "lucide-react";
import { count, desc } from "drizzle-orm";
import { db } from "@/db";
import { chartingGames, chartingPlateAppearances } from "@/db/schema";
import {
    LeaderboardIntro,
    LeaderboardPageFrame,
    LeaderboardPanel,
    LeaderboardPill,
    LeaderboardStatBlock,
    LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";
import { EditableChartingGameNameInList } from "@/app/charting/_components/EditableChartingGameNameInList";

export const revalidate = 0;

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
    return "game";
}

function matchesQuery(
    game: {
        opponent: string | null;
        gameDate: string;
        status: string;
        sessionType: string | null;
    },
    query: string
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

function StatusBadge({ status }: { status: string }) {
    if (status === "active") {
        return <LeaderboardPill tone="emerald">Active</LeaderboardPill>;
    }
    if (status === "final") {
        return <LeaderboardPill tone="blue">Final</LeaderboardPill>;
    }
    return <LeaderboardPill tone="orange">Draft</LeaderboardPill>;
}

function TypeBadge({ sessionType }: { sessionType: string | null }) {
    if (sessionType === "game") {
        return <LeaderboardPill tone="blue">Game</LeaderboardPill>;
    }
    return <LeaderboardPill tone="neutral">Practice</LeaderboardPill>;
}

export default async function ChartingHubPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const searchParams = await props.searchParams;
    const searchQuery = typeof searchParams.q === "string" ? searchParams.q : "";
    const statusFilter = normalizeStatusFilter(searchParams.status);
    const typeFilter = normalizeTypeFilter(searchParams.type);

    const games = await db
        .select()
        .from(chartingGames)
        .orderBy(desc(chartingGames.gameDate));

    const paCounts = await db
        .select({ gameId: chartingPlateAppearances.gameId, paCount: count() })
        .from(chartingPlateAppearances)
        .groupBy(chartingPlateAppearances.gameId);
    const paCountByGame = new Map(paCounts.map((r) => [r.gameId, r.paCount]));

    const totalGames = games.length;
    const activeGames = games.filter((game) => game.status === "active").length;
    const finalGames = games.filter((game) => game.status === "final").length;
    const draftGames = games.filter((game) => game.status === "draft").length;

    const filteredGames = games.filter((game) => {
        const matchesStatus = statusFilter === "all" ? true : game.status === statusFilter;
        const matchesType = typeFilter === "all" ? true : game.sessionType === typeFilter;
        return matchesStatus && matchesType && matchesQuery(game, searchQuery);
    });

    const hasFilters = statusFilter !== "all" || typeFilter !== "all" || searchQuery.trim().length > 0;

    return (
        <LeaderboardPageFrame maxWidth="max-w-6xl">
            <LeaderboardIntro breadcrumbs={[{ label: "Home", href: "/" }, { label: "Charting" }]}>
                <section className="mt-6">
                    <div className="relative overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-zinc-950/80 shadow-2xl shadow-black/30">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(34,197,94,0.10),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]" />
                        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

                        <div className="relative grid gap-5 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
                            <div className="min-w-0">
                                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
                                    <ClipboardList className="h-3.5 w-3.5" />
                                    Charting
                                </div>
                                <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-zinc-50 sm:text-[2.9rem] sm:leading-[1.02]">
                                    Charting Hub
                                </h1>
                                <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-[14px]">
                                    Run the live charting workflow, reopen active games, and move straight into leaderboard review.
                                </p>
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <LeaderboardPill tone="emerald">
                                        {totalGames} game{totalGames === 1 ? "" : "s"}
                                    </LeaderboardPill>
                                    <LeaderboardPill tone="neutral">
                                        {filteredGames.length} shown
                                    </LeaderboardPill>
                                    <LeaderboardPill tone="neutral">
                                        {statusFilter === "all" ? "All statuses" : `${statusFilter} only`}
                                    </LeaderboardPill>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                <Link href="/charting/leaderboard" className="block">
                                    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-sky-500/25">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
                                                <BarChart3 className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                                    Analysis
                                                </div>
                                                <div className="mt-1 text-sm font-semibold text-zinc-100">
                                                    Open Leaderboards
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>

                                <Link href="/charting/insights" className="block">
                                    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-teal-500/25">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-teal-500/20 bg-teal-500/10 text-teal-300">
                                                <Target className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                                    Insights
                                                </div>
                                                <div className="mt-1 text-sm font-semibold text-zinc-100">
                                                    Open Player Visuals
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>

                                <Link href="/charting/new" className="block">
                                    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-emerald-500/25">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                                                <Plus className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                                    Workflow
                                                </div>
                                                <div className="mt-1 text-sm font-semibold text-zinc-100">
                                                    Start New Game
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </LeaderboardIntro>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <LeaderboardStatBlock
                    label="Active Games"
                    value={String(activeGames)}
                    detail="Live sessions ready to reopen."
                    emphasisClassName="text-emerald-300"
                />
                <LeaderboardStatBlock
                    label="Final Games"
                    value={String(finalGames)}
                    detail="Completed charting sessions."
                    emphasisClassName="text-sky-300"
                />
                <LeaderboardStatBlock
                    label="Draft Games"
                    value={String(draftGames)}
                    detail="Sessions still awaiting cleanup."
                    emphasisClassName="text-orange-300"
                />
                <LeaderboardStatBlock
                    label="Filtered View"
                    value={String(filteredGames.length)}
                    detail="Games matching the current toolbar filters."
                    emphasisClassName="text-zinc-100"
                />
            </div>

            <LeaderboardToolbar className="mt-6">
                <form action="/charting" className="grid gap-4 xl:grid-cols-[minmax(12rem,14rem)_minmax(10rem,12rem)_minmax(0,1fr)_auto] xl:items-end">
                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                            Status
                        </div>
                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                            <select
                                name="status"
                                defaultValue={statusFilter}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none"
                            >
                                <option value="all">All statuses</option>
                                <option value="active">Active</option>
                                <option value="final">Final</option>
                                <option value="draft">Draft</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                            Type
                        </div>
                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                            <select
                                name="type"
                                defaultValue={typeFilter}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none"
                            >
                                <option value="game">Games</option>
                                <option value="all">All types</option>
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
                                type="text"
                                name="q"
                                defaultValue={searchQuery}
                                placeholder="Search opponent, date, or status..."
                                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                        <button
                            type="submit"
                            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 transition-smooth hover:border-emerald-400/35 hover:bg-emerald-500/15"
                        >
                            Apply Filters
                        </button>
                        {hasFilters ? (
                            <Link
                                href="/charting"
                                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
                            >
                                Clear
                            </Link>
                        ) : null}
                    </div>
                </form>
            </LeaderboardToolbar>

            {games.length === 0 ? (
                <LeaderboardPanel className="mt-6 flex flex-col items-center justify-center py-24 text-center">
                    <ClipboardList className="mb-4 h-[68px] w-[68px] stroke-1 text-zinc-500" />
                    <h2 className="mb-2 text-xl font-bold text-white">No Games Yet</h2>
                    <p className="mb-8 max-w-xs text-[15px] text-zinc-500">
                        Start a new charting session to populate the hub.
                    </p>
                    <Link
                        href="/charting/new"
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/15 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-colors hover:border-emerald-400/35 hover:bg-emerald-500/20"
                    >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                        New Game
                    </Link>
                </LeaderboardPanel>
            ) : filteredGames.length === 0 ? (
                <LeaderboardPanel className="mt-6 flex flex-col items-center justify-center py-20 text-center">
                    <Search className="mb-4 h-12 w-12 text-zinc-600" />
                    <h2 className="text-xl font-bold text-white">No Matches</h2>
                    <p className="mt-2 max-w-sm text-sm text-zinc-500">
                        No charting games match the current search and status filters.
                    </p>
                    <Link
                        href="/charting"
                        className="mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-700/70 bg-zinc-900/70 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800/80"
                    >
                        Clear Filters
                    </Link>
                </LeaderboardPanel>
            ) : (
                <LeaderboardPanel className="mt-6 overflow-hidden p-0">
                    <div className="border-b border-white/5 px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <LeaderboardPill tone="brand">
                                {filteredGames.length} visible
                            </LeaderboardPill>
                            {activeGames > 0 ? (
                                <LeaderboardPill tone="emerald">
                                    {activeGames} active
                                </LeaderboardPill>
                            ) : null}
                        </div>
                    </div>

                    <ul className="divide-y divide-white/5">
                        {filteredGames.map((game) => (
                            <li key={game.id} className="group relative">
                                <div className="flex flex-col gap-4 p-5 transition-colors hover:bg-emerald-500/5 md:flex-row md:items-center md:justify-between">
                                    <Link
                                        href={`/charting/games/${game.id}`}
                                        className="absolute inset-0 z-10"
                                        aria-label={`View data for game against ${game.opponent || "Unnamed Game"}`}
                                    />

                                    <div className="relative z-20 min-w-0 flex-1 pr-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <StatusBadge status={game.status} />
                                            <TypeBadge sessionType={game.sessionType} />
                                            {(() => {
                                                const pa = paCountByGame.get(game.id) ?? 0;
                                                return pa > 0 ? (
                                                    <LeaderboardPill tone="neutral">
                                                        {pa} PA{pa !== 1 ? "s" : ""}
                                                    </LeaderboardPill>
                                                ) : null;
                                            })()}
                                        </div>

                                        <div className="mt-3 flex flex-col gap-1">
                                            <h3 className="truncate text-[18px] font-semibold text-white">
                                                <EditableChartingGameNameInList
                                                    gameId={game.id}
                                                    initialOpponent={game.opponent}
                                                    initialGameDate={game.gameDate}
                                                    revision={game.revision}
                                                />
                                            </h3>
                                            <p className="text-sm text-zinc-500">
                                                {format(parseISO(game.gameDate), "EEEE, MMMM d, yyyy")}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="relative z-20 flex flex-wrap items-center gap-2">
                                        <Link
                                            href={`/charting/games/${game.id}`}
                                            className="inline-flex items-center gap-2 rounded-full border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:border-zinc-500/60 hover:bg-zinc-700/70 hover:text-white"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Overview
                                        </Link>
                                        <Link
                                            href={`/charting/games/${game.id}/edit`}
                                            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 transition-colors hover:border-emerald-400/35 hover:bg-emerald-500/15"
                                        >
                                            <FilePenLine className="h-3.5 w-3.5" />
                                            Edit
                                        </Link>
                                        <ChevronRight className="ml-1 h-5 w-5 text-zinc-600" />
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </LeaderboardPanel>
            )}
        </LeaderboardPageFrame>
    );
}
