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
    <section className="rounded-[2rem] border border-orange-200 bg-[radial-gradient(circle_at_top_left,rgba(254,215,170,0.28),transparent_28%),linear-gradient(135deg,#fff7ed_0%,#ffffff_62%,#fffaf5_100%)] p-6 shadow-[0_22px_52px_rgba(15,23,42,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-700">
              Command+ Model
            </p>
            {season != null ? (
              <span className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-700 shadow-[0_8px_18px_rgba(251,146,60,0.10)]">
                {season} Live Season
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            Full live command grade across all qualified pitch types.
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            Command+ compares miss distance to the live team baseline. 100 is
            team average. Higher is better because the miss is smaller.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500">
            Standalone <span className="font-mono text-slate-700">Command+</span>
            {" "}uses every qualified live pitch type. This is broader than the
            Pitching+ overlap set.
          </p>
          <p className="mt-3 text-[11px] leading-6 text-slate-500">{note}</p>
        </div>

        {ready ? (
          <div
            className="inline-flex min-w-[7rem] items-center justify-center rounded-2xl px-4 py-2.5 font-mono text-4xl font-black tracking-tight shadow-[0_16px_30px_rgba(244,114,182,0.18)]"
            style={plusMetricBadgeStyle(result?.overall ?? 100)}
          >
            {result?.overall?.toFixed(0)}
          </div>
        ) : (
          <div className="inline-flex min-w-[8rem] items-center justify-center rounded-2xl border border-orange-200 bg-white px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.18em] text-slate-500">
            Not Ready
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Qualified Pitches
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-slate-950">
            {result?.qualifiedPitchCount ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Qualified Types
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-slate-950">
            {qualifiedRows.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Excluded Types
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-slate-950">
            {excludedRows.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Need 3+ pitches and a live baseline
          </p>
        </div>
      </div>

      {excludedRows.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50/70 px-4 py-3 text-[12px] leading-6 text-slate-600">
          Non-qualified rows stay out of the official score until they clear the
          minimum live sample threshold.
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {(result?.pitchTypeScores ?? []).length > 0 ? (
          result?.pitchTypeScores.map((row) => (
            <div
              key={row.pitchType}
              className={`min-w-[188px] rounded-2xl border px-3 py-3 ${
                row.eligible
                  ? "border-slate-200 bg-white"
                  : "border-slate-200 bg-slate-50/70 opacity-75"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: row.eligible ? pitchColor(row.pitchType) : "#94a3b8",
                    }}
                  />
                  <span className="font-mono text-[12px] font-bold text-slate-900">
                    {pitchDisplayName(row.pitchType)}
                  </span>
                </div>
                {row.score == null ? (
                  <span className="font-mono text-sm font-black text-slate-400">NQ</span>
                ) : (
                  <span
                    className="inline-flex min-w-[50px] items-center justify-center rounded-md px-2 py-0.5 font-mono text-sm font-black tracking-tight shadow-[0_10px_18px_rgba(244,114,182,0.16)]"
                    style={plusMetricBadgeStyle(row.score)}
                  >
                    {row.score.toFixed(0)}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {row.subjectCount} pitch{row.subjectCount === 1 ? "" : "es"} ·
                {" "}avg {row.subjectAvgMiss.toFixed(1)}&quot; · baseline{" "}
                {row.baselineAvgMiss != null ? `${row.baselineAvgMiss.toFixed(1)}"` : "--"}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
            No qualified Command+ breakdown yet.
          </div>
        )}
      </div>
    </section>
  );
}
