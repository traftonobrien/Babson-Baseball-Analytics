import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
    ChevronRight,
    ClipboardList,
    Plus,
} from "lucide-react";
import { db } from "@/db";
import { chartingGames } from "@/db/schema";
import { desc } from "drizzle-orm";
import { LeaderboardIntro, LeaderboardPageFrame, LeaderboardPanel, LeaderboardPill } from "@/app/components/leaderboards/LeaderboardChrome";
import { EditableChartingGameNameInList } from "@/app/charting/_components/EditableChartingGameNameInList";

export const revalidate = 0; // Always fetch fresh data

function StatusBadge({ status }: { status: string }) {
    if (status === "active") {
        return <LeaderboardPill tone="emerald">Active</LeaderboardPill>;
    }
    if (status === "final") {
        return <LeaderboardPill tone="blue">Final</LeaderboardPill>;
    }
    return <LeaderboardPill tone="orange">Draft</LeaderboardPill>;
}

export default async function ChartingHubPage() {
    const games = await db
        .select()
        .from(chartingGames)
        .orderBy(desc(chartingGames.gameDate));

    return (
        <LeaderboardPageFrame maxWidth="max-w-3xl">
            <LeaderboardIntro
                breadcrumbs={[{ label: "Home", href: "/" }, { label: "Charting" }]}
                actions={
                    <Link
                        href="/charting/new"
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-colors hover:border-emerald-400/35 hover:bg-emerald-500/15"
                        aria-label="New Game"
                    >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        New Game
                    </Link>
                }
            >
                <section>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Games</h1>
                </section>
            </LeaderboardIntro>

            {games.length === 0 ? (
                <LeaderboardPanel className="mt-6 flex flex-col items-center justify-center py-24 text-center">
                    <ClipboardList className="h-[68px] w-[68px] text-zinc-500 mb-4 stroke-1" />
                    <h2 className="text-xl font-bold text-white mb-2">No Games</h2>
                    <p className="text-zinc-500 text-[15px] max-w-xs mb-8">
                        Create a new game or pull down to refresh from the server.
                    </p>
                    <Link
                        href="/charting/new"
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/15 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-colors hover:border-emerald-400/35 hover:bg-emerald-500/20"
                    >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                        New Game
                    </Link>
                </LeaderboardPanel>
            ) : (
                <LeaderboardPanel className="mt-6 overflow-hidden p-0">
                    <ul className="divide-y divide-white/5">
                            {games.map((game) => (
                                <li key={game.id} className="group relative">
                                    <div className="flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/60">
                                        <Link
                                            href={`/charting/games/${game.id}`}
                                            className="absolute inset-0 z-10"
                                            aria-label={`View data for game against ${game.opponent}`}
                                        />

                                        <div className="flex items-center gap-3 pr-4">
                                            <StatusBadge status={game.status} />
                                            <div className="flex flex-col gap-1">
                                                <h3 className="text-[17px] font-semibold">
                                                    <EditableChartingGameNameInList
                                                        gameId={game.id}
                                                        initialOpponent={game.opponent}
                                                        revision={game.revision}
                                                    />
                                                </h3>
                                                <div className="flex items-center gap-2 text-[15px] text-zinc-500">
                                                    <span>
                                                        {format(parseISO(game.gameDate), "MMM d, yyyy")}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 z-20">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/charting/games/${game.id}`}
                                                    className="inline-flex items-center rounded-full border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:border-zinc-500/60 hover:bg-zinc-700/70 hover:text-white"
                                                >
                                                    Overview
                                                </Link>
                                                <Link
                                                    href={`/charting/games/${game.id}/edit`}
                                                    className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 transition-colors hover:border-emerald-400/35 hover:bg-emerald-500/15"
                                                >
                                                    Edit
                                                </Link>
                                            </div>

                                            <ChevronRight className="h-5 w-5 text-zinc-600 ml-1" />
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
