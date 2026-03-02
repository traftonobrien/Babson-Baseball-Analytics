import { pitchColor } from "@/lib/pitchColors";
import type { CommandPlusBaselineRow } from "@/lib/commandPlus";

interface Props {
  season: number;
  averages: CommandPlusBaselineRow[];
  subjectAvgMiss: number | null;
  teamMixAvgMiss: number | null;
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-[180px] rounded-lg border border-zinc-700/60 bg-zinc-900/70 px-4 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-mono font-bold tabular-nums text-zinc-100">
        {value.toFixed(1)}&Prime;
      </div>
    </div>
  );
}

export default function TeamAveragesBar({
  season,
  averages,
  subjectAvgMiss,
  teamMixAvgMiss,
}: Props) {
  if (averages.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-5 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-zinc-300">
              Team Averages (Miss Distance)
            </span>
            <span className="text-[10px] text-zinc-500">
              {season} live baseline
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Live team miss by pitch type. Team Benchmark is the team-average miss for the pitch mix shown here.
          </p>
        </div>

        {subjectAvgMiss !== null && teamMixAvgMiss !== null && (
          <div className="grid grid-cols-2 gap-3">
            <StatChip label="Your Avg" value={subjectAvgMiss} />
            <StatChip label="Team Benchmark" value={teamMixAvgMiss} />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {averages.map(({ pitchType, avgMiss, count }) => {
          const color = pitchColor(pitchType);
          return (
            <div
              key={pitchType}
              className="flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-900/70 px-3 py-2"
              style={{ boxShadow: `0 0 12px ${color}40` }}
              title={`${count} season pitches in baseline`}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span
                className="text-sm font-mono font-bold"
                style={{ color }}
              >
                {pitchType}
              </span>
              <span className="text-sm font-mono font-semibold tabular-nums text-zinc-300">
                {avgMiss.toFixed(1)}&Prime;
              </span>
              <span className="text-[10px] font-medium tabular-nums text-zinc-500">
                n={count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
