import type { CommandPlusBaselineRow } from "@/lib/commandPlus";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { pitchDisplayName } from "@/lib/pitchNames";

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
    <div className="min-w-[170px] rounded-2xl border border-zinc-800/80 bg-zinc-950/65 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-mono font-bold tabular-nums text-zinc-100">
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
    <div className="rounded-[1.45rem] border border-zinc-800/80 bg-zinc-950/78 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Team Miss Baselines
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
              {season} live baseline
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500">
            Baseline miss by pitch type, plus the weighted benchmark for this outing&apos;s pitch mix.
          </p>
        </div>

        {subjectAvgMiss !== null && teamMixAvgMiss !== null && (
          <div className="grid grid-cols-2 gap-3">
            <StatChip label="Your Avg Miss" value={subjectAvgMiss} />
            <StatChip label="Team Mix Avg" value={teamMixAvgMiss} />
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {averages.map(({ pitchType, avgMiss, count }) => {
          return (
            <div
              key={pitchType}
              className="flex min-h-[4.5rem] items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/68 px-4 py-3"
              title={`${count} season pitches in baseline`}
            >
              <PitchTypeChip
                pitchType={pitchType}
                label={pitchDisplayName(pitchType)}
                size="xs"
                className="shrink-0"
              />
              <div className="flex items-baseline gap-3 text-right">
                <span className="text-lg font-mono font-semibold tabular-nums text-zinc-200">
                  {avgMiss.toFixed(1)}&Prime;
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] tabular-nums text-zinc-600">
                  n={count}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
