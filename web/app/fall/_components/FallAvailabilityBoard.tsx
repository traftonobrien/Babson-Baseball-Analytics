import type { PlayerAvailability, AvailabilityStatus } from "@/lib/fall/availability";

const STATUS_STYLES: Record<AvailabilityStatus, { dot: string; badge: string; text: string }> = {
  go:      { dot: "bg-emerald-500", badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300", text: "text-emerald-700 dark:text-emerald-400" },
  monitor: { dot: "bg-amber-400",   badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",     text: "text-amber-700 dark:text-amber-400" },
  limited: { dot: "bg-orange-500",  badge: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300", text: "text-orange-700 dark:text-orange-400" },
  out:     { dot: "bg-red-500",     badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",                   text: "text-red-700 dark:text-red-400" },
  rest:    { dot: "bg-zinc-400",    badge: "border-border bg-surface-muted text-muted",                                                                             text: "text-muted" },
};

function RestDayPips({ days }: { days: number }) {
  // Show up to 7 pips; filled = rest day
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: Math.min(days, 7) }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-emerald-400 dark:bg-emerald-500" />
      ))}
    </div>
  );
}

export function FallAvailabilityBoard({ players }: { players: PlayerAvailability[] }) {
  if (players.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-5 py-6 text-center text-sm text-muted">
        No pitcher outings logged yet — availability updates automatically once outings are added.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border bg-surface-muted px-4 py-2.5">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          <span>Pitcher</span>
          <span className="text-right">7-Day P</span>
          <span className="text-right">Rest</span>
          <span className="text-right">Status</span>
        </div>
      </div>

      <div className="divide-y divide-border/40">
        {players.map((p) => {
          const s = STATUS_STYLES[p.status];
          return (
            <div
              key={p.playerId}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-4 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                <span className="truncate text-sm font-semibold text-foreground">{p.playerName}</span>
              </div>

              <div className="text-right text-sm font-bold text-foreground tabular-nums">
                {p.pitches7Day > 0 ? p.pitches7Day : <span className="text-muted">—</span>}
              </div>

              <div className="text-right">
                {p.daysSince !== null && p.daysSince > 0 ? (
                  <RestDayPips days={p.daysSince} />
                ) : p.daysSince === 0 ? (
                  <span className="text-[10px] text-muted">Today</span>
                ) : (
                  <span className="text-[10px] text-muted">—</span>
                )}
              </div>

              <div>
                <span
                  title={p.statusDetail}
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}
                >
                  {p.statusLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
