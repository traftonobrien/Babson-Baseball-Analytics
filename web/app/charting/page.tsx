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
import { DeleteChartingGameButton } from "@/app/charting/_components/DeleteChartingGameButton";

export const revalidate = 0; // Always fetch fresh data

function StatusBadge({ status }: { status: string }) {
    if (status === "active") {
        return (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize bg-emerald-500 text-white">
                Active
            </span>
        );
    }
    if (status === "final") {
        return (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize bg-blue-500 text-white">
                Final
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize bg-orange-500 text-white">
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
        <main className="min-h-screen bg-zinc-950 text-zinc-100">
            <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

                {/* iOS-style Navigation Header */}
                <div className="mb-6 flex items-end justify-between">
                    <h1 className="text-[34px] font-bold tracking-tight text-white leading-none">
                        Games
                    </h1>
                    <Link
                        href="/charting/new"
                        className="text-emerald-500 hover:text-emerald-400 transition-colors pb-1"
                        aria-label="New Game"
                    >
                        <Plus className="h-[26px] w-[26px]" strokeWidth={2.5} />
                    </Link>
                </div>

                {games.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center mt-12">
                        <ClipboardList className="h-[68px] w-[68px] text-zinc-500 mb-4 stroke-1" />
                        <h2 className="text-xl font-bold text-white mb-2">No Games</h2>
                        <p className="text-zinc-500 text-[15px] max-w-xs mb-8">
                            Create a new game or pull down to refresh from the server.
                        </p>
                        <Link
                            href="/charting/new"
                            className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-8 font-semibold text-white transition-colors hover:bg-emerald-500 shadow-sm text-[15px]"
                        >
                            New Game
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-[14px] bg-zinc-900/80 ring-1 ring-white/5">
                        <ul className="divide-y divide-white/5">
                            {games.map((game) => (
                                <li key={game.id} className="group relative">
                                    <div className="flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/60">
                                        <Link
                                            href={`/charting/games/${game.id}`}
                                            className="absolute inset-0 z-10"
                                            aria-label={`View data for game against ${game.opponent}`}
                                        />

                                        <div className="flex flex-col gap-1 pr-4">
                                            <h3 className="text-[17px] font-semibold text-white">
                                                vs {game.opponent}
                                            </h3>
                                            <div className="flex items-center gap-2 text-[15px] text-zinc-500">
                                                <span>
                                                    {format(parseISO(game.gameDate), "MMM d, yyyy")}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 z-20">
                                            <StatusBadge status={game.status} />

                                            {/* Suble Actions (Visible on hover on desktop, or can just be revealed) */}
                                            <div className="hidden sm:flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                                <Link
                                                    href={`/charting/games/${game.id}/edit`}
                                                    className="rounded-lg bg-zinc-800/80 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-zinc-700 transition-colors"
                                                >
                                                    Edit
                                                </Link>
                                                <DeleteChartingGameButton
                                                    gameId={game.id}
                                                    opponent={game.opponent}
                                                    gameDate={format(parseISO(game.gameDate), "MMM d, yyyy")}
                                                    compact
                                                />
                                            </div>

                                            <ChevronRight className="h-5 w-5 text-zinc-600 ml-1" />
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </main>
    );
}
