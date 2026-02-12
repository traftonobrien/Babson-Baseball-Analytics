import type { LinkedGame, OutingMeta, PlayerGameStats } from "./index";

function formatValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return String(value);
}

function renderBatting(stats: PlayerGameStats | null): string {
  if (!stats?.batting) return "Batting: -";
  const b = stats.batting;
  return `Batting: AB ${formatValue(b.ab)} H ${formatValue(b.h)} R ${formatValue(b.r)} RBI ${formatValue(b.rbi)} BB ${formatValue(b.bb)} SO ${formatValue(b.so)} HR ${formatValue(b.hr)}`;
}

function renderPitching(stats: PlayerGameStats | null): string {
  if (!stats?.pitching) return "Pitching: -";
  const p = stats.pitching;
  return `Pitching: IP ${formatValue(p.ip)} H ${formatValue(p.h)} R ${formatValue(p.r)} ER ${formatValue(p.er)} BB ${formatValue(p.bb)} SO ${formatValue(p.so)}`;
}

export default function GameStatsSection({
  meta,
  statsByGame,
}: {
  meta: OutingMeta;
  statsByGame: Record<string, PlayerGameStats | null>;
}) {
  return (
    <section className="border border-zinc-800 rounded-lg p-3 bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-200">Game Stats</h2>
      <div className="mt-2 space-y-2 text-xs text-zinc-300">
        {meta.linkedGames.map((game: LinkedGame) => {
          const stats = statsByGame[game.gameId] ?? null;
          const opponent = game.opponent ?? "Unknown opponent";
          const date = game.date ?? "Unknown date";
          return (
            <div key={`${game.season}-${game.gameId}`} className="border border-zinc-800 rounded-md p-2">
              <div className="text-[11px] text-zinc-400">
                {opponent} · {date}
              </div>
              <div className="mt-1 text-[11px]">
                {stats ? (
                  <>
                    <div>{renderBatting(stats)}</div>
                    <div>{renderPitching(stats)}</div>
                  </>
                ) : (
                  <div>Stats not found</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
