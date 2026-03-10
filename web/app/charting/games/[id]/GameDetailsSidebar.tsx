import { Calendar, Cloud, Crosshair, UserCircle, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ChartingGame, ChartingLineupEntry } from "@/lib/charting/types";
import type { PitcherOverviewModel } from "@/lib/charting/sessionOverview";

export function GameDetailsSidebar({
    game,
    pitcherOverviewModels,
    lineupEntries,
}: {
    game: ChartingGame;
    pitcherOverviewModels: PitcherOverviewModel[];
    lineupEntries: ChartingLineupEntry[];
}) {
    // Current "Live" match up, grabbing the last ones from lists or just generally describing what's happening.
    // In a fully live scenario we might track the active pitcher/hitter specifically, but here we can just show the most recent.
    const activePitcher = pitcherOverviewModels.length > 0 ? pitcherOverviewModels[0].displayName : "Unknown";
    const activeHitter = lineupEntries.length > 0 ? lineupEntries[0].hitterName : "Unknown";

    return (
        <div className="flex flex-col gap-4">
            {/* Game Details */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Game Details
                </h3>
                <dl className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-zinc-500 shrink-0" />
                        <span className="text-zinc-300">
                            {format(parseISO(game.gameDate), "MMM do, yyyy")}
                        </span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-800/50 pt-3">
                        <dt className="text-zinc-500 flex items-center gap-2"><UserCircle className="h-3.5 w-3.5" /> Charter</dt>
                        <dd className="text-zinc-200 font-medium">{game.charter || "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-zinc-500 flex items-center gap-2"><Cloud className="h-3.5 w-3.5" /> Weather</dt>
                        <dd className="text-zinc-200 font-medium">{game.weather || "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-zinc-500 flex items-center gap-2"><Crosshair className="h-3.5 w-3.5" /> Home Catcher</dt>
                        <dd className="text-zinc-200 font-medium">{game.homeCatcher || "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-zinc-500 flex items-center gap-2"><Crosshair className="h-3.5 w-3.5" /> Away Catcher</dt>
                        <dd className="text-zinc-200 font-medium">{game.awayCatcher || "—"}</dd>
                    </div>
                </dl>
            </div>

            {/* Live Matchup */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Current At-Bat
                </h3>
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-emerald-400 uppercase tracking-widest text-[10px] border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded">Live</span>
                    <span className="text-zinc-200 font-medium">{activePitcher}</span>
                    <span className="text-zinc-500 text-xs mx-1">vs</span>
                    <span className="text-zinc-200 font-medium">{activeHitter}</span>
                </div>
            </div>

            {/* Pitchers Used (Compact) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="flex items-center gap-2 mb-3 text-zinc-400 font-semibold text-xs uppercase tracking-wider">
                    <UserCircle className="h-3.5 w-3.5" /> Pitchers
                </div>
                {pitcherOverviewModels.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">No pitchers mapped yet.</p>
                ) : (
                    <ul className="space-y-2">
                        {pitcherOverviewModels.map((pitcher, idx) => (
                            <li key={pitcher.pitcherKey} className="flex items-center gap-3 text-sm">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-400">
                                    {idx + 1}
                                </span>
                                <span className="text-zinc-300 font-medium truncate">{pitcher.displayName}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Lineup (Compact) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="flex items-center gap-2 mb-3 text-zinc-400 font-semibold text-xs uppercase tracking-wider">
                    <Users className="h-3.5 w-3.5" /> Hitters
                </div>
                {lineupEntries.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">No lineup configured.</p>
                ) : (
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                        {lineupEntries.map((p) => (
                            <li key={p.id} className="flex items-center gap-3 text-sm">
                                <span className="w-4 text-right text-zinc-600 font-mono text-[10px]">{p.lineupSlot}</span>
                                <span className="text-zinc-400 truncate">{p.hitterName}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {game.notes && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Notes
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed italic">{game.notes}</p>
                </div>
            )}
        </div>
    );
}
