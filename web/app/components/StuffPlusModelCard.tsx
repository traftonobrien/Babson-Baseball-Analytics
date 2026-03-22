"use client";

import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import { pitchColor } from "@/lib/pitchColors";
import { pitchDisplayName } from "@/lib/pitchNames";

interface StuffPlusPitchRow {
  pitchType?: string;
  meanStuffPlus: number | null;
  nSessions?: number | null;
}

interface Props {
  note: string;
  overall: number | null;
  pitches: StuffPlusPitchRow[];
}

export default function StuffPlusModelCard({
  note,
  overall,
  pitches,
}: Props) {
  const validRows = pitches.filter((row) => row.meanStuffPlus != null);
  const sessionCount = pitches.reduce((max, row) => {
    if (typeof row.nSessions !== "number") return max;
    return Math.max(max, row.nSessions);
  }, 0);
  const sortedRows = [...pitches].sort((a, b) => {
    const aValue = a.meanStuffPlus ?? -Infinity;
    const bValue = b.meanStuffPlus ?? -Infinity;
    return bValue - aValue || (a.pitchType ?? "").localeCompare(b.pitchType ?? "");
  });

  return (
    <section className="rounded-[2rem] border border-blue-200 bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.30),transparent_28%),linear-gradient(135deg,#eff6ff_0%,#ffffff_62%,#f8fbff_100%)] p-6 shadow-[0_22px_52px_rgba(15,23,42,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-700">
              Stuff+ Arsenal
            </p>
          </div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            Team-centered pitch quality across the tracked arsenal.
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            The profile <span className="font-mono text-slate-700">Stuff+</span>
            tile is a simple average across valid pitch types. It stays separate
            from Pitching+, which re-weights the overlap set using live command usage.
          </p>
          <p className="mt-3 text-[11px] leading-6 text-slate-500">{note}</p>
        </div>

        {overall != null ? (
          <div
            className="inline-flex min-w-[7rem] items-center justify-center rounded-2xl px-4 py-2.5 font-mono text-4xl font-black tracking-tight shadow-[0_16px_30px_rgba(96,165,250,0.18)]"
            style={plusMetricBadgeStyle(overall)}
          >
            {overall.toFixed(1)}
          </div>
        ) : (
          <div className="inline-flex min-w-[8rem] items-center justify-center rounded-2xl border border-blue-200 bg-white px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.18em] text-slate-500">
            Not Ready
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Valid Types
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-slate-950">
            {validRows.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Tracked Rows
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-slate-950">
            {pitches.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Sessions
          </p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-slate-950">
            {sessionCount}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-[12px] leading-6 text-slate-600">
        This standalone card can differ from <span className="font-mono text-slate-700">Stuff Core</span>
        {" "}inside Pitching+ because Pitching+ only keeps pitch types with a clean
        live Command+ match and then re-weights them.
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {sortedRows.length > 0 ? (
          sortedRows.map((row) => (
            <div
              key={row.pitchType ?? "unknown"}
              className={`min-w-[188px] rounded-2xl border px-3 py-3 ${
                row.meanStuffPlus != null
                  ? "border-slate-200 bg-white"
                  : "border-slate-200 bg-slate-50/70 opacity-75"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        row.meanStuffPlus != null
                          ? pitchColor(row.pitchType ?? "")
                          : "#94a3b8",
                    }}
                  />
                  <span className="text-[12px] font-bold text-slate-900">
                    {row.pitchType ? pitchDisplayName(row.pitchType) : "Unknown"}
                  </span>
                </div>
                {row.meanStuffPlus == null ? (
                  <span className="font-mono text-sm font-black text-slate-400">--</span>
                ) : (
                  <span
                    className="inline-flex min-w-[58px] items-center justify-center rounded-md px-2 py-0.5 font-mono text-sm font-black tracking-tight shadow-[0_10px_18px_rgba(96,165,250,0.16)]"
                    style={plusMetricBadgeStyle(row.meanStuffPlus)}
                  >
                    {row.meanStuffPlus.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {typeof row.nSessions === "number"
                  ? `${row.nSessions} session${row.nSessions === 1 ? "" : "s"}`
                  : "Session count unavailable"}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
            No Stuff+ arsenal rows yet.
          </div>
        )}
      </div>
    </section>
  );
}
