import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
    ChevronRight,
    ClipboardList,
    PenTool,
    Plus,
    ShieldCheck,
} from "lucide-react";
import { db } from "@/db";
import { chartingGames } from "@/db/schema";
import { desc } from "drizzle-orm";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { DeleteChartingGameButton } from "@/app/charting/_components/DeleteChartingGameButton";

export const revalidate = 0; // Always fetch fresh data

function StatusBadge({ status }: { status: string }) {
    if (status === "final") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Final
            </span>
        );
    }
    if (status === "active") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-300">
                <PenTool className="h-3.5 w-3.5" />
                Live
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
            Draft
        </span>
    );
}

export default async function ChartingHubPage() {
    const games = await db
        .select()
        .from(chartingGames)
        .orderBy(desc(chartingGames.gameDate));

    return (
        <LeaderboardPageFrame maxWidth="max-w-5xl">
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white mb-2">
                        Charting Hub
                    </h1>
                    <p className="text-zinc-400">
                        Create a game on the portal, jump into the editor, or open any synced game for review.
                    </p>
                </div>
                <Link
                    href="/charting/new"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/15 hover:text-white"
                >
                    <Plus className="h-4 w-4" />
                    New Game
                </Link>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-xl">
                {games.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <ClipboardList className="h-12 w-12 text-zinc-600 mb-4" />
                        <p className="text-zinc-400 font-medium text-lg mb-1">
                            No games found
                        </p>
                        <p className="text-zinc-500 text-sm">
                            Start a new portal charting session to create the game shell and open the web editor.
                        </p>
                        <Link
                            href="/charting/new"
                            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/15 hover:text-white"
                        >
                            <Plus className="h-4 w-4" />
                            Create First Game
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800/60">
                        {games.map((game) => (
                            <div
                                key={game.id}
                                className="group flex flex-col gap-4 p-5 transition-colors hover:bg-zinc-800/40 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-bold text-zinc-100 transition-colors group-hover:text-emerald-400">
                                            {game.opponent}
                                        </h3>
                                        <StatusBadge status={game.status} />
                                    </div>
                                    <div className="text-sm text-zinc-400 flex items-center gap-3">
                                        <span>
                                            {format(parseISO(game.gameDate), "EEEE, MMMM do, yyyy")}
                                        </span>
                                        {game.charter && (
                                            <>
                                                <span className="text-zinc-600">•</span>
                                                <span>{game.charter}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Link
                                        href={`/charting/games/${game.id}/edit`}
                                        className="inline-flex h-10 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/15 hover:text-white"
                                    >
                                        Open Editor
                                    </Link>
                                    <DeleteChartingGameButton
                                        gameId={game.id}
                                        opponent={game.opponent}
                                        gameDate={format(parseISO(game.gameDate), "MMMM do, yyyy")}
                                        compact
                                    />
                                    <Link
                                        href={`/charting/games/${game.id}`}
                                        className="inline-flex items-center text-zinc-500 transition-colors group-hover:text-emerald-400"
                                    >
                                        <span className="mr-2 text-sm font-medium">View Data</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </LeaderboardPageFrame>
    );
}
