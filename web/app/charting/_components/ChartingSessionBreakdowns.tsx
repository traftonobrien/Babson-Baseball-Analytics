import {
  Activity,
  ChartColumnIncreasing,
  Radar,
  UserRound,
  UsersRound,
} from "lucide-react";
import { LeaderboardPill } from "@/app/components/leaderboards/LeaderboardChrome";
import { ChartingZoneHeatmap } from "@/app/charting/_components/ChartingZoneHeatmap";
import type {
  HitterOverviewModel,
  OutcomeSummary,
  PitchMixEntry,
  PitcherOverviewModel,
} from "@/lib/charting/sessionOverview";

function formatPct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function StatChip({
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
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : tone === "sky"
        ? "border-sky-500/20 bg-sky-500/10 text-sky-200"
        : tone === "amber"
          ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
          : "border-zinc-800/80 bg-zinc-950/65 text-zinc-200";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClasses}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
    </div>
  );
}

function PitchMixRow({ entries }: { entries: PitchMixEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-950/45 px-4 py-3 text-sm text-zinc-500">
        No pitch mix yet.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((entry) => (
        <div
          key={entry.pitchType}
          className="rounded-full border border-zinc-800/80 bg-zinc-950/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300"
        >
          {entry.pitchType} <span className="text-zinc-500">{entry.count} · {entry.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function OutcomeStrip({ outcomes }: { outcomes: OutcomeSummary }) {
  const items = [
    { label: "K", value: outcomes.strikeouts, tone: "emerald" as const },
    { label: "BB", value: outcomes.walks, tone: "sky" as const },
    { label: "HBP", value: outcomes.hitByPitch, tone: "amber" as const },
    { label: "Hits", value: outcomes.hits, tone: "neutral" as const },
    { label: "Outs", value: outcomes.outs, tone: "neutral" as const },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <StatChip
          key={item.label}
          label={item.label}
          value={String(item.value)}
          tone={item.tone}
        />
      ))}
    </div>
  );
}

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
          <Icon className="h-4 w-4 text-zinc-400" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500">{description}</p>
      </div>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-[1.8rem] border border-dashed border-zinc-800/80 bg-zinc-900/35 px-5 py-8 text-sm text-zinc-500">
      {message}
    </div>
  );
}

function formatInningWindow(start: number | null, end: number | null): string | null {
  if (start !== null && end !== null) {
    return start === end ? `${start}` : `${start}-${end}`;
  }

  if (start !== null) {
    return `${start}+`;
  }

  if (end !== null) {
    return `through ${end}`;
  }

  return null;
}

function outingSpanLabel(model: PitcherOverviewModel): string | null {
  const labels = model.segments
    .map((segment) => formatInningWindow(segment.enteredInning, segment.exitedInning))
    .filter((label): label is string => label !== null);

  if (labels.length === 0) {
    return null;
  }

  return labels.join(" / ");
}

function PitcherCard({ model, index }: { model: PitcherOverviewModel; index: number }) {
  const spanLabel = outingSpanLabel(model);

  return (
    <article className="overflow-hidden rounded-[1.9rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(18,18,22,0.84),rgba(9,9,11,0.96))] shadow-[0_24px_64px_rgba(0,0,0,0.24)]">
      <div className="border-b border-zinc-800/70 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(9,9,11,0.94))] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Pitcher Outing {index + 1}
            </div>
            <div className="mt-1 text-xl font-black text-white">{model.displayName}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {spanLabel ? <LeaderboardPill tone="neutral">Inn. {spanLabel}</LeaderboardPill> : null}
            <LeaderboardPill tone="neutral">
              {model.segments.length} {model.segments.length === 1 ? "segment" : "segments"}
            </LeaderboardPill>
            <LeaderboardPill tone="neutral">{model.pitches.length} pitches</LeaderboardPill>
            <LeaderboardPill tone="neutral">{model.outcomes.closedPas} closed PAs</LeaderboardPill>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatChip label="Strike" value={formatPct(model.stats?.strikePct ?? null)} tone="emerald" />
          <StatChip label="Zone" value={formatPct(model.stats?.zonePct ?? null)} tone="sky" />
          <StatChip label="Whiff" value={formatPct(model.stats?.whiffPct ?? null)} tone="amber" />
          <StatChip label="Chase" value={formatPct(model.stats?.chasePct ?? null)} />
          <StatChip label="FPS" value={formatPct(model.stats?.fpsPct ?? null)} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <ChartColumnIncreasing className="h-4 w-4 text-zinc-500" />
            Pitch Mix
          </div>
          <PitchMixRow entries={model.pitchMixEntries} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Activity className="h-4 w-4 text-zinc-500" />
            Plate Appearance Outcomes
          </div>
          <OutcomeStrip outcomes={model.outcomes} />
        </div>

        <ChartingZoneHeatmap counts={model.zoneFrequency} />
      </div>
    </article>
  );
}

function PitchGroupChip({
  label,
  pitches,
  whiffPct,
}: {
  label: string;
  pitches: number;
  whiffPct: number | null;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-100">{pitches} pitches</span>
        <span className="text-sm text-zinc-400">{formatPct(whiffPct)}</span>
      </div>
    </div>
  );
}

function HitterCard({ model }: { model: HitterOverviewModel }) {
  const resultLabel =
    model.outcomes.results.length > 0 ? model.outcomes.results.join(" • ") : "Open only";

  return (
    <article className="overflow-hidden rounded-[1.9rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(18,18,22,0.84),rgba(9,9,11,0.96))] shadow-[0_24px_64px_rgba(0,0,0,0.24)]">
      <div className="border-b border-zinc-800/70 bg-[linear-gradient(135deg,rgba(56,189,248,0.14),rgba(9,9,11,0.94))] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Lineup Slot {model.lineupSlot}
            </div>
            <div className="mt-1 text-xl font-black text-white">{model.hitterName}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <LeaderboardPill tone="neutral">{model.pitches.length} pitches seen</LeaderboardPill>
            <LeaderboardPill tone="neutral">{model.plateAppearances.length} PAs</LeaderboardPill>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatChip label="Pitches" value={String(model.stats?.totalPitches ?? model.pitches.length)} tone="sky" />
          <StatChip label="Chase" value={formatPct(model.stats?.chasePct ?? null)} tone="amber" />
          <StatChip label="Contact" value={formatPct(model.stats?.contactPct ?? null)} tone="emerald" />
          <StatChip label="K%" value={formatPct(model.stats?.kPct ?? null)} />
          <StatChip label="BB%" value={formatPct(model.stats?.bbPct ?? null)} />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <PitchGroupChip
            label="Fastball"
            pitches={model.stats?.vsFastball.pitches ?? 0}
            whiffPct={model.stats?.vsFastball.whiffPct ?? null}
          />
          <PitchGroupChip
            label="Breaking"
            pitches={model.stats?.vsBreaking.pitches ?? 0}
            whiffPct={model.stats?.vsBreaking.whiffPct ?? null}
          />
          <PitchGroupChip
            label="Offspeed"
            pitches={model.stats?.vsOffspeed.pitches ?? 0}
            whiffPct={model.stats?.vsOffspeed.whiffPct ?? null}
          />
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Radar className="h-4 w-4 text-zinc-500" />
            Result Trail
          </div>
          <div className="mt-2 text-sm text-zinc-400">{resultLabel}</div>
        </div>

        <ChartingZoneHeatmap counts={model.zoneFrequency} emptyLabel="No tracked zone coverage" />
      </div>
    </article>
  );
}

export function PitcherBreakdownSection({
  models,
}: {
  models: PitcherOverviewModel[];
}) {
  return (
    <section className="mb-8">
      <SectionIntro
        icon={UserRound}
        title="Pitcher Breakdown"
        description="One outing card per pitcher, merging repeat inning segments into a single review with pitch mix, rate stats, outcomes, and charting-grid coverage."
      />
      {models.length === 0 ? (
        <EmptySection message="No pitcher outings are available for this game yet." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
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
    <section className="mb-8">
      <SectionIntro
        icon={UsersRound}
        title="Hitter Breakdown"
        description="Every tracked hitter in the session, with swing behavior, pitch-group context, outcome trail, and catcher-view zone coverage."
      />
      {models.length === 0 ? (
        <EmptySection message="No hitter plate appearances are available for this game yet." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {models.map((model) => (
            <HitterCard key={`${model.lineupSlot}-${model.hitterName}`} model={model} />
          ))}
        </div>
      )}
    </section>
  );
}
