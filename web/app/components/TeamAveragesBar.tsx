import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { pitchDisplayName } from "@/lib/pitchNames";
import { brandHighlightCardClasses, brandSoftEyebrowTextClasses } from "@/lib/brandSurfaces";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import { cn } from "@/lib/utils";

/** One row: team baseline + this outing’s Command+ for that pitch type. */
export interface PitchCommandTableRow {
  pitchType: string;
  teamAvgMiss: number | null;
  teamSampleCount: number;
  outingPitchCount: number;
  yourCmdPlus: number | null;
  qualified: boolean;
}

interface Props {
  season: number;
  rows: PitchCommandTableRow[];
  subjectAvgMiss: number | null;
  teamMixAvgMiss: number | null;
}

export default function TeamAveragesBar({
  season,
  rows,
  subjectAvgMiss,
  teamMixAvgMiss,
}: Props) {
  const hasSummary = subjectAvgMiss !== null && teamMixAvgMiss !== null;
  const hasTable = rows.length > 0;

  if (!hasSummary && !hasTable) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
      aria-labelledby="team-baseline-heading"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F1F5F9] bg-background/90 px-4 py-3.5 dark:border-zinc-800 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id="team-baseline-heading" className="text-sm font-semibold text-slate-900 dark:text-zinc-50">
              Team baseline &amp; Command+
            </h4>
            <span className="shrink-0 rounded-full border border-[#E2E8F0] bg-surface px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
              {season} season
            </span>
          </div>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-500 dark:text-zinc-400">
            Team miss average by pitch type (baseline sample), this outing’s pitch counts, and your Command+ per
            pitch vs the team baseline. 100 is team average.
          </p>
        </div>
      </div>

      {/* Primary: outing vs mix */}
      {hasSummary ? (
        <div className="grid gap-3 border-b border-[#F1F5F9] p-4 dark:border-zinc-800 sm:grid-cols-2 sm:p-5">
          <div className={cn("rounded-xl px-4 py-4", brandHighlightCardClasses)}>
            <p className={cn("text-[10px] font-semibold uppercase tracking-[0.2em]", brandSoftEyebrowTextClasses)}>
              This outing
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-zinc-50">
              {subjectAvgMiss.toFixed(1)}
              <span className="ml-0.5 text-xl font-semibold text-slate-500 dark:text-zinc-400">&Prime;</span>
            </p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-zinc-400">Weighted average miss</p>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8] dark:text-zinc-500">
              Team mix benchmark
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-zinc-50">
              {teamMixAvgMiss.toFixed(1)}
              <span className="ml-0.5 text-xl font-semibold text-slate-500 dark:text-zinc-400">&Prime;</span>
            </p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-zinc-400">Expected miss for this pitch mix</p>
          </div>
        </div>
      ) : null}

      {/* Per pitch: team baseline + Command+ */}
      {hasTable ? (
        <div className="p-4 sm:p-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8] dark:text-zinc-500">
            By pitch type
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-background text-left dark:border-zinc-800 dark:bg-zinc-950/80">
                  <th scope="col" className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-zinc-500 sm:px-4">
                    Pitch
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-zinc-500 sm:px-4">
                    Team avg miss
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-zinc-500 sm:px-4">
                    Team n
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-zinc-500 sm:px-4">
                    Outing n
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-zinc-500 sm:px-4">
                    Your Cmd+
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(
                  ({
                    pitchType,
                    teamAvgMiss,
                    teamSampleCount,
                    outingPitchCount,
                    yourCmdPlus,
                    qualified,
                  }) => (
                    <tr
                      key={pitchType}
                      className={`border-b border-[#F1F5F9] last:border-b-0 hover:bg-background/80 dark:border-zinc-800 dark:hover:bg-zinc-800/30 ${!qualified ? "opacity-[0.88]" : ""}`}
                      title={
                        teamSampleCount > 0
                          ? `${teamSampleCount.toLocaleString()} pitches in ${season} baseline`
                          : undefined
                      }
                    >
                      <td className="px-3 py-2.5 sm:px-4">
                        <PitchTypeChip
                          pitchType={pitchType}
                          label={pitchDisplayName(pitchType)}
                          size="xs"
                          variant="soft"
                          className="max-w-[10rem] truncate sm:max-w-[12rem]"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[15px] font-semibold tabular-nums text-slate-900 dark:text-zinc-50 sm:px-4">
                        {teamAvgMiss !== null ? `${teamAvgMiss.toFixed(1)}\u2033` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-slate-500 dark:text-zinc-400 sm:px-4">
                        {teamSampleCount > 0 ? teamSampleCount.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-slate-500 dark:text-zinc-400 sm:px-4">
                        {outingPitchCount}
                      </td>
                      <td className="px-3 py-2.5 text-right sm:px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {yourCmdPlus === null ? (
                            <span className="font-mono text-sm font-semibold text-[#94A3B8]">—</span>
                          ) : (
                            <span
                              className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md px-2 py-0.5 font-mono text-sm font-extrabold tabular-nums"
                              style={plusMetricBadgeStyle(yourCmdPlus)}
                            >
                              {yourCmdPlus.toFixed(0)}
                            </span>
                          )}
                          {!qualified ? (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                              NQ
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
