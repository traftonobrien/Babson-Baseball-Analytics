"use client";

import Link from "next/link";
import { pitchColor } from "@/lib/pitchColors";
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
  const excludedPitchTypes = excludedRows.map((row) => row.commandPitchType).join(", ");

  return (
    <section className="rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-amber-500/8 via-zinc-950/95 to-zinc-950 p-6 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/80">
              Pitching+ Model
            </p>
            {season != null && (
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/80">
                {season} Live Season
              </span>
            )}
          </div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-zinc-50">
            The complete live blend behind the profile grade.
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400">
            Pitching+ combines team-centered Stuff+ with live Command+, then rolls
            the matched arsenal up with a hybrid weighting model.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-zinc-500">
            <span className="font-mono text-zinc-400">Command Core</span> is not
            the same as the standalone <span className="font-mono text-zinc-400">Command+</span>
            {" "}tile. It only reflects the command scores from pitch types that also
            have a clean Stuff+ match inside Pitching+.
          </p>
          <p className="mt-2 text-[11px] leading-6 text-zinc-500">{note}</p>
        </div>

        {loading ? (
          <div className="inline-flex min-w-[7.5rem] items-center justify-center rounded-2xl bg-zinc-800 px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.18em] text-zinc-400">
            Loading
          </div>
        ) : ready ? (
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

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-zinc-500">
        <span>60% Stuff / 40% Command</span>
        <span>50% Pure Mix / 50% Live Usage</span>
        <Link
          href="/pitching-plus"
          className="text-cyan-400 transition-smooth hover:text-cyan-300"
        >
          Plus Statistics
        </Link>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Stuff Core
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-zinc-100">
            {ready && result?.stuffComponent != null ? result.stuffComponent.toFixed(1) : "--"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Command Core
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-zinc-100">
            {ready && result?.commandComponent != null ? result.commandComponent.toFixed(1) : "--"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Pitching+-only command average across the matched overlap set
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Live Overlap
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-zinc-100">
            {ready && result ? result.overlapPitchTypeCount : "--"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {ready && result
              ? `${result.overlapPitchCount} matched live pitches`
              : "Needs live command + Stuff overlap"}
          </p>
        </div>
      </div>

      {ready && excludedRows.length > 0 && (
        <div className="mt-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/35 px-4 py-3 text-[12px] leading-6 text-zinc-400">
          Standalone <span className="font-mono text-zinc-300">Command+</span> can
          read higher or lower than <span className="font-mono text-zinc-300">Command Core</span>
          {" "}because <span className="font-mono text-zinc-300">Command Core</span>
          {" "}excludes pitch types without a clean Stuff+ match.
          {" "}
          {excludedLivePitchCount} live pitch{excludedLivePitchCount === 1 ? "" : "es"}
          {" "}from {excludedPitchTypes} are excluded from the Pitching+ core blend.
        </div>
      )}

      <div className="mt-6">
        <div className="flex flex-wrap gap-2">
          {(result?.pitchTypeRows ?? []).length > 0 ? (
            result?.pitchTypeRows.map((row) => (
              <div
                key={row.commandPitchType}
                className={`min-w-[174px] rounded-2xl border px-3 py-2 ${
                  row.included
                    ? "border-zinc-800/80 bg-zinc-950/45"
                    : "border-zinc-800/60 bg-zinc-950/20 opacity-60"
                }`}
                title={
                  row.stuffPitchTypes.length > 0
                    ? `Stuff match: ${row.stuffPitchTypes.join(", ")}`
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
                          : "#52525b",
                      }}
                    />
                    <span className="font-mono text-[12px] font-bold text-zinc-200">
                      {row.commandPitchType}
                    </span>
                  </div>
                  {row.pitchingPlus == null ? (
                    <span className="font-mono text-sm font-black text-zinc-500">--</span>
                  ) : (
                    <span
                      className="inline-flex min-w-[50px] items-center justify-center rounded-md px-2 py-0.5 font-mono text-sm font-black tracking-tight"
                      style={plusMetricBadgeStyle(row.pitchingPlus)}
                    >
                      {row.pitchingPlus.toFixed(0)}
                    </span>
                  )}
                </div>
                {row.included ? (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    S {row.stuffPlus?.toFixed(1)} · C {row.commandPlus?.toFixed(0)} · W{" "}
                    {(row.hybridWeight * 100).toFixed(0)}%
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-zinc-600">
                    {row.reason === "ambiguous_stuff_match"
                      ? "Ambiguous Stuff+ match"
                      : "Missing Stuff+ match"}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/35 px-4 py-3 text-sm text-zinc-500">
              No Pitching+ breakdown yet. The score appears once live command and Stuff+
              overlap on at least one pitch type.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
