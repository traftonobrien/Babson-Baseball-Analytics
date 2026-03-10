import { UserCircle, Users } from "lucide-react";
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
    return (
        <div className="flex flex-col gap-4">

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
