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
      <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-background px-4 py-5 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
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
          className="inline-flex w-full max-w-[7.5rem] min-w-0 items-center justify-center justify-self-center gap-2 rounded-full border border-[#E2E8F0] bg-surface px-3 py-3 shadow-sm dark:border-zinc-700"
          style={{
            borderColor: hexToRgba(accent, 0.28),
            boxShadow: [
              "0 1px 2px rgba(15,23,42,0.04)",
              `0 0 0 1px ${hexToRgba(accent, 0.06)}`,
              `0 8px 20px ${hexToRgba(accent, 0.08)}`,
            ].join(", "),
          }}
        >
          <span className="truncate whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8] dark:text-zinc-500">
            {PITCHING_LABELS[k]}
          </span>
          <span className="whitespace-nowrap font-mono text-xl font-semibold leading-none text-slate-900 dark:text-zinc-50 xl:text-2xl">
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
      className="relative overflow-hidden rounded-[28px] border border-border bg-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:bg-zinc-950 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
      style={{
        borderColor: hexToRgba(shellAccent, 0.22),
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{
          background: `linear-gradient(180deg, ${hexToRgba(shellAccent, 0.06)} 0%, #ffffff 72%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background: `linear-gradient(180deg, ${hexToRgba(shellAccent, 0.12)} 0%, rgb(24 24 27) 72%)`,
        }}
        aria-hidden
      />
      <div className="relative space-y-5">
        {meta.linkedGames.map((game: LinkedGame) => {
          const stats = statsByGame[game.gameId] ?? null;
          const opponent = game.opponent ?? "Unknown";
          const date = game.date ?? "";
          const accent = getTeamAccentColor(opponent);
          return (
            <div
              key={`${game.season}-${game.gameId}`}
              className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm dark:bg-zinc-900/35"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#94A3B8] dark:text-zinc-500">
                  Pitching Line
                </span>
                <span
                  className="rounded-full border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-900 dark:text-zinc-50"
                  style={{
                    borderColor: hexToRgba(accent, 0.35),
                    backgroundImage: `linear-gradient(135deg, ${hexToRgba(accent, 0.12)}, transparent)`,
                  }}
                >
                  vs {opponent}
                </span>
                {date && (
                  <span className="rounded-full border border-[#E2E8F0] bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                    {date}
                  </span>
                )}
              </div>

              {stats ? (
                <PitchingGrid stats={stats} accent={accent} />
              ) : (
                <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-surface px-4 py-5 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
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
