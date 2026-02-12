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
    <span className="hidden sm:inline text-[11px] text-zinc-500 ml-auto whitespace-nowrap">
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
          className="flex flex-col items-center justify-center rounded-xl border border-zinc-800/60 bg-zinc-950/35 py-2.5 px-1.5"
        >
          <span className="text-3xl sm:text-4xl font-semibold text-zinc-100 leading-none">
            {formatValue(k, p[k])}
          </span>
          <span className="text-xs uppercase tracking-widest text-zinc-400 mt-0.5">
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
    <section className="rounded-2xl border border-zinc-800/60 bg-zinc-950/40 shadow-sm p-5">
      <div className="space-y-5">
        {meta.linkedGames.map((game: LinkedGame) => {
          const stats = statsByGame[game.gameId] ?? null;
          const opponent = game.opponent ?? "Unknown";
          const date = game.date ?? "";
          return (
            <div key={`${game.season}-${game.gameId}`}>
              {/* Header row */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex flex-col">
                  <h2 className="text-xl font-semibold text-zinc-100">Game Stats</h2>
                  <span className="text-xs uppercase tracking-widest text-zinc-500">Pitching line</span>
                </div>
                <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-300">
                  vs {opponent}
                </span>
                {date && (
                  <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400">
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
