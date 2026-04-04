"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { BarChart3, BookOpen, ClipboardList, Search } from "lucide-react";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { HubActionCard } from "@/app/components/hub/HubHeader";
import { LeaderboardExportPdfButton } from "@/app/components/leaderboards/LeaderboardExportPdfButton";
import { LeaderboardToolbar } from "@/app/components/leaderboards/LeaderboardChrome";
import { cn } from "@/lib/utils";
import type { StatGroup } from "./types";

interface GameInfo {
    id: string;
    gameDate: string;
    opponent: string | null;
}

function lightPill(active: boolean): string {
    return cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active
            ? "bg-surface text-slate-900 dark:text-zinc-50 shadow-sm"
            : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-50",
    );
}

export function LeaderboardClientState({
    tab,
    range,
    session,
    searchQuery,
    games,
    statGroup,
    onStatGroupChange,
    scopeLabel,
    scopeGameCount,
}: {
    tab: string;
    range: string;
    session: string;
    searchQuery: string;
    games: GameInfo[];
    statGroup: StatGroup;
    onStatGroupChange: (value: StatGroup) => void;
    scopeLabel: string;
    scopeGameCount: number;
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
        statGroup !== "basic";

    return (
        <div className="leaderboard-print-root font-display flex flex-col gap-6">
            <Breadcrumbs
                className="leaderboard-print-hide"
                variant="light"
                items={[
                    { label: "Home", href: "/" },
                    { label: "Charting", href: "/charting" },
                    { label: "Leaderboard" },
                ]}
            />

            <header className="leaderboard-print-panel rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6 sm:p-7">
                    <div className="min-w-0 flex-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800">
                            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                            Charting
                        </div>
                        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.85rem] sm:leading-[1.02]">
                            Charting Leaderboard
                        </h1>
                        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                            Game-only charting process board · {scopeLabel} · {scopeGameCount} game{scopeGameCount === 1 ? "" : "s"} in scope
                        </p>
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
                        <LeaderboardExportPdfButton
                            fileStem={`charting_leaderboard_${tab}_${statGroup}_${session !== "all" ? "game" : range}`}
                            className="w-full sm:ml-auto sm:w-auto"
                        />
                        <div className="leaderboard-print-hide grid grid-cols-2 gap-3">
                            <HubActionCard
                                href="/charting"
                                icon={ClipboardList}
                                sectionTitle="Charting hub"
                                buttonLabel="Open Hub"
                            />
                            <HubActionCard
                                href="/charting/faq"
                                icon={BookOpen}
                                sectionTitle="Dictionary"
                                buttonLabel="Metrics FAQ"
                            />
                        </div>
                    </div>
                </div>
            </header>

            <LeaderboardToolbar variant="light" className="leaderboard-print-hide">
                <div className="flex min-w-0 flex-col gap-5">
                    <div className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-2">
                        <div className="min-w-0 space-y-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
                                Leaderboard View
                            </div>
                            <div className="rounded-full border border-slate-100 dark:border-zinc-800 bg-background p-1">
                                <div className="grid grid-cols-2 gap-1">
                                    <button
                                        type="button"
                                        onClick={() => updateQuery({ tab: "pitchers" })}
                                        className={lightPill(tab === "pitchers")}
                                    >
                                        Pitchers
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateQuery({ tab: "hitters" })}
                                        className={lightPill(tab === "hitters")}
                                    >
                                        Hitters
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="min-w-0 space-y-2 min-[700px]:col-span-2 xl:col-span-1">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
                                Stat Group
                            </div>
                            <div className="rounded-full border border-slate-100 dark:border-zinc-800 bg-background p-1">
                                <div className="grid grid-cols-2 gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onStatGroupChange("basic");
                                            updateQuery({ statGroup: "" }, true);
                                        }}
                                        className={lightPill(statGroup === "basic")}
                                    >
                                        {tab === "pitchers" ? "Attack" : "Decisions"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onStatGroupChange("advanced");
                                            updateQuery({ statGroup: "advanced" }, true);
                                        }}
                                        className={lightPill(statGroup === "advanced")}
                                    >
                                        {tab === "pitchers" ? "Miss / Chase" : "Pitch-Type Miss"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)] lg:items-end">
                        <div className="min-w-0 space-y-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
                                Date Range
                            </div>
                            <div className="rounded-full border border-slate-100 dark:border-zinc-800 bg-background p-1">
                                <select
                                    value={session !== "all" ? "all" : range}
                                    disabled={session !== "all"}
                                    onChange={(event) => updateQuery({ range: event.target.value })}
                                    className="h-11 w-full rounded-full border border-slate-200 dark:border-zinc-700 bg-surface px-4 text-sm font-semibold text-slate-900 dark:text-zinc-50 outline-none disabled:opacity-50"
                                >
                                    <option value="all">All Time</option>
                                    <option value="7d">Last 7 Days</option>
                                    <option value="30d">Last 30 Days</option>
                                </select>
                            </div>
                        </div>

                        <div className="min-w-0 space-y-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
                                Game
                            </div>
                            <div className="rounded-full border border-slate-100 dark:border-zinc-800 bg-background p-1">
                                <select
                                    value={session}
                                    onChange={(event) => updateQuery({ session: event.target.value })}
                                    className="h-11 w-full max-w-full rounded-full border border-slate-200 dark:border-zinc-700 bg-surface px-4 text-sm font-semibold text-slate-900 dark:text-zinc-50 outline-none"
                                >
                                    <option value="all">All Games</option>
                                    {games.map((game) => (
                                        <option key={game.id} value={game.id}>
                                            {game.opponent || "Unnamed Game"} — {format(parseISO(game.gameDate), "M/d/yy")}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-end">
                        <div className="min-w-0 flex-1 space-y-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
                                Search
                            </div>
                            <label className="flex h-11 items-center gap-3 rounded-full border border-slate-200 bg-slate-100 px-4 shadow-sm transition-all focus-within:border-emerald-300 focus-within:bg-surface dark:border-zinc-700 dark:bg-zinc-900/70 dark:focus-within:border-emerald-500/60">
                                <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder={tab === "pitchers" ? "Search pitcher..." : "Search hitter..."}
                                    value={searchInput}
                                    onChange={(event) => setSearchInput(event.target.value)}
                                    className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                                />
                            </label>
                        </div>
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
                                    pushParams(params);
                                }}
                                className="h-11 shrink-0 rounded-full border border-slate-200 bg-surface px-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm transition-smooth hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                            >
                                Clear
                            </button>
                        ) : null}
                    </div>
                </div>
            </LeaderboardToolbar>
        </div>
    );
}
