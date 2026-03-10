"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Search, Trophy } from "lucide-react";
import { LeaderboardToolbar, LeaderboardIntro, LeaderboardHero, LeaderboardPill } from "@/app/components/leaderboards/LeaderboardChrome";
import Link from "next/link";
import { type StatGroup } from "./HitterLeaderboardTable";

interface GameInfo {
    id: string;
    gameDate: string;
    opponent: string | null;
}

export function LeaderboardClientState({
    tab,
    range,
    session,
    searchQuery,
    games,
    statGroup,
    setStatGroup,
}: {
    tab: string;
    range: string;
    session: string;
    searchQuery: string;
    games: GameInfo[];
    statGroup?: StatGroup;
    setStatGroup?: (value: StatGroup) => void;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    function updateQuery(updates: Record<string, string>) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        }
        // If we changed session, clear range
        if (updates.session && updates.session !== "all") {
            params.delete("range");
        }
        // If we changed range to something real, clear session
        if (updates.range && updates.range !== "all") {
            params.delete("session");
        }
        router.push(`${pathname}?${params.toString()}`);
    }

    return (
        <>
            <LeaderboardIntro
                breadcrumbs={[
                    { label: "Home", href: "/" },
                    { label: "Charting", href: "/charting" },
                    { label: "Leaderboard" },
                ]}
            >
                <LeaderboardHero
                    tone="emerald"
                    icon={Trophy}
                    eyebrow="Charting"
                    title={<>Live AB Leaderboard</>}
                    meta={(
                        <>
                            <LeaderboardPill tone="emerald">
                                {tab === "pitchers" ? "Pitchers" : "Hitters"}
                            </LeaderboardPill>
                            <LeaderboardPill tone="neutral">
                                {session === "all" ? (range === "all" ? "All Time" : range === "7d" ? "Last 7 Days" : "Last 30 Days") : "Single Session"}
                            </LeaderboardPill>
                        </>
                    )}
                    side={(
                        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] flex flex-col items-center justify-center text-center">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Back</div>
                            <Link
                                href="/charting"
                                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3.5 text-sm font-semibold text-emerald-300 transition-smooth hover:border-emerald-400/40 hover:text-emerald-200"
                            >
                                Charting Hub
                            </Link>
                        </div>
                    )}
                />
            </LeaderboardIntro>

            <div className="flex items-center gap-1 border-b border-zinc-800/80 px-2 mt-4">
                <button
                    onClick={() => updateQuery({ tab: "pitchers" })}
                    className={`px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-colors ${tab === "pitchers"
                        ? "border-b-2 border-emerald-500 text-emerald-400"
                        : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-300"
                        }`}
                >
                    Pitchers
                </button>
                <button
                    onClick={() => updateQuery({ tab: "hitters" })}
                    className={`px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-colors ${tab === "hitters"
                        ? "border-b-2 border-emerald-500 text-emerald-400"
                        : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-300"
                        }`}
                >
                    Hitters
                </button>
            </div>

            <LeaderboardToolbar className="mt-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(12rem,14rem)_minmax(14rem,18rem)_minmax(0,1fr)_auto] xl:items-end">

                    {tab === "hitters" ? (
                        <div className="space-y-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                                Stat Group
                            </div>
                            <div className="flex items-center">
                                <div className="inline-flex rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-1">
                                    <button
                                        onClick={() => setStatGroup?.("basic")}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${statGroup === "basic"
                                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                            : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                                            }`}
                                    >
                                        Basic
                                    </button>
                                    <button
                                        onClick={() => setStatGroup?.("advanced")}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${statGroup === "advanced"
                                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                            : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                                            }`}
                                    >
                                        Advanced
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                            Date Range
                        </div>
                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                            <select
                                value={session !== "all" ? "all" : range}
                                disabled={session !== "all"}
                                onChange={(e) => updateQuery({ range: e.target.value })}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none disabled:opacity-50"
                            >
                                <option value="all">All Time</option>
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                            Session
                        </div>
                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                            <select
                                value={session}
                                onChange={(e) => updateQuery({ session: e.target.value })}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none"
                            >
                                <option value="all">All Sessions</option>
                                {games.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.opponent || "Live AB"} — {format(parseISO(g.gameDate), "M/d/yy")}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                            Search
                        </div>
                        <label className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] focus-within:ring-1 focus-within:ring-emerald-500/50">
                            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                            <input
                                type="text"
                                placeholder={tab === "pitchers" ? "Search pitchers..." : "Search hitters..."}
                                value={searchQuery}
                                onChange={(e) => updateQuery({ q: e.target.value })}
                                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                        {searchQuery.trim() || range !== "all" || session !== "all" ? (
                            <button
                                type="button"
                                onClick={() => {
                                    const params = new URLSearchParams(searchParams.toString());
                                    params.delete("q");
                                    params.delete("range");
                                    params.delete("session");
                                    router.push(`${pathname}?${params.toString()}`);
                                }}
                                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                            >
                                Clear Filters
                            </button>
                        ) : null}
                    </div>
                </div>
            </LeaderboardToolbar>
        </>
    );
}
