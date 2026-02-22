"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Target, ArrowRight } from "lucide-react";
import SavantPercentileBar from "./SavantPercentileBar";
import MechanicsProfileCard from "@/app/components/mechanics/MechanicsProfileCard";
import type { HubPlayerEntry } from "@/lib/mechanics/hub";

const TABS = ["Overview", "Trackman", "Command"] as const;
type Tab = (typeof TABS)[number];

interface SeasonStat {
  label: string;
  value: string;
}

interface PercentileMetric {
  label: string;
  value: string;
  percentile: number | null;
  note?: string;
}

interface TrackmanSession {
  date: string;
  dateSlug: string;
  sessionLabel: string;
}

interface CommandOuting {
  outingId: string;
  playerId: string;
  dateId: string;
  label: string;
}

interface Props {
  seasonStats: SeasonStat[];
  seasonYear: number;
  seasonNote?: string;
  d3Percentiles: PercentileMetric[];
  trackmanSessions: TrackmanSession[];
  commandOutings: CommandOuting[];
  playerSlug: string;
  initialTab?: string;
  mechanicsEntry?: HubPlayerEntry | null;
}

function formatDateLabel(raw: string): string {
  const parts = raw.replace(/_/g, "-").split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const shortYear = y.length === 4 ? y.slice(2) : y;
    return `${parseInt(m)}/${parseInt(d)}/${shortYear}`;
  }
  return raw;
}

function resolveInitialTab(raw?: string): Tab {
  if (!raw) return "Overview";
  const lower = raw.toLowerCase();
  if (lower === "trackman") return "Trackman";
  if (lower === "command") return "Command";
  return "Overview";
}

export default function PlayerProfileTabs({
  seasonStats,
  seasonYear,
  d3Percentiles,
  trackmanSessions,
  commandOutings,
  playerSlug,
  initialTab,
  mechanicsEntry,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(resolveInitialTab(initialTab));

  const sortedSessions = useMemo(() => {
    return [...trackmanSessions].sort((a, b) => b.date.localeCompare(a.date));
  }, [trackmanSessions]);

  return (
    <div className="mt-10">
      {/* Tab bar */}
      <div className="flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`relative cursor-pointer px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${
              activeTab === tab
                ? "text-white"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-red-600" />
            )}
          </button>
        ))}
      </div>
      <div className="h-px bg-zinc-800/60" />

      {/* OVERVIEW */}
      {activeTab === "Overview" && (
        <div className="mt-10 space-y-14">
          {seasonStats.length === 0 && d3Percentiles.length === 0 ? (
            <p className="text-sm text-zinc-600">
              No {seasonYear} stats available.
            </p>
          ) : (
            <>
              {/* Season Snapshot */}
              <section>
                <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                  {seasonYear} Season
                </h2>
                <div className="mt-5 grid grid-cols-3 gap-x-1 gap-y-4 sm:grid-cols-5 lg:grid-cols-9">
                  {seasonStats.map((stat, i) => (
                    <div
                      key={stat.label}
                      className="text-center opacity-0"
                      style={{
                        animation: `savantFadeIn 0.4s ease-out ${i * 50}ms forwards`,
                      }}
                    >
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                        {stat.label}
                      </div>
                      <div className="mt-1 font-mono text-[22px] font-black tabular-nums leading-none text-white">
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* D3 Percentile Rankings */}
              <section>
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                      D3 Percentile Rankings
                    </h2>
                    <p className="mt-1 text-[10px] tracking-wide text-zinc-700">
                      vs Division III pitchers, {seasonYear}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: "#3b82f6" }} />
                      Poor
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: "#a1a1aa" }} />
                      Avg
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: "#dc2626" }} />
                      Elite
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-0">
                  {d3Percentiles.map((m, i) => (
                    <SavantPercentileBar
                      key={m.label}
                      label={m.label}
                      value={m.value}
                      percentile={m.percentile}
                      index={i}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Mechanics section — always shown (empty state if no data) */}
          <section>
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-4">
              Mechanics
            </h2>
            <MechanicsProfileCard entry={mechanicsEntry ?? null} />
          </section>
        </div>
      )}

      {/* TRACKMAN */}
      {activeTab === "Trackman" && (
        <div className="mt-8">
          {/* Hub button */}
          <Link href={`/trackman/player/${playerSlug}?from=profile`}>
            <div className="group flex items-center justify-between rounded-lg border border-blue-500/30 bg-zinc-900 px-4 py-3 transition-colors hover:border-blue-500/60">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-blue-400" />
                <div>
                  <span className="text-sm font-semibold text-zinc-100">Trackman Hub</span>
                  <p className="text-[10px] text-zinc-500">Averages, trends, and movement profiles</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-blue-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>

          <h2 className="mt-8 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
            Sessions
          </h2>

          {sortedSessions.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-700">No sessions yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800/30">
              {sortedSessions.map((s) => (
                <li key={`${s.dateSlug}-${s.sessionLabel}`}>
                  <Link
                    href={`/trackman/session/${playerSlug}/${s.dateSlug}?from=profile&slug=${playerSlug}`}
                    className="flex items-center justify-between py-3 group/row"
                  >
                    <div>
                      <div className="text-sm font-bold text-zinc-200 group-hover/row:text-white transition-colors">
                        {formatDateLabel(s.date)}
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        {s.sessionLabel}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* COMMAND */}
      {activeTab === "Command" && (
        <div className="mt-8">
          {/* Command Center button */}
          <Link href="/command">
            <div className="group flex items-center justify-between rounded-lg border border-amber-500/30 bg-zinc-900 px-4 py-3 transition-colors hover:border-amber-500/60">
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-amber-400" />
                <div>
                  <span className="text-sm font-semibold text-zinc-100">Command Center</span>
                  <p className="text-[10px] text-zinc-500">All pitchers, all outings</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>

          <h2 className="mt-8 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
            Outings
          </h2>

          {commandOutings.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-700">No outings yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800/30">
              {commandOutings.map((o) => (
                <li key={o.outingId}>
                  <Link
                    href={`/player/${o.playerId}?from=profile&slug=${playerSlug}`}
                    className="flex items-center justify-between py-3 group/row"
                  >
                    <div>
                      <div className="text-sm font-bold text-zinc-200 group-hover/row:text-white transition-colors">
                        {formatDateLabel(o.dateId)}
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        {o.label}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
