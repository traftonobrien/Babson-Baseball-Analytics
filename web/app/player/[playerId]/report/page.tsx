"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { getPlayer } from "@/lib/dataIndex";
import { usePitchData } from "@/app/hooks/usePitchData";
import { pitchColor } from "@/lib/pitchColors";
import {
  buildReport,
  ON_TARGET_THRESHOLD_IN,
  type Insight,
  type LaneDetailed,
  type PitchTypeSummary,
  type MissTendency,
  type PitchGroupHorizontalCommand,
} from "@/lib/reportModel";

/* ================================================================== */
/*  Inner component                                                    */
/* ================================================================== */

function ReportInner() {
  const { playerId } = useParams<{ playerId: string }>();
  const searchParams = useSearchParams();
  const outingId = searchParams.get("outingId");
  const mode = searchParams.get("mode");

  const player = getPlayer(playerId);
  const isOverall = mode === "overall";

  const outing = outingId
    ? player?.outings.find((o) => o.id === outingId)
    : player?.outings[0];

  const { pitches, loading, error } = usePitchData(outing?.csvPath ?? "");

  const report = useMemo(() => {
    if (pitches.length === 0) return null;
    const label = isOverall
      ? `Overall (${player?.outings.length ?? 1} outing${(player?.outings.length ?? 1) > 1 ? "s" : ""})`
      : outing?.label ?? "";
    return buildReport(
      pitches,
      player?.name ?? "",
      label,
      isOverall ? "overall" : "outing",
    );
  }, [pitches, player, outing, isOverall]);

  if (!player || !outing) return <Msg text="Player or outing not found." error />;
  if (loading) return <Msg text="Loading pitch data..." />;
  if (error) return <Msg text={`Error: ${error}`} error />;
  if (!report) return <Msg text="No pitches found." />;

  const handlePrint = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const safeName = report.meta.playerName.replace(/[^a-zA-Z0-9]/g, "");
    const safeOuting = isOverall ? "Overall" : (outingId ?? date);
    document.title = `${safeName}_Report_${safeOuting}_${date}`;
    window.print();
  };

  const generatedDate = new Date(report.meta.generatedAt).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  );

  return (
    <div className="report-root max-w-[740px] mx-auto px-6 py-5 print:max-w-none print:px-0 print:py-0">
      {/* ---- Toolbar (screen only) ---- */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <a
          href={`/player/${playerId}`}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          &larr; Dashboard
        </a>
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-1.5 text-sm rounded-md bg-zinc-700 text-zinc-100 hover:bg-zinc-600 transition-colors font-medium"
        >
          Export PDF
        </button>
      </div>

      {/* ============================================================ */}
      {/*  HEADER                                                       */}
      {/* ============================================================ */}
      <header className="report-header mb-3">
        <div className="flex items-baseline justify-between border-b-2 border-zinc-600 print:border-black pb-2">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight leading-none">
              {report.meta.playerName}
            </h1>
            <p className="text-[12px] text-zinc-400 print:text-zinc-700 mt-1 leading-none">
              {report.meta.outingLabel}
            </p>
          </div>
          <div className="text-right shrink-0 pl-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.15em] print:text-black">
              Command Report
            </div>
          </div>
        </div>
        {/* Metadata pills */}
        <div className="flex items-center gap-2 mt-1.5 text-[9px] text-zinc-500 print:text-zinc-600 flex-wrap">
          <Pill>{report.meta.scope === "overall" ? "Overall" : "Single Outing"}</Pill>
          <Pill>{report.meta.totalPitches} pitches</Pill>
          <Pill>Throws {report.meta.pitcherHand === "L" ? "LHP" : "RHP"}</Pill>
          <Pill>{generatedDate}</Pill>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  KPI CARDS                                                    */}
      {/* ============================================================ */}
      <div className="report-kpis grid grid-cols-6 gap-1.5 mb-3">
        <KPICard label="Avg Miss" value={report.kpis.avgMiss.toFixed(1)} unit="in" />
        <KPICard label="Median" value={report.kpis.medianMiss.toFixed(1)} unit="in" />
        <KPICard
          label="On Target"
          value={report.kpis.hitSpotPct.toFixed(0)}
          unit="%"
          subtitle={`≤ ${ON_TARGET_THRESHOLD_IN}″ from target`}
          highlight={
            report.kpis.hitSpotPct >= 50
              ? "good"
              : report.kpis.hitSpotPct < 35
                ? "bad"
                : undefined
          }
        />
        <KPICard
          label="Consistency"
          value={report.kpis.stdDev.toFixed(1)}
          unit="in"
          subtitle="std dev"
        />
        <KPICard
          label="Best Pitch"
          value={report.kpis.bestPitchType ?? "—"}
          subtitle={
            report.kpis.bestPitchType
              ? `${report.kpis.bestPitchAvgMiss.toFixed(1)} in avg`
              : undefined
          }
          accent="green"
        />
        <KPICard
          label="Worst Pitch"
          value={report.kpis.worstPitchType ?? "—"}
          subtitle={
            report.kpis.worstPitchType
              ? `${report.kpis.worstPitchAvgMiss.toFixed(1)} in avg`
              : undefined
          }
          accent="red"
        />
      </div>

      {/* ============================================================ */}
      {/*  PITCH ARSENAL TABLE                                          */}
      {/* ============================================================ */}
      <ReportSection title="Pitch Arsenal">
        <PitchMixTable data={report.perPitchType} />
      </ReportSection>

      {/* ============================================================ */}
      {/*  HORIZONTAL COMMAND LANES                                     */}
      {/* ============================================================ */}
      <div className="report-zone-lane mb-3">
        <ReportSection title="Horizontal Command Lanes (Catcher View)" compact>
          <p className="text-[8px] text-zinc-500 print:text-zinc-500 mb-1 leading-tight">
            Lateral miss relative to the catcher&apos;s target (inside = toward batter, outside = away). Catcher looking at pitcher.
          </p>
          <HorizontalLanesSection data={report.lanesDetailed} takeaways={report.laneTakeaways} />
        </ReportSection>
      </div>

      {/* ============================================================ */}
      {/*  FASTBALL + BREAKING BALL HORIZONTAL COMMAND                   */}
      {/* ============================================================ */}
      <div className="report-pitch-groups grid grid-cols-2 gap-4 mb-3">
        <PitchGroupCommandSection data={report.fastballHorizontalThirds} />
        <PitchGroupCommandSection data={report.breakingHorizontalThirds} />
      </div>

      {/* ============================================================ */}
      {/*  TENDENCY + NOTES                                             */}
      {/* ============================================================ */}
      <div className="report-bottom grid grid-cols-2 gap-4 mb-2">
        <ReportSection title="Miss Tendency by Pitch" compact>
          <TendencyTable data={report.missTendency} />
        </ReportSection>
        {report.insights.length > 0 && (
          <ReportSection title="Scouting Notes" compact>
            <ul className="space-y-0.5">
              {report.insights.map((ins, i) => (
                <InsightRow key={i} insight={ins} />
              ))}
            </ul>
          </ReportSection>
        )}
      </div>

      {/* ---- Footer ---- */}
      <footer className="pt-1.5 border-t border-zinc-700 print:border-zinc-400 text-[8px] text-zinc-500 print:text-zinc-500 flex justify-between">
        <span>Pitch Tracker &mdash; Command Report</span>
        <span>{generatedDate}</span>
      </footer>
    </div>
  );
}

/* ================================================================== */
/*  Shared layout components                                           */
/* ================================================================== */

function Msg({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className={`flex items-center justify-center h-screen bg-zinc-950 ${error ? "text-red-400" : "text-zinc-400"}`}>
      {text}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block border border-zinc-700 print:border-zinc-400 rounded px-1.5 py-[1px] font-medium">
      {children}
    </span>
  );
}

function ReportSection({
  title,
  compact,
  children,
}: {
  title: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={compact ? "mb-0" : "mb-3"}>
      <h2 className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 print:text-zinc-700 mb-1 border-b border-zinc-800 print:border-zinc-300 pb-[3px]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ================================================================== */
/*  KPI Card                                                           */
/* ================================================================== */

function KPICard({
  label,
  value,
  unit,
  subtitle,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  subtitle?: string;
  highlight?: "good" | "bad";
  accent?: "green" | "red";
}) {
  // Border accent
  let borderCls = "border-zinc-700 print:border-zinc-400";
  let bgCls = "print:bg-white";
  if (highlight === "good") {
    borderCls = "border-green-500/70 print:border-green-700";
    bgCls = "bg-green-950/20 print:bg-green-50";
  } else if (highlight === "bad") {
    borderCls = "border-red-500/70 print:border-red-700";
    bgCls = "bg-red-950/20 print:bg-red-50";
  }

  // Left accent strip for best/worst
  let leftAccent = "";
  if (accent === "green") leftAccent = "border-l-2 border-l-green-500 print:border-l-green-700";
  if (accent === "red") leftAccent = "border-l-2 border-l-red-400 print:border-l-red-700";

  return (
    <div className={`rounded border ${borderCls} ${bgCls} ${leftAccent} px-1 py-1.5 text-center`}>
      <div className="text-[7px] text-zinc-500 print:text-zinc-600 uppercase tracking-wider leading-none mb-[3px] font-semibold">
        {label}
      </div>
      <div className="font-bold font-mono leading-none">
        <span className="text-[16px]">{value}</span>
        {unit && <span className="text-[9px] text-zinc-400 print:text-zinc-600 ml-[1px]">{unit}</span>}
      </div>
      {subtitle && (
        <div className="text-[7px] text-zinc-500 print:text-zinc-500 leading-none mt-[2px]">
          {subtitle}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Pitch Arsenal Table                                                */
/* ================================================================== */

function PitchMixTable({ data }: { data: PitchTypeSummary[] }) {
  return (
    <table className="w-full text-[10px] border-collapse">
      <thead>
        <tr className="text-left text-zinc-500 print:text-zinc-600 border-b border-zinc-600 print:border-zinc-400">
          <th className="py-[3px] pr-1.5 font-semibold">Type</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">N</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">Usage</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">Avg Miss</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">Avg H</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">Avg V</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold text-zinc-600 print:text-zinc-500">Med</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold text-zinc-600 print:text-zinc-500">SD</th>
          <th className="py-[3px] text-right font-semibold" title={`≤ ${ON_TARGET_THRESHOLD_IN}″`}>On Tgt</th>
        </tr>
      </thead>
      <tbody>
        {data.map((pt, i) => {
          const stripe = i % 2 === 1 ? "bg-zinc-900/30 print:bg-zinc-50" : "";
          return (
            <tr
              key={pt.pitchType}
              className={`border-b border-zinc-800/40 print:border-zinc-200 ${stripe}`}
            >
              <td className="py-[3px] pr-1.5">
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-[7px] h-[7px] rounded-full shrink-0 print:border print:border-zinc-400"
                    style={{ backgroundColor: pitchColor(pt.pitchType) }}
                  />
                  <span className="font-mono font-bold text-[11px]">{pt.pitchType}</span>
                  {pt.lowSample && (
                    <span className="text-[7px] text-zinc-500 print:text-zinc-500 italic ml-0.5">
                      n&lt;5
                    </span>
                  )}
                </span>
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono">{pt.count}</td>
              <td className="py-[3px] pr-1.5 text-right font-mono font-bold">
                {pt.pct.toFixed(0)}%
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono">
                {pt.avgMiss.toFixed(1)}&Prime;
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono">
                {pt.avgHAbs.toFixed(1)}&Prime;
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono">
                {pt.avgVAbs.toFixed(1)}&Prime;
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono text-zinc-500 print:text-zinc-500">
                {pt.medianMiss.toFixed(1)}&Prime;
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono text-zinc-500 print:text-zinc-500">
                {pt.stdDev.toFixed(1)}&Prime;
              </td>
              <td className="py-[3px] text-right font-mono font-bold">
                {pt.hitSpotPct.toFixed(0)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ================================================================== */
/*  Horizontal Lanes                                                   */
/* ================================================================== */

const LANE_BAR_COLORS: Record<string, { screen: string; print: string }> = {
  Inside: { screen: "rgb(96, 165, 250)", print: "rgb(147, 197, 253)" },
  Middle: { screen: "rgb(161, 161, 170)", print: "rgb(161, 161, 170)" },
  Outside: { screen: "rgb(251, 191, 36)", print: "rgb(252, 211, 77)" },
};

const LANE_SUBTITLE: Record<string, string> = {
  Inside: "toward batter",
  Middle: "center",
  Outside: "away from batter",
};

function hDir(v: number): string {
  if (Math.abs(v) < 0.5) return "";
  return v < 0 ? "arm-side" : "glove-side";
}

function vDir(v: number): string {
  if (Math.abs(v) < 0.5) return "";
  return v < 0 ? "high" : "low";
}

function HorizontalLanesSection({
  data,
  takeaways,
}: {
  data: LaneDetailed[];
  takeaways: string[];
}) {
  const total = data.reduce((s, l) => s + l.count, 0) || 1;

  return (
    <div>
      {/* Stacked horizontal bar */}
      <div className="flex h-4 rounded-sm overflow-hidden border border-zinc-700 print:border-zinc-400 mb-1.5">
        {data.map((l) => {
          const w = (l.count / total) * 100;
          if (w === 0) return null;
          const colors = LANE_BAR_COLORS[l.lane] ?? LANE_BAR_COLORS.Middle;
          return (
            <div
              key={l.lane}
              className="flex items-center justify-center text-[8px] font-bold"
              style={{
                width: `${w}%`,
                backgroundColor: colors.screen,
                color: l.lane === "Middle" ? "#fff" : "#1a1a1a",
              }}
            >
              {w > 15 ? `${l.lane} ${l.usagePct.toFixed(0)}%` : w > 8 ? `${l.usagePct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>

      {/* Per-lane stat cards */}
      <div className="grid grid-cols-3 gap-1">
        {data.map((l) => {
          const hD = hDir(l.avgHSigned);
          const vD = vDir(l.avgVSigned);
          return (
            <div
              key={l.lane}
              className="rounded-sm border border-zinc-800 print:border-zinc-300 px-1.5 py-1 print:bg-white"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[8px] font-bold text-zinc-400 print:text-zinc-700 uppercase tracking-wider">
                  {l.lane}
                </span>
                <span className="text-[7px] text-zinc-600 print:text-zinc-500">
                  {LANE_SUBTITLE[l.lane]}
                </span>
              </div>
              <div className="text-[13px] font-mono font-extrabold leading-tight mt-[2px]">
                {l.avgMiss.toFixed(1)}&Prime;
                <span className="text-[8px] font-normal text-zinc-500 print:text-zinc-600 ml-0.5">avg miss</span>
              </div>
              <div className="text-[8px] text-zinc-400 print:text-zinc-600 font-mono leading-tight mt-[1px]">
                H: {l.avgHAbs.toFixed(1)}&Prime;{hD ? ` ${hD}` : ""}
              </div>
              <div className="text-[8px] text-zinc-400 print:text-zinc-600 font-mono leading-tight">
                V: {l.avgVAbs.toFixed(1)}&Prime;{vD ? ` ${vD}` : ""}
              </div>
              <div className="flex items-center justify-between mt-[3px]">
                <span
                  className={`text-[8px] font-mono font-bold px-1 py-[1px] rounded-sm ${
                    l.onTargetPct >= 50
                      ? "bg-green-900/40 text-green-400 print:bg-green-100 print:text-green-800"
                      : l.onTargetPct < 35
                        ? "bg-red-900/40 text-red-400 print:bg-red-100 print:text-red-800"
                        : "bg-zinc-800 text-zinc-300 print:bg-zinc-100 print:text-zinc-700"
                  }`}
                >
                  {l.onTargetPct.toFixed(0)}% on target
                </span>
                <span className="text-[7px] font-mono text-zinc-500 print:text-zinc-600">
                  n={l.count}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Takeaways */}
      {takeaways.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {takeaways.map((t, i) => (
            <p key={i} className="text-[8px] text-zinc-400 print:text-zinc-600 italic leading-snug">
              {t}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Pitch Group Horizontal Command (Fastball / Breaking Ball)          */
/* ================================================================== */

function PitchGroupCommandSection({ data }: { data: PitchGroupHorizontalCommand }) {
  const total = data.lanes.reduce((s, l) => s + l.count, 0) || 1;

  if (data.totalPitches === 0) {
    return (
      <ReportSection title={`${data.label} Horizontal Command (Catcher View)`} compact>
        <p className="text-[8px] text-zinc-500 italic">No {data.label.toLowerCase()} data.</p>
      </ReportSection>
    );
  }

  return (
    <ReportSection title={`${data.label} Horizontal Command (Catcher View)`} compact>
      <p className="text-[8px] text-zinc-500 print:text-zinc-500 mb-1 leading-tight">
        Inside = toward batter, Outside = away from batter. Based on catcher target miss. n={data.totalPitches}
      </p>

      {/* Stacked horizontal bar */}
      <div className="flex h-4 rounded-sm overflow-hidden border border-zinc-700 print:border-zinc-400 mb-1.5">
        {data.lanes.map((l) => {
          const w = (l.count / total) * 100;
          if (w === 0) return null;
          const colors = LANE_BAR_COLORS[l.lane] ?? LANE_BAR_COLORS.Middle;
          return (
            <div
              key={l.lane}
              className="flex items-center justify-center text-[8px] font-bold"
              style={{
                width: `${w}%`,
                backgroundColor: colors.screen,
                color: l.lane === "Middle" ? "#fff" : "#1a1a1a",
              }}
            >
              {w > 15 ? `${l.lane} ${l.pct.toFixed(0)}%` : w > 8 ? `${l.pct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>

      {/* Per-lane stat cards */}
      <div className="grid grid-cols-3 gap-1">
        {data.lanes.map((l) => {
          const hD = hDir(l.avgHSigned);
          const vD = vDir(l.avgVSigned);
          return (
            <div
              key={l.lane}
              className="rounded-sm border border-zinc-800 print:border-zinc-300 px-1.5 py-1 print:bg-white"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[8px] font-bold text-zinc-400 print:text-zinc-700 uppercase tracking-wider">
                  {l.lane}
                </span>
                <span className="text-[7px] font-mono text-zinc-500 print:text-zinc-600">
                  n={l.count}
                </span>
              </div>
              <div className="text-[11px] font-mono font-extrabold leading-tight mt-[1px]">
                {l.avgMiss.toFixed(1)}&Prime;
                <span className="text-[8px] font-normal text-zinc-500 print:text-zinc-600 ml-0.5">avg</span>
              </div>
              <div className="text-[8px] text-zinc-400 print:text-zinc-600 font-mono leading-tight mt-[1px]">
                H: {l.avgHAbs.toFixed(1)}&Prime;{hD ? ` ${hD}` : ""}
              </div>
              <div className="text-[8px] text-zinc-400 print:text-zinc-600 font-mono leading-tight">
                V: {l.avgVAbs.toFixed(1)}&Prime;{vD ? ` ${vD}` : ""}
              </div>
              <div className="flex items-center justify-between mt-[2px]">
                <span
                  className={`text-[8px] font-mono font-bold px-1 py-[1px] rounded-sm ${
                    l.onTargetPct >= 50
                      ? "bg-green-900/40 text-green-400 print:bg-green-100 print:text-green-800"
                      : l.onTargetPct < 35
                        ? "bg-red-900/40 text-red-400 print:bg-red-100 print:text-red-800"
                        : "bg-zinc-800 text-zinc-300 print:bg-zinc-100 print:text-zinc-700"
                  }`}
                >
                  {l.onTargetPct.toFixed(0)}% on target
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Takeaway */}
      {data.takeaway && (
        <p className="text-[8px] text-zinc-400 print:text-zinc-600 mt-1 italic leading-snug">
          {data.takeaway}
        </p>
      )}
    </ReportSection>
  );
}

/* ================================================================== */
/*  Miss Tendency Table                                                */
/* ================================================================== */

function TendencyTable({ data }: { data: MissTendency[] }) {
  return (
    <table className="w-full text-[10px] border-collapse">
      <thead>
        <tr className="text-left text-zinc-500 print:text-zinc-600 border-b border-zinc-600 print:border-zinc-400">
          <th className="py-[2px] pr-2 font-semibold">Pitch</th>
          <th className="py-[2px] pr-2 font-semibold">Horizontal Tendency</th>
          <th className="py-[2px] font-semibold">Vertical Tendency</th>
        </tr>
      </thead>
      <tbody>
        {data.map((t, i) => {
          const stripe = i % 2 === 1 ? "bg-zinc-900/30 print:bg-zinc-50" : "";
          return (
            <tr
              key={t.pitchType}
              className={`border-b border-zinc-800/40 print:border-zinc-200 ${stripe}`}
            >
              <td className="py-[3px] pr-2">
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-[6px] h-[6px] rounded-full shrink-0"
                    style={{ backgroundColor: pitchColor(t.pitchType) }}
                  />
                  <span className="font-mono font-bold">{t.pitchType}</span>
                  {t.lowSample && (
                    <span className="text-[7px] text-zinc-500 italic">n&lt;5</span>
                  )}
                </span>
              </td>
              <td className="py-[3px] pr-2 font-mono">
                <TendencyCell value={t.avgH} label={t.hLabel} />
              </td>
              <td className="py-[3px] font-mono">
                <TendencyCell value={t.avgV} label={t.vLabel} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TendencyCell({ value, label }: { value: number; label: string }) {
  if (label === "centered") {
    return <span className="text-zinc-500 print:text-zinc-500">centered</span>;
  }
  const strong = Math.abs(value) > 2;
  const color = strong
    ? "text-amber-400 print:text-amber-900 font-semibold"
    : "text-zinc-300 print:text-zinc-700";
  return <span className={color}>{label}</span>;
}

/* ================================================================== */
/*  Insight Row                                                        */
/* ================================================================== */

function InsightRow({ insight }: { insight: Insight }) {
  const styles: Record<string, string> = {
    positive: "text-green-500 print:text-green-800",
    negative: "text-red-400 print:text-red-800",
    neutral: "text-zinc-400 print:text-zinc-600",
  };
  const markers: Record<string, string> = {
    positive: "+",
    negative: "!",
    neutral: "\u2022",
  };
  return (
    <li className={`text-[9px] leading-snug ${styles[insight.type]}`}>
      <span className="font-mono font-bold mr-1 text-[8px]">{markers[insight.type]}</span>
      {insight.text}
    </li>
  );
}

/* ================================================================== */
/*  Page export                                                        */
/* ================================================================== */

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 print:bg-white print:text-black">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen text-zinc-400">
            Loading...
          </div>
        }
      >
        <ReportInner />
      </Suspense>
    </div>
  );
}
