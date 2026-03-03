import type { LinkedGame, OutingMeta, PlayerGameStats } from "./index";

const PITCHING_KEYS = ["ip", "h", "r", "er", "bb", "so"] as const;

function formatValue(key: string, value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "\u2014";
  if (key === "ip" && typeof value === "number") return value.toFixed(1);
  return String(value);
}

function InlineSummary({ stats }: { stats: PlayerGameStats }) {
  if (!stats.pitching) return null;
  const p = stats.pitching;
  return (
    <span className="hidden sm:inline ml-auto text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500 whitespace-nowrap">
      {PITCHING_KEYS.map((k) => `${k.toUpperCase()} ${formatValue(k, p[k])}`).join(" \u00b7 ")}
    </span>
  );
}

function PitchingGrid({ stats }: { stats: PlayerGameStats }) {
  if (!stats.pitching) {
    return (
      <p className="text-sm text-zinc-600">No pitching line found for this game.</p>
    );
  }
  const p = stats.pitching;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {PITCHING_KEYS.map((k) => (
        <div
          key={k}
          className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800/70 bg-zinc-950/65 py-3 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        >
          <span className="text-3xl sm:text-4xl font-semibold text-zinc-100 leading-none">
            {formatValue(k, p[k])}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {k}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function GameStatsSection({
  meta,
  statsByGame,
}: {
  meta: OutingMeta;
  statsByGame: Record<string, PlayerGameStats | null>;
}) {
  return (
    <section className="rounded-[1.8rem] border border-zinc-800/80 bg-zinc-950/72 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
      <div className="space-y-5">
        {meta.linkedGames.map((game: LinkedGame) => {
          const stats = statsByGame[game.gameId] ?? null;
          const opponent = game.opponent ?? "Unknown";
          const date = game.date ?? "";
          return (
            <div
              key={`${game.season}-${game.gameId}`}
              className="rounded-[1.4rem] border border-zinc-800/70 bg-zinc-950/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="flex flex-col">
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Game Stats</h2>
                  <span className="mt-1 text-sm font-medium text-zinc-200">Pitching line</span>
                </div>
                <span className="rounded-full border border-zinc-800 bg-zinc-950/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                  vs {opponent}
                </span>
                {date && (
                  <span className="rounded-full border border-zinc-800 bg-zinc-950/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {date}
                  </span>
                )}
                {stats && <InlineSummary stats={stats} />}
              </div>

              {stats ? (
                <PitchingGrid stats={stats} />
              ) : (
                <p className="text-sm text-zinc-600">Stats not found</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
