"use client";

import Link from "next/link";
import { pitchColor } from "@/lib/pitchColors";
import { pitchDisplayName } from "@/lib/pitchNames";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import type { PitchingPlusResult } from "@/lib/pitchingPlus";

interface Props {
  season: number | null;
  loading: boolean;
  note: string;
  result: PitchingPlusResult | null;
}

export default function PitchingPlusModelCard({
  season,
  loading,
  note,
  result,
}: Props) {
  const ready = Boolean(result?.ready && result.overall != null);
  const excludedRows = (result?.pitchTypeRows ?? []).filter((row) => !row.included);
  const excludedLivePitchCount = excludedRows.reduce(
    (sum, row) => sum + row.commandCount,
    0,
  );
  const excludedPitchTypes = excludedRows
    .map((row) => pitchDisplayName(row.commandPitchType))
    .join(", ");

  return (
    <section className="rounded-[2rem] border border-amber-200 bg-[radial-gradient(circle_at_top_left,rgba(253,230,138,0.28),transparent_26%),linear-gradient(135deg,#fffbeb_0%,#ffffff_62%,#fffaf2_100%)] p-6 shadow-[0_22px_52px_rgba(15,23,42,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">
              Pitching+ Model
            </p>
            {season != null ? (
              <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 shadow-[0_8px_18px_rgba(245,158,11,0.10)]">
                {season} Live Season
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            The complete live blend behind the profile grade.
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            Pitching+ combines team-centered Stuff+ with live Command+, then rolls
            the matched arsenal up with a hybrid weighting model.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500">
            <span className="font-mono text-slate-700">Command Core</span> only
            reflects command scores from pitch types that also have a clean
            Stuff+ match inside Pitching+.
          </p>
          <p className="mt-3 text-[11px] leading-6 text-slate-500">{note}</p>
        </div>

        {loading ? (
          <div className="inline-flex min-w-[7.5rem] items-center justify-center rounded-2xl border border-amber-200 bg-white px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.18em] text-slate-500">
            Loading
          </div>
        ) : ready ? (
          <div
            className="inline-flex min-w-[7rem] items-center justify-center rounded-2xl px-4 py-2.5 font-mono text-4xl font-black tracking-tight shadow-[0_16px_30px_rgba(251,191,36,0.18)]"
            style={plusMetricBadgeStyle(result?.overall ?? 100)}
          >
            {result?.overall?.toFixed(0)}
          </div>
        ) : (
          <div className="inline-flex min-w-[8rem] items-center justify-center rounded-2xl border border-amber-200 bg-white px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.18em] text-slate-500">
            Not Ready
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-500">
        <span>60% Stuff / 40% Command</span>
        <span>50% Pure Mix / 50% Live Usage</span>
        <Link
          href="/pitching-plus"
          className="text-[var(--brand-primary-subtle-text)] transition-smooth hover:text-[var(--brand-primary)]"
        >
          Plus Statistics
        </Link>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Stuff Core
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-slate-950">
            {ready && result?.stuffComponent != null ? result.stuffComponent.toFixed(1) : "--"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Command Core
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-slate-950">
            {ready && result?.commandComponent != null ? result.commandComponent.toFixed(1) : "--"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Pitching+-only command average across the matched overlap set
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Live Overlap
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-slate-950">
            {ready && result ? result.overlapPitchTypeCount : "--"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {ready && result
              ? `${result.overlapPitchCount} matched live pitches`
              : "Needs live command + Stuff overlap"}
          </p>
        </div>
      </div>

      {ready && excludedRows.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-[12px] leading-6 text-slate-600">
          Standalone <span className="font-mono text-slate-700">Command+</span>
          {" "}can read differently than <span className="font-mono text-slate-700">Command Core</span>
          {" "}because Command Core excludes pitch types without a clean Stuff+ match.
          {" "}
          {excludedLivePitchCount} live pitch{excludedLivePitchCount === 1 ? "" : "es"}
          {" "}from {excludedPitchTypes} are excluded from the Pitching+ core blend.
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {(result?.pitchTypeRows ?? []).length > 0 ? (
          result?.pitchTypeRows.map((row) => (
            <div
              key={row.commandPitchType}
              className={`min-w-[174px] rounded-2xl border px-3 py-3 ${
                row.included
                  ? "border-slate-200 bg-white"
                  : "border-slate-200 bg-slate-50/70 opacity-75"
              }`}
              title={
                row.stuffPitchTypes.length > 0
                  ? `Stuff match: ${row.stuffPitchTypes.map((pitchType) => pitchDisplayName(pitchType)).join(", ")}`
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: row.included
                        ? pitchColor(row.commandPitchType)
                        : "#94a3b8",
                    }}
                  />
                  <span className="font-mono text-[12px] font-bold text-slate-900">
                    {pitchDisplayName(row.commandPitchType)}
                  </span>
                </div>
                {row.pitchingPlus == null ? (
                  <span className="font-mono text-sm font-black text-slate-400">--</span>
                ) : (
                  <span
                    className="inline-flex min-w-[50px] items-center justify-center rounded-md px-2 py-0.5 font-mono text-sm font-black tracking-tight shadow-[0_10px_18px_rgba(251,191,36,0.16)]"
                    style={plusMetricBadgeStyle(row.pitchingPlus)}
                  >
                    {row.pitchingPlus.toFixed(0)}
                  </span>
                )}
              </div>
              {row.included ? (
                <p className="mt-2 text-[11px] text-slate-500">
                  S {row.stuffPlus?.toFixed(1)} · C {row.commandPlus?.toFixed(0)} · W{" "}
                  {(row.hybridWeight * 100).toFixed(0)}%
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500">
                  {row.reason === "ambiguous_stuff_match"
                    ? "Ambiguous Stuff+ match"
                    : "Missing Stuff+ match"}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
            No Pitching+ breakdown yet. The score appears once live command and Stuff+
            overlap on at least one pitch type.
          </div>
        )}
      </div>
    </section>
  );
}
