"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { BarChart3, BookOpen, ClipboardList, Search } from "lucide-react";
import {
    LeaderboardHero,
    LeaderboardIntro,
    LeaderboardPill,
    LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";
import type { StatGroup } from "./types";

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
    onStatGroupChange,
    rowCount,
    scopeLabel,
    scopeGameCount,
    sessionType = "game",
}: {
    tab: string;
    range: string;
    session: string;
    searchQuery: string;
    games: GameInfo[];
    statGroup: StatGroup;
    onStatGroupChange: (value: StatGroup) => void;
    rowCount: number;
    scopeLabel: string;
    scopeGameCount: number;
    sessionType?: "live_ab" | "game" | "all";
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [searchInput, setSearchInput] = useState(searchQuery);
    const deferredSearchInput = useDeferredValue(searchInput);

    useEffect(() => {
        setSearchInput(searchQuery);
    }, [searchQuery]);

    useEffect(() => {
        if (deferredSearchInput === searchQuery) {
            return;
        }
        const params = new URLSearchParams(searchParams.toString());
        if (deferredSearchInput) {
            params.set("q", deferredSearchInput);
        } else {
            params.delete("q");
        }
        const nextQuery = params.toString();
        const target = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        startTransition(() => {
            router.replace(target);
        });
    }, [deferredSearchInput, pathname, router, searchParams, searchQuery]);

    function pushParams(nextParams: URLSearchParams, replace = false) {
        const nextQuery = nextParams.toString();
        const target = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        startTransition(() => {
            if (replace) {
                router.replace(target);
                return;
            }
            router.push(target);
        });
    }

    function updateQuery(updates: Record<string, string>, replace = false) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        }

        if (updates.session && updates.session !== "all") {
            params.delete("range");
        }
        if (updates.range && updates.range !== "all") {
            params.delete("session");
        }

        pushParams(params, replace);
    }

    const hasFilters =
        searchInput.trim().length > 0 ||
        range !== "all" ||
        session !== "all" ||
        statGroup !== "basic" ||
        sessionType !== "game";

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
                    icon={BarChart3}
                    eyebrow="Charting"
                    title={<>Charting Leaderboard</>}
                    meta={(
                        <>
                            <LeaderboardPill tone="emerald">
                                {tab === "pitchers" ? "Pitchers" : "Hitters"}
                            </LeaderboardPill>
                            <LeaderboardPill tone="neutral">{scopeLabel}</LeaderboardPill>
                            <LeaderboardPill tone="neutral">
                                {scopeGameCount} session{scopeGameCount === 1 ? "" : "s"} in scope
                            </LeaderboardPill>
                            <LeaderboardPill tone="neutral">
                                {rowCount} {tab === "pitchers" ? "pitcher" : "hitter"}{rowCount === 1 ? "" : "s"}
                            </LeaderboardPill>
                        </>
                    )}
                    side={(
                        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                                Resources
                            </div>
                            <div className="mt-3 grid gap-3">
                                <Link
                                    href="/charting"
                                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3.5 text-sm font-semibold text-emerald-300 transition-smooth hover:border-emerald-400/40 hover:text-emerald-200"
                                >
                                    <ClipboardList className="h-4 w-4" />
                                    Charting Hub
                                </Link>
                                <Link
                                    href="/charting/faq"
                                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-900/80 px-4 py-3.5 text-sm font-semibold text-zinc-200 transition-smooth hover:border-emerald-400/30 hover:text-emerald-200"
                                >
                                    <BookOpen className="h-4 w-4" />
                                    Metrics Dictionary
                                </Link>
                            </div>
                        </div>
                    )}
                />
            </LeaderboardIntro>

            <LeaderboardToolbar>
                <div className="grid gap-4 xl:grid-cols-[minmax(11rem,13rem)_minmax(13rem,15rem)_minmax(13rem,15rem)_minmax(12rem,14rem)_minmax(14rem,18rem)_minmax(0,1fr)_auto] xl:items-end">
                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                            Session Type
                        </div>
                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                            <div className="grid grid-cols-3 gap-1">
                                <button
                                    type="button"
                                    onClick={() => updateQuery({ sessionType: "game", session: "all" })}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-smooth ${sessionType === "game"
                                        ? "border border-sky-500/25 bg-sky-500/10 text-sky-300"
                                        : "border border-transparent text-zinc-400 hover:text-zinc-100"
                                        }`}
                                >
                                    Games
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateQuery({ sessionType: "live_ab", session: "all" })}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-smooth ${sessionType === "live_ab"
                                        ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                        : "border border-transparent text-zinc-400 hover:text-zinc-100"
                                        }`}
                                >
                                    Live AB
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateQuery({ sessionType: "all", session: "all" })}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-smooth ${sessionType === "all"
                                        ? "border border-zinc-600/50 bg-zinc-800/50 text-zinc-200"
                                        : "border border-transparent text-zinc-400 hover:text-zinc-100"
                                        }`}
                                >
                                    All
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                            Leaderboard View
                        </div>
                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                            <div className="grid grid-cols-2 gap-1">
                                <button
                                    type="button"
                                    onClick={() => updateQuery({ tab: "pitchers" })}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-smooth ${tab === "pitchers"
                                        ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                        : "border border-transparent text-zinc-400 hover:text-zinc-100"
                                        }`}
                                >
                                    Pitchers
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateQuery({ tab: "hitters" })}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-smooth ${tab === "hitters"
                                        ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                        : "border border-transparent text-zinc-400 hover:text-zinc-100"
                                        }`}
                                >
                                    Hitters
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                            Stat Group
                        </div>
                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                            <div className="grid grid-cols-2 gap-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onStatGroupChange("basic");
                                        updateQuery({ statGroup: "" }, true);
                                    }}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-smooth ${statGroup === "basic"
                                        ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                        : "border border-transparent text-zinc-400 hover:text-zinc-100"
                                        }`}
                                >
                                    Basic
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onStatGroupChange("advanced");
                                        updateQuery({ statGroup: "advanced" }, true);
                                    }}
                                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-smooth ${statGroup === "advanced"
                                        ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                        : "border border-transparent text-zinc-400 hover:text-zinc-100"
                                        }`}
                                >
                                    Advanced
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                            Date Range
                        </div>
                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                            <select
                                value={session !== "all" ? "all" : range}
                                disabled={session !== "all"}
                                onChange={(event) => updateQuery({ range: event.target.value })}
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
                                onChange={(event) => updateQuery({ session: event.target.value })}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none"
                            >
                                <option value="all">All Sessions</option>
                                {games.map((game) => (
                                    <option key={game.id} value={game.id}>
                                        {game.opponent || "Unnamed Game"} — {format(parseISO(game.gameDate), "M/d/yy")}
                                    </option>
                                ))}
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
                                placeholder={tab === "pitchers" ? "Search pitcher..." : "Search hitter..."}
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                        {hasFilters ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchInput("");
                                    onStatGroupChange("basic");

                                    const params = new URLSearchParams(searchParams.toString());
                                    params.set("tab", tab);
                                    params.delete("range");
                                    params.delete("session");
                                    params.delete("q");
                                    params.delete("statGroup");
                                    params.set("sessionType", "game");
                                    pushParams(params);
                                }}
                                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
                            >
                                Clear
                            </button>
                        ) : null}
                    </div>
                </div>
            </LeaderboardToolbar>
        </>
    );
}
