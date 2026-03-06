import type { LinkedGame, OutingMeta, PlayerGameStats } from "./index";
import { getTeamAccentColor, hexToRgba } from "@/lib/teamBranding";

const PITCHING_KEYS = ["ip", "h", "r", "er", "bb", "so"] as const;
const PITCHING_LABELS: Record<(typeof PITCHING_KEYS)[number], string> = {
  ip: "IP",
  h: "H",
  r: "R",
  er: "ER",
  bb: "BB",
  so: "K",
};

function formatValue(key: string, value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "\u2014";
  if (key === "ip" && typeof value === "number") return value.toFixed(1);
  return String(value);
}

function PitchingGrid({
  stats,
  accent,
}: {
  stats: PlayerGameStats;
  accent: string;
}) {
  if (!stats.pitching) {
    return (
      <div className="rounded-[1.15rem] border border-dashed border-zinc-800/80 bg-zinc-950/55 px-4 py-5 text-sm text-zinc-500">
        No pitching line found for this game.
      </div>
    );
  }
  const p = stats.pitching;
  return (
    <div className="grid grid-cols-6 gap-5">
      {PITCHING_KEYS.map((k) => (
        <div
          key={k}
          className="inline-flex w-full max-w-[7.5rem] min-w-0 items-center justify-center justify-self-center gap-2 rounded-full border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.78),rgba(9,9,11,0.92))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          style={{
            borderColor: hexToRgba(accent, 0.18),
            boxShadow: [
              "inset 0 1px 0 rgba(255,255,255,0.03)",
              `0 0 0 1px ${hexToRgba(accent, 0.05)}`,
              `0 0 14px ${hexToRgba(accent, 0.08)}`,
            ].join(", "),
          }}
        >
          <span className="truncate whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {PITCHING_LABELS[k]}
          </span>
          <span className="whitespace-nowrap font-mono text-xl font-semibold leading-none text-zinc-100 xl:text-2xl">
            {formatValue(k, p[k])}
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
  const shellAccent = getTeamAccentColor(meta.linkedGames[0]?.opponent ?? "");

  return (
    <section
      className="rounded-[1.8rem] border p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
      style={{
        borderColor: hexToRgba(shellAccent, 0.32),
        background: `linear-gradient(180deg, ${hexToRgba(shellAccent, 0.08)} 0%, rgba(9,9,11,0.78) 100%)`,
      }}
    >
      <div className="space-y-5">
        {meta.linkedGames.map((game: LinkedGame) => {
          const stats = statsByGame[game.gameId] ?? null;
          const opponent = game.opponent ?? "Unknown";
          const date = game.date ?? "";
          const accent = getTeamAccentColor(opponent);
          return (
            <div
              key={`${game.season}-${game.gameId}`}
              className="rounded-[1.4rem] border border-zinc-800/70 bg-zinc-950/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Pitching Line
                </span>
                <span
                  className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  style={{
                    borderColor: hexToRgba(accent, 0.28),
                    background: `linear-gradient(135deg, ${hexToRgba(accent, 0.14)}, rgba(9,9,11,0.9))`,
                    color: "#f4f4f5",
                  }}
                >
                  vs {opponent}
                </span>
                {date && (
                  <span className="rounded-full border border-zinc-800 bg-zinc-950/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {date}
                  </span>
                )}
              </div>

              {stats ? (
                <PitchingGrid stats={stats} accent={accent} />
              ) : (
                <div className="rounded-[1.15rem] border border-dashed border-zinc-800/80 bg-zinc-950/55 px-4 py-5 text-sm text-zinc-500">
                  Stats not found.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
