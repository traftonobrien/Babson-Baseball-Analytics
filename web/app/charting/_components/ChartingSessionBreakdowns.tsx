"use client";

import { useState } from "react";
import {
  Activity,
  ChartColumnIncreasing,
  ChevronDown,
  ChevronUp,
  Radar,
  UserRound,
  UsersRound,
  MapPin,
  X,
} from "lucide-react";
import { LeaderboardPill } from "@/app/components/leaderboards/LeaderboardChrome";
import { ChartingZoneHeatmap } from "@/app/charting/_components/ChartingZoneHeatmap";
import { countPitcherInnings } from "@/lib/charting/innings";
import type {
  HitterOverviewModel,
  OutcomeSummary,
  PitchMixEntry,
  PitcherOverviewModel,
} from "@/lib/charting/sessionOverview";

function formatPct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

// === Micro Modal & Heatmap ===

function MicroZoneMapTrigger({ counts, label }: { counts: Partial<Record<number, number>>; label: string }) {
  const [isOpen, setIsOpen] = useState(false);

  // simple 3x3 aggregation just to look cool and glowing. 
  // It's a tiny visual proxy for the main map.
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex flex-col items-center justify-center p-4 rounded-[1.2rem] border border-zinc-800/80 bg-zinc-950/60 transition-colors hover:bg-zinc-900/80"
      >
        <div className="flex flex-col gap-1 w-[4.5rem] h-[4.5rem]">
          {/* Tiny dummy 3x3 grid */}
          <div className="grid grid-cols-3 gap-1 w-full h-full p-[2px]">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`rounded-[3px] w-full h-full ${i === 4 ? 'bg-sky-500/40 shadow-[0_0_8px_rgba(56,189,248,0.5)]' : i === 7 ? 'bg-amber-500/40' : 'bg-zinc-800/80'}`}></div>
            ))}
          </div>
        </div>
        <div className="mt-3 text-[10px] uppercase font-bold tracking-widest text-zinc-500">View Zone Data</div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><MapPin className="h-5 w-5 text-emerald-400" /> {label} Zone Coverage</h3>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-2 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ChartingZoneHeatmap counts={counts} emptyLabel="No tracked zone coverage" />
            <p className="mt-4 text-xs text-zinc-500 text-center">Matches the charting editor zone layout. Pitch frequency is shown relative to the most targeted zone.</p>
          </div>
        </div>
      )}
    </>
  );
}

// === Outcomes ===

function OutcomeFunnel({ outcomes }: { outcomes: OutcomeSummary }) {
  const total = outcomes.closedPas;
  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/45 px-4 py-3 text-sm text-zinc-500">
        No plate appearances yet.
      </div>
    );
  }

  const items = [
    { label: "K", value: outcomes.strikeouts, bg: "bg-emerald-500", text: "text-emerald-400" },
    { label: "BB", value: outcomes.walks, bg: "bg-sky-500", text: "text-sky-400" },
    { label: "HBP", value: outcomes.hitByPitch, bg: "bg-amber-600", text: "text-amber-500" },
    { label: "HITS", value: outcomes.hits, bg: "bg-zinc-500", text: "text-zinc-400" },
    { label: "OUTS", value: outcomes.outs, bg: "bg-zinc-700", text: "text-zinc-500" },
  ];

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider">
            <span className={item.text}>{item.label}:</span>
            <span className="text-zinc-300">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Stacked Bar */}
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-zinc-950 border border-zinc-800/50 shadow-inner">
        {items.map((item) => {
          if (item.value === 0) return null;
          const pct = (item.value / total) * 100;
          return (
            <div
              key={item.label}
              className={`h-full ${item.bg} border-r border-zinc-900/50 last:border-0 hover:brightness-110 transition-all`}
              style={{ width: `${pct}%` }}
              title={`${item.label}: ${item.value} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
    </div>
  );
}

// === Subcomponents ===

function CompactStatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "emerald" | "sky" | "amber";
}) {
  const toneClasses =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "sky"
        ? "text-sky-400"
        : tone === "amber"
          ? "text-amber-500"
          : "text-white";

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/65 px-4 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className={`text-sm font-bold ${toneClasses}`}>{value}</div>
    </div>
  );
}

function CompactPitchMixColumn({ entries }: { entries: PitchMixEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/45 px-3 py-2 text-xs text-zinc-500 flex items-center justify-center">
        No mix
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full justify-start">
      {entries.map((entry) => (
        <div
          key={entry.pitchType}
          className="flex flex-col justify-center rounded-xl border border-zinc-800/80 bg-zinc-950/75 px-3 py-[9px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300">{entry.pitchType}</span>
            <span className="text-[10px] font-medium text-zinc-400">{entry.pct.toFixed(1)}%</span>
          </div>
          <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
            <div className="h-full bg-zinc-500" style={{ width: `${entry.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CompactPitchGroup({
  label,
  pitches,
  whiffPct,
}: {
  label: string;
  pitches: number;
  whiffPct: number | null;
}) {
  return (
    <div className="flex flex-col justify-center rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-[8.5px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-0.5">
        {label}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
        <span className="font-semibold text-zinc-200">{pitches} pit</span>
        <span className="text-zinc-400">{formatPct(whiffPct)} whiff</span>
      </div>
    </div>
  );
}

// === Cards ===

function PitcherCard({ model, index }: { model: PitcherOverviewModel; index: number }) {
  const inningsCount = countPitcherInnings(model.segments, model.plateAppearances);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <article className="overflow-hidden flex flex-col rounded-[1.8rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(18,18,22,0.84),rgba(9,9,11,0.96))] shadow-[0_24px_64px_rgba(0,0,0,0.24)] transition-all duration-300">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left border-b border-zinc-800/70 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(9,9,11,0.94))] px-6 py-4 hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(9,9,11,0.94))] transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"></div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Pitcher Outing {index + 1}
              </div>
              <div className="mt-0.5 text-lg font-black text-white">{model.displayName}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LeaderboardPill tone="neutral">{inningsCount} {inningsCount === 1 ? "Inning" : "Innings"}</LeaderboardPill>
            <LeaderboardPill tone="neutral">{model.pitches.length} Pitches</LeaderboardPill>
            <LeaderboardPill tone="neutral">{model.outcomes.closedPas} PAs</LeaderboardPill>
            <div className="ml-2 p-1 rounded-full bg-zinc-800/50 text-zinc-400">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="p-6 grid gap-8 md:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6 w-full">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                <Activity className="h-3.5 w-3.5" /> True Outcomes
              </div>
              <div className="bg-zinc-900/30 border border-zinc-800/50 p-4 rounded-2xl">
                <OutcomeFunnel outcomes={model.outcomes} />
              </div>
            </div>

            <div className="space-y-4 mt-auto">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                <MapPin className="h-3.5 w-3.5" /> Zone Coverage
              </div>
              <MicroZoneMapTrigger counts={model.zoneFrequency} label={model.displayName} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              <ChartColumnIncreasing className="h-3.5 w-3.5" /> Pitch Mix & Aggression
            </div>

            <div className="grid grid-cols-[1fr_1.2fr] gap-3 h-full">
              <div className="flex flex-col justify-start gap-2 h-full">
                <CompactStatChip label="Strike" value={formatPct(model.stats?.strikePct ?? null)} tone="sky" />
                <CompactStatChip label="Zone" value={formatPct(model.stats?.zonePct ?? null)} tone="sky" />
                <CompactStatChip label="Whiff" value={formatPct(model.stats?.whiffPct ?? null)} tone="amber" />
                <CompactStatChip label="Chase" value={formatPct(model.stats?.chasePct ?? null)} tone="amber" />
                <CompactStatChip label="FPS" value={formatPct(model.stats?.fpsPct ?? null)} tone="amber" />
              </div>

              <CompactPitchMixColumn entries={model.pitchMixEntries} />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function HitterCard({ model }: { model: HitterOverviewModel }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const resultLabel =
    model.outcomes.results.length > 0 ? model.outcomes.results.join(" • ") : "Open only";

  return (
    <article className="overflow-hidden flex flex-col rounded-[1.8rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(18,18,22,0.84),rgba(9,9,11,0.96))] shadow-[0_24px_64px_rgba(0,0,0,0.24)] transition-all duration-300">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left border-b border-zinc-800/70 bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(9,9,11,0.94))] px-6 py-4 hover:bg-[linear-gradient(135deg,rgba(56,189,248,0.18),rgba(9,9,11,0.94))] transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.5)]"></div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Lineup Slot {model.lineupSlot}
              </div>
              <div className="mt-0.5 text-lg font-black text-white">{model.hitterName}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LeaderboardPill tone="neutral">{model.pitches.length} Pitches Seen</LeaderboardPill>
            <LeaderboardPill tone="neutral">{model.plateAppearances.length} PAs</LeaderboardPill>
            <div className="ml-2 p-1 rounded-full bg-zinc-800/50 text-zinc-400">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="p-6 grid gap-8 md:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6 w-full">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                <Activity className="h-3.5 w-3.5" /> True Outcomes
              </div>
              <div className="bg-zinc-900/30 border border-zinc-800/50 p-4 rounded-2xl">
                <OutcomeFunnel outcomes={model.outcomes} />
              </div>
            </div>

            <div className="space-y-4 mt-auto">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                <MapPin className="h-3.5 w-3.5" /> Zone Coverage
              </div>
              <MicroZoneMapTrigger counts={model.zoneFrequency} label={model.hitterName} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              <ChartColumnIncreasing className="h-3.5 w-3.5" /> Approach & Results
            </div>

            <div className="grid grid-cols-[1fr_1.2fr] gap-3">
              <div className="flex flex-col justify-start gap-2">
                <CompactStatChip label="Pitches" value={String(model.stats?.totalPitches ?? model.pitches.length)} tone="sky" />
                <CompactStatChip label="Chase" value={formatPct(model.stats?.chasePct ?? null)} tone="amber" />
                <CompactStatChip label="Contact" value={formatPct(model.stats?.contactPct ?? null)} tone="emerald" />
                <CompactStatChip label="K%" value={formatPct(model.stats?.kPct ?? null)} tone="emerald" />
                <CompactStatChip label="BB%" value={formatPct(model.stats?.bbPct ?? null)} tone="sky" />
              </div>

              <div className="flex flex-col justify-start gap-2 h-full">
                <CompactPitchGroup label="Fastball" pitches={model.stats?.vsFastball.pitches ?? 0} whiffPct={model.stats?.vsFastball.whiffPct ?? null} />
                <CompactPitchGroup label="Breaking" pitches={model.stats?.vsBreaking.pitches ?? 0} whiffPct={model.stats?.vsBreaking.whiffPct ?? null} />
                <CompactPitchGroup label="Offspeed" pitches={model.stats?.vsOffspeed.pitches ?? 0} whiffPct={model.stats?.vsOffspeed.whiffPct ?? null} />
              </div>
            </div>

            <div className="mt-1 flex flex-col justify-center rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 min-h-[50px]">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2">
                <Radar className="h-3.5 w-3.5" /> Result Trail
              </div>
              <div className="text-[11px] text-zinc-300 truncate font-mono bg-zinc-900/80 px-3 py-2 rounded-lg border border-zinc-800/50">{resultLabel}</div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

// === Sections ===

function SectionIntro({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-zinc-200">
          <Icon className="h-4 w-4 text-emerald-400" />
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="mt-2 max-w-3xl text-xs text-zinc-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-[1.8rem] border border-dashed border-zinc-800/80 bg-zinc-900/35 px-5 py-8 text-sm text-zinc-500 text-center font-medium">
      {message}
    </div>
  );
}

export function PitcherBreakdownSection({
  models,
}: {
  models: PitcherOverviewModel[];
}) {
  return (
    <section className="mb-10 lg:pr-8">
      <SectionIntro
        icon={UserRound}
        title="Pitcher Breakdown"
        description="Every pitcher who appeared in the session, with unified true outcomes, performance metrics, and their primary zone-by-zone pitch distribution."
      />
      {models.length === 0 ? (
        <EmptySection message="No pitcher outings are available for this game yet." />
      ) : (
        <div className="grid gap-6">
          {models.map((model, index) => (
            <PitcherCard key={model.pitcherKey} model={model} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}

export function HitterBreakdownSection({
  models,
}: {
  models: HitterOverviewModel[];
}) {
  return (
    <section className="mb-10 lg:pr-8">
      <SectionIntro
        icon={UsersRound as any}
        title="Hitter Breakdown"
        description="Aggregated approach data and true outcomes for the opponent's lineup."
      />
      {models.length === 0 ? (
        <EmptySection message="No hitter plate appearances are available for this game yet." />
      ) : (
        <div className="grid gap-6">
          {models.map((model) => (
            <HitterCard key={`${model.lineupSlot}-${model.hitterName}`} model={model} />
          ))}
        </div>
      )}
    </section>
  );
}
