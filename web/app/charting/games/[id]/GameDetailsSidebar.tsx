import { ClipboardList, UserCircle, Users } from "lucide-react";
import type { ChartingGame } from "@/lib/charting/types";
import type { PitcherOverviewModel, HitterOverviewModel } from "@/lib/charting/sessionOverview";

export function GameDetailsSidebar({
    game,
    pitcherOverviewModels,
    hitterOverviewModels,
}: {
    game: ChartingGame;
    pitcherOverviewModels: PitcherOverviewModel[];
    hitterOverviewModels: HitterOverviewModel[];
}) {
    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-surface p-5 text-foreground">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    <ClipboardList className="h-3.5 w-3.5" /> Review Queue
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border bg-surface-muted px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Arms</div>
                        <div className="mt-1 text-lg font-black">{pitcherOverviewModels.length}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-muted px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Hitters</div>
                        <div className="mt-1 text-lg font-black">{hitterOverviewModels.length}</div>
                    </div>
                </div>
            </div>

            {/* Pitchers Used (Compact) */}
            <div className="rounded-2xl border border-border bg-surface p-5 text-foreground">
                <div className="flex items-center gap-2 mb-3 text-muted font-semibold text-xs uppercase tracking-wider">
                    <UserCircle className="h-3.5 w-3.5" /> Pitchers
                </div>
                {pitcherOverviewModels.length === 0 ? (
                    <p className="text-xs text-muted italic">No Babson pitchers mapped yet.</p>
                ) : (
                    <ul className="space-y-2">
                        {pitcherOverviewModels.map((pitcher, idx) => (
                            <li key={pitcher.pitcherKey} className="flex items-center justify-between gap-3 text-sm">
                                <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border bg-surface-muted text-[9px] font-bold text-muted">
                                    {idx + 1}
                                </span>
                                <span className="truncate font-medium">{pitcher.displayName}</span>
                                </div>
                                <span className="shrink-0 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">
                                    {pitcher.pitches.length} pit
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Lineup (Compact) */}
            <div className="rounded-2xl border border-border bg-surface p-5 text-foreground">
                <div className="flex items-center gap-2 mb-3 text-muted font-semibold text-xs uppercase tracking-wider">
                    <Users className="h-3.5 w-3.5" /> Hitters
                </div>
                {hitterOverviewModels.length === 0 ? (
                    <p className="text-xs text-muted italic">No Babson hitters mapped yet.</p>
                ) : (
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent">
                        {hitterOverviewModels.map((hitter, idx) => (
                            <li key={hitter.hitterName} className="flex items-center justify-between gap-3 text-sm">
                                <div className="flex min-w-0 items-center gap-3">
                                <span className="w-4 text-right font-mono text-[10px] text-muted">{hitter.lineupSlot > 0 ? hitter.lineupSlot : "—"}</span>
                                <span className="truncate text-muted">{hitter.hitterName}</span>
                                </div>
                                <span className="shrink-0 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">
                                    {hitter.plateAppearances.length} PA
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {game.notes && (
                <div className="rounded-2xl border border-border bg-surface p-5 text-foreground">
                    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                        Notes
                    </h3>
                    <p className="text-sm text-muted leading-relaxed italic">{game.notes}</p>
                </div>
            )}
        </div>
    );
}
