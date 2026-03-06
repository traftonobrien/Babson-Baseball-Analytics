"use client";

import { pitchDisplayName } from "@/lib/pitchNames";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import type { CommandPlusResult } from "@/lib/commandPlus";
import { pitchColor } from "@/lib/pitchColors";

interface Props {
  season: number | null;
  note: string;
  result: CommandPlusResult | null;
}

export default function CommandPlusModelCard({
  season,
  note,
  result,
}: Props) {
  const ready = Boolean(result?.overall != null);
  const qualifiedRows = (result?.pitchTypeScores ?? []).filter((row) => row.eligible && row.score != null);
  const excludedRows = (result?.pitchTypeScores ?? []).filter((row) => !row.eligible);

  return (
    <section className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/8 via-zinc-950/95 to-zinc-950 p-6 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-300/80">
              Command+ Model
            </p>
            {season != null && (
              <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-200/80">
                {season} Live Season
              </span>
            )}
          </div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-zinc-50">
            Full live command grade across all qualified pitch types.
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400">
            Command+ compares the pitcher&apos;s miss distance to the live team baseline.
            100 is team average. Higher is better because the miss is smaller.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-zinc-500">
            Standalone <span className="font-mono text-zinc-400">Command+</span> uses
            every qualified live pitch type. This is broader than the Pitching+
            overlap set.
          </p>
          <p className="mt-2 text-[11px] leading-6 text-zinc-500">{note}</p>
        </div>

        {ready ? (
          <div
            className="inline-flex min-w-[7rem] items-center justify-center rounded-2xl px-4 py-2.5 font-mono text-4xl font-black tracking-tight"
            style={plusMetricBadgeStyle(result?.overall ?? 100)}
          >
            {result?.overall?.toFixed(0)}
          </div>
        ) : (
          <div className="inline-flex min-w-[8rem] items-center justify-center rounded-2xl bg-zinc-800 px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.18em] text-zinc-300">
            Not Ready
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Qualified Pitches
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-zinc-100">
            {result?.qualifiedPitchCount ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Qualified Types
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-zinc-100">
            {qualifiedRows.length}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Excluded Types
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-zinc-100">
            {excludedRows.length}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Need 3+ pitches and a live baseline
          </p>
        </div>
      </div>

      {excludedRows.length > 0 && (
        <div className="mt-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/35 px-4 py-3 text-[12px] leading-6 text-zinc-400">
          Non-qualified rows stay out of the official score until they clear the minimum
          live sample threshold.
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {(result?.pitchTypeScores ?? []).length > 0 ? (
          result?.pitchTypeScores.map((row) => (
            <div
              key={row.pitchType}
              className={`min-w-[188px] rounded-2xl border px-3 py-2 ${
                row.eligible
                  ? "border-zinc-800/80 bg-zinc-950/45"
                  : "border-zinc-800/60 bg-zinc-950/20 opacity-65"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: row.eligible ? pitchColor(row.pitchType) : "#52525b" }}
                  />
                  <span className="font-mono text-[12px] font-bold text-zinc-200">
                    {pitchDisplayName(row.pitchType)}
                  </span>
                </div>
                {row.score == null ? (
                  <span className="font-mono text-sm font-black text-zinc-500">NQ</span>
                ) : (
                  <span
                    className="inline-flex min-w-[50px] items-center justify-center rounded-md px-2 py-0.5 font-mono text-sm font-black tracking-tight"
                    style={plusMetricBadgeStyle(row.score)}
                  >
                    {row.score.toFixed(0)}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                {row.subjectCount} pitch{row.subjectCount === 1 ? "" : "es"} ·
                {" "}avg {row.subjectAvgMiss.toFixed(1)}&quot; · baseline{" "}
                {row.baselineAvgMiss != null ? `${row.baselineAvgMiss.toFixed(1)}"` : "--"}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/35 px-4 py-3 text-sm text-zinc-500">
            No qualified Command+ breakdown yet.
          </div>
        )}
      </div>
    </section>
  );
}
