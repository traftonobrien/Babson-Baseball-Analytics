import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ChevronRight, ClipboardList, PenTool, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { chartingGames } from "@/db/schema";
import { desc } from "drizzle-orm";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import Header from "@/app/components/Header";

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
                        Select a synced game to view the lineup, pitch logs, and analytics.
                    </p>
                </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-xl">
                {games.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <ClipboardList className="h-12 w-12 text-zinc-600 mb-4" />
                        <p className="text-zinc-400 font-medium text-lg mb-1">
                            No games found
                        </p>
                        <p className="text-zinc-500 text-sm">
                            Use the iPad app to chart a new game and sync it to the portal.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800/60">
                        {games.map((game) => (
                            <Link
                                key={game.id}
                                href={`/charting/games/${game.id}`}
                                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-zinc-800/40 transition-colors"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">
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
                                <div className="flex items-center text-zinc-500 group-hover:text-emerald-400 transition-colors">
                                    <span className="text-sm font-medium mr-2">View Data</span>
                                    <ChevronRight className="h-4 w-4" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </LeaderboardPageFrame>
    );
}
