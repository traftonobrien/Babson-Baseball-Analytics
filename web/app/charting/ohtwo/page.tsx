import { format, parseISO } from "date-fns";
import type { Metadata } from "next";
import {
  Activity,
  ChevronRight,
  ClipboardList,
  Crosshair,
  Flame,
  Gauge,
  PanelBottomClose,
  Radar,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { ChartingZoneHeatmap } from "@/app/charting/_components/ChartingZoneHeatmap";
import { TEAM_NAME } from "@/lib/teamConfig";
import { loadChartingOhTwoReport } from "@/lib/charting/ohtwo";
import type {
  OhTwoPaOutcomes,
  OhTwoPitchResultBreakdown,
  OhTwoVelocityStats,
  OhTwoPitcherEntry,
  OhTwoOpponentEntry,
  OhTwoInningEntry,
  OhTwoNextPitchSummary,
} from "@/lib/charting/ohtwo";

export const metadata: Metadata = {
  title: `0-2 Fastball Report — ${TEAM_NAME} Baseball`,
  description: "Full coaching analysis of first 0-2 fastballs: execution, PA outcomes, velocity, pitcher breakdown.",
  robots: { index: false, follow: false },
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmt3(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(3).replace(/^0/, "");
}

function fmtPct(value: number | null, decimals = 1): string {
  if (value === null) return "—";
  return `${value.toFixed(decimals)}%`;
}

function fmtPctInt(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value)}%`;
}

function fmtVelo(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}`;
}

function fmtDate(value: string): string {
  try {
    return format(parseISO(value), "MMM d");
  } catch {
    return value;
  }
}

function locationLabel(cell: number | null): string {
  return cell === null ? "Untracked" : `Cell ${cell}`;
}

function pitchResultLabel(value: string): string {
  const map: Record<string, string> = {
    called_strike: "Called strike",
    swinging_strike: "Swinging strike",
    bunt_foul: "Bunt foul",
    in_play: "In play",
    hit_by_pitch: "HBP",
    foul: "Foul",
    ball: "Ball",
  };
  return map[value] ?? value.replace(/_/g, " ");
}

function executionLabel(value: string): string {
  const map: Record<string, string> = {
    executedBall: "Chase — ball",
    executedStrike: "Chase — strike",
    inZoneMiss: "In-zone miss",
    otherMiss: "Off-target",
    untracked: "Location untracked",
  };
  return map[value] ?? value;
}

// ---------------------------------------------------------------------------
// Base components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "positive" | "negative" | "neutral";
}) {
  const valueClass =
    accent === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "negative"
        ? "text-red-500 dark:text-red-400"
        : "text-foreground";

  return (
    <article className="rounded-[24px] border border-border bg-surface p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={`mt-3 text-3xl font-black tracking-tight ${valueClass}`}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
    </article>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[18px] border border-border bg-background px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-lg font-black tracking-tight text-foreground">{value}</p>
      {sub ? <p className="mt-1 text-[11px] text-muted">{sub}</p> : null}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ElementType;
  title: string;
  detail?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-[var(--brand-primary)]" aria-hidden />
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
      </div>
      {detail ? <p className="mt-2 text-sm leading-6 text-muted">{detail}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PA Outcome distribution bar
// ---------------------------------------------------------------------------

function OutcomeBar({
  label,
  count,
  share,
  colorClass,
}: {
  label: string;
  count: number;
  share: number | null;
  colorClass: string;
}) {
  const width = share === null ? 0 : Math.max(4, Math.min(100, share));
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted">{count} PA{count !== 1 ? "s" : ""}</p>
      </div>
      <div className="flex-1">
        <div className="h-2.5 overflow-hidden rounded-full bg-surface">
          <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
        </div>
      </div>
      <p className="w-10 shrink-0 text-right text-sm font-bold text-foreground">
        {fmtPctInt(share)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stacked pitch-result bar
// ---------------------------------------------------------------------------

function PitchResultSegment({
  width,
  colorClass,
  title,
}: {
  width: number;
  colorClass: string;
  title: string;
}) {
  if (width < 1) return null;
  return (
    <div
      className={`h-full ${colorClass} transition-all`}
      style={{ width: `${width}%` }}
      title={title}
    />
  );
}

// ---------------------------------------------------------------------------
// PA Outcomes section
// ---------------------------------------------------------------------------

function PaOutcomesSection({ outcomes }: { outcomes: OhTwoPaOutcomes }) {
  const atBats =
    outcomes.strikeouts + outcomes.contactOuts + outcomes.singles + outcomes.doubles +
    outcomes.triples + outcomes.homeRuns;

  return (
    <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm sm:p-7">
      <SectionHeader
        icon={TrendingUp}
        title="Full Plate Appearance Outcomes"
        detail="When Babson pitchers throw the first 0-2 fastball, here is how every plate appearance ultimately ends — not just the pitch."
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Left: key rate stats */}
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 rounded-[22px] border border-border bg-background p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Strikeout Rate
                  </p>
                  <p className="mt-3 text-5xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                    {fmtPct(outcomes.strikeoutRate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    K − BB
                  </p>
                  <p className="mt-3 text-2xl font-black tracking-tight text-foreground">
                    {outcomes.kMinusBB !== null
                      ? `${outcomes.kMinusBB > 0 ? "+" : ""}${outcomes.kMinusBB.toFixed(1)} pp`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            <MiniStat
              label="Walk Rate"
              value={fmtPct(outcomes.walkRate)}
              sub={`${outcomes.walks} BB`}
            />
            <MiniStat
              label="HBP Rate"
              value={fmtPct(outcomes.hbp > 0 ? (outcomes.hbp / outcomes.closedTotal) * 100 : null)}
              sub={`${outcomes.hbp} HBP`}
            />
            <MiniStat
              label="BAA"
              value={fmt3(outcomes.battingAverage)}
              sub={`${outcomes.singles + outcomes.doubles + outcomes.triples + outcomes.homeRuns} hits / ${atBats} AB`}
            />
            <MiniStat
              label="SLG"
              value={fmt3(outcomes.slugging)}
              sub={`${outcomes.totalBases} total bases`}
            />
            <MiniStat label="OBP" value={fmt3(outcomes.obp)} />
            <MiniStat label="OPS" value={fmt3(outcomes.ops)} />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <div className="rounded-[16px] border border-border bg-background p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">1B</p>
              <p className="mt-1 text-base font-black text-foreground">{outcomes.singles}</p>
            </div>
            <div className="rounded-[16px] border border-border bg-background p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">2B</p>
              <p className="mt-1 text-base font-black text-foreground">{outcomes.doubles}</p>
            </div>
            <div className="rounded-[16px] border border-border bg-background p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">3B</p>
              <p className="mt-1 text-base font-black text-foreground">{outcomes.triples}</p>
            </div>
            <div className="rounded-[16px] border border-border bg-background p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">HR</p>
              <p className="mt-1 text-base font-black text-foreground">{outcomes.homeRuns}</p>
            </div>
          </div>
        </div>

        {/* Right: distribution bars */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Result distribution ({outcomes.closedTotal} closed PAs)
          </p>

          <OutcomeBar
            label="Strikeout"
            count={outcomes.strikeouts}
            share={outcomes.closedTotal > 0 ? (outcomes.strikeouts / outcomes.closedTotal) * 100 : null}
            colorClass="bg-emerald-500 dark:bg-emerald-600"
          />
          <OutcomeBar
            label="Contact Out"
            count={outcomes.contactOuts}
            share={outcomes.closedTotal > 0 ? (outcomes.contactOuts / outcomes.closedTotal) * 100 : null}
            colorClass="bg-blue-500 dark:bg-blue-600"
          />
          <OutcomeBar
            label="Walk"
            count={outcomes.walks}
            share={outcomes.closedTotal > 0 ? (outcomes.walks / outcomes.closedTotal) * 100 : null}
            colorClass="bg-amber-400 dark:bg-amber-500"
          />
          <OutcomeBar
            label="Single"
            count={outcomes.singles}
            share={outcomes.closedTotal > 0 ? (outcomes.singles / outcomes.closedTotal) * 100 : null}
            colorClass="bg-red-400 dark:bg-red-500"
          />
          <OutcomeBar
            label="Extra Base"
            count={outcomes.doubles + outcomes.triples + outcomes.homeRuns}
            share={
              outcomes.closedTotal > 0
                ? ((outcomes.doubles + outcomes.triples + outcomes.homeRuns) / outcomes.closedTotal) * 100
                : null
            }
            colorClass="bg-red-600 dark:bg-red-700"
          />
          {outcomes.hbp > 0 && (
            <OutcomeBar
              label="HBP"
              count={outcomes.hbp}
              share={outcomes.closedTotal > 0 ? (outcomes.hbp / outcomes.closedTotal) * 100 : null}
              colorClass="bg-surface border border-border"
            />
          )}
          {outcomes.openPAs > 0 && (
            <OutcomeBar
              label="Open PA"
              count={outcomes.openPAs}
              share={outcomes.total > 0 ? (outcomes.openPAs / outcomes.total) * 100 : null}
              colorClass="bg-muted/40"
            />
          )}

          {/* Visual stacked bar */}
          <div className="mt-3 flex h-4 overflow-hidden rounded-full border border-border">
            {outcomes.closedTotal > 0 && (
              <>
                <PitchResultSegment
                  width={(outcomes.strikeouts / outcomes.closedTotal) * 100}
                  colorClass="bg-emerald-500 dark:bg-emerald-600"
                  title={`Strikeout ${((outcomes.strikeouts / outcomes.closedTotal) * 100).toFixed(0)}%`}
                />
                <PitchResultSegment
                  width={(outcomes.contactOuts / outcomes.closedTotal) * 100}
                  colorClass="bg-blue-500 dark:bg-blue-600"
                  title={`Contact Out ${((outcomes.contactOuts / outcomes.closedTotal) * 100).toFixed(0)}%`}
                />
                <PitchResultSegment
                  width={(outcomes.walks / outcomes.closedTotal) * 100}
                  colorClass="bg-amber-400 dark:bg-amber-500"
                  title={`Walk ${((outcomes.walks / outcomes.closedTotal) * 100).toFixed(0)}%`}
                />
                <PitchResultSegment
                  width={((outcomes.singles + outcomes.doubles + outcomes.triples + outcomes.homeRuns) / outcomes.closedTotal) * 100}
                  colorClass="bg-red-500 dark:bg-red-600"
                  title={`Hit ${(((outcomes.singles + outcomes.doubles + outcomes.triples + outcomes.homeRuns) / outcomes.closedTotal) * 100).toFixed(0)}%`}
                />
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Strikeout
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              Contact out
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              Walk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              Hit
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pitch Results section
// ---------------------------------------------------------------------------

function PitchResultsSection({ pr }: { pr: OhTwoPitchResultBreakdown }) {
  return (
    <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm sm:p-7">
      <SectionHeader
        icon={Zap}
        title="0-2 Fastball Pitch Results"
        detail="What happened on the qualifying 0-2 fastball itself — regardless of how the plate appearance ultimately ended."
      />

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-[22px] border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Called Strike
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {fmtPctInt(pr.calledStrikeRate)}
          </p>
          <p className="mt-1 text-xs text-muted">{pr.calledStrike} pitches</p>
        </div>

        <div className="rounded-[22px] border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Whiff
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {fmtPctInt(pr.swingingStrikeRate)}
          </p>
          <p className="mt-1 text-xs text-muted">{pr.swingingStrike} pitches</p>
        </div>

        <div className="rounded-[22px] border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Foul
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">
            {fmtPctInt(pr.foulRate)}
          </p>
          <p className="mt-1 text-xs text-muted">{pr.foul} pitches</p>
        </div>

        <div className="rounded-[22px] border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            In Play
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">
            {fmtPctInt(pr.inPlayRate)}
          </p>
          <p className="mt-1 text-xs text-muted">{pr.inPlay} pitches</p>
        </div>

        <div className="rounded-[22px] border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Escape (Ball)
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-amber-500 dark:text-amber-400">
            {fmtPctInt(pr.ballRate)}
          </p>
          <p className="mt-1 text-xs text-muted">{pr.ball} pitches → 1-2</p>
        </div>

        <div className="rounded-[22px] border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Strike Rate
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">
            {fmtPctInt(pr.strikeRate)}
          </p>
          <p className="mt-1 text-xs text-muted">All strike results</p>
        </div>
      </div>

      {/* Stacked visual bar */}
      {pr.total > 0 && (
        <div className="mt-5">
          <div className="flex h-5 overflow-hidden rounded-full border border-border">
            <PitchResultSegment
              width={(pr.calledStrike / pr.total) * 100}
              colorClass="bg-emerald-600 dark:bg-emerald-700"
              title={`Called Strike ${((pr.calledStrike / pr.total) * 100).toFixed(0)}%`}
            />
            <PitchResultSegment
              width={(pr.swingingStrike / pr.total) * 100}
              colorClass="bg-emerald-400 dark:bg-emerald-500"
              title={`Whiff ${((pr.swingingStrike / pr.total) * 100).toFixed(0)}%`}
            />
            <PitchResultSegment
              width={(pr.foul / pr.total) * 100}
              colorClass="bg-blue-400 dark:bg-blue-500"
              title={`Foul ${((pr.foul / pr.total) * 100).toFixed(0)}%`}
            />
            <PitchResultSegment
              width={(pr.inPlay / pr.total) * 100}
              colorClass="bg-blue-300 dark:bg-blue-400"
              title={`In Play ${((pr.inPlay / pr.total) * 100).toFixed(0)}%`}
            />
            <PitchResultSegment
              width={(pr.ball / pr.total) * 100}
              colorClass="bg-amber-400 dark:bg-amber-500"
              title={`Ball (Escape) ${((pr.ball / pr.total) * 100).toFixed(0)}%`}
            />
            {pr.hitByPitch > 0 && (
              <PitchResultSegment
                width={(pr.hitByPitch / pr.total) * 100}
                colorClass="bg-red-400 dark:bg-red-500"
                title={`HBP ${((pr.hitByPitch / pr.total) * 100).toFixed(0)}%`}
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-semibold text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
              Called K
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Whiff
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
              Foul
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-300" />
              In Play
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              Escape
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Next Pitch section (refactored from inline)
// ---------------------------------------------------------------------------

function BreakdownBar({ label, count, share }: { label: string; count: number; share: number | null }) {
  const width = share === null ? 0 : Math.max(6, Math.min(100, share));
  return (
    <div className="rounded-[20px] border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted">{count} follow-up pitches</p>
        </div>
        <p className="text-xl font-black tracking-tight text-foreground">{fmtPctInt(share)}</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-surface">
        <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function NextPitchSection({ nextPitch }: { nextPitch: OhTwoNextPitchSummary }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <SectionHeader
          icon={Activity}
          title="Next Pitch Results"
          detail="Metrics for the immediate next pitch after a qualifying 0-2 fastball when the PA continued."
        />

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
            Fastball: {fmtPctInt(nextPitch.fastballShare)}
          </span>
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
            Breaking/Off: {fmtPctInt(nextPitch.breakingBallShare)}
          </span>
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
            {nextPitch.total} next pitches
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Strike Rate"
            value={fmtPct(nextPitch.strikeRate)}
            detail="Immediate next pitch landed as a strike."
          />
          <StatCard
            label="Out Rate"
            value={fmtPct(nextPitch.outRate)}
            detail="Recorded an out on the next pitch."
          />
          <StatCard
            label="BAA on Next Pitch"
            value={fmt3(nextPitch.battingAverageAgainst)}
            detail="BA on next pitches that ended the at-bat."
          />
          <StatCard
            label="Two-Pitch Out"
            value={fmtPct(nextPitch.twoPitchOutConversionRate)}
            detail="Out on the 0-2 FB or the immediate next pitch."
            accent="positive"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-foreground">Next Pitch Mix</h2>
          <p className="mt-1 text-sm text-muted">
            Follow-up pitch effectiveness by exact pitch type.
          </p>
        </div>

        {nextPitch.pitchTypeBreakdown.length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted sm:px-6">
            No next-pitch sample. Every qualifying 0-2 fastball ended the at-bat.
          </div>
        ) : (
          <div className="grid gap-4 px-5 py-5 sm:px-6">
            {nextPitch.pitchTypeBreakdown.map((entry) => (
              <div
                key={entry.pitchType}
                className="grid gap-4 rounded-[22px] border border-border bg-background p-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
              >
                <BreakdownBar label={entry.pitchType} count={entry.count} share={entry.share} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Strike Rate" value={fmtPct(entry.strikeRate)} />
                  <MiniStat label="Out Rate" value={fmtPct(entry.outRate)} />
                  <MiniStat label="BAA" value={fmt3(entry.battingAverageAgainst)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// By Pitcher table
// ---------------------------------------------------------------------------

function ByPitcherSection({ pitchers }: { pitchers: OhTwoPitcherEntry[] }) {
  if (pitchers.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--brand-primary)]" aria-hidden />
          <h2 className="text-lg font-bold text-foreground">By Pitcher</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          Individual 0-2 fastball breakdown for each Babson pitcher. K% and BAA are full PA results.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:px-6">
                Pitcher
              </th>
              <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                #
              </th>
              <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Exec%
              </th>
              <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                K%
              </th>
              <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                BB%
              </th>
              <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                BAA
              </th>
              <th className="px-3 py-3 pr-5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:pr-6">
                Avg Velo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pitchers.map((p) => (
              <tr key={`${p.pitcherId ?? ""}__${p.pitcherName}`} className="hover:bg-surface/60">
                <td className="px-5 py-3.5 text-sm font-semibold text-foreground sm:px-6">
                  {p.pitcherName}
                </td>
                <td className="px-3 py-3.5 text-center text-sm font-bold text-foreground">
                  {p.count}
                </td>
                <td className="px-3 py-3.5 text-center text-sm font-bold text-foreground">
                  {fmtPctInt(p.executionRate)}
                </td>
                <td className="px-3 py-3.5 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {fmtPctInt(p.strikeoutRate)}
                </td>
                <td className="px-3 py-3.5 text-center text-sm font-bold text-foreground">
                  {fmtPctInt(p.walkRate)}
                </td>
                <td className="px-3 py-3.5 text-center text-sm font-bold text-foreground">
                  {fmt3(p.battingAverageAgainst)}
                </td>
                <td className="px-3 py-3.5 pr-5 text-center text-sm font-bold text-foreground sm:pr-6">
                  {fmtVelo(p.avgVelocity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Velocity + Opponent + Inning context row
// ---------------------------------------------------------------------------

function VelocityPanel({ vel }: { vel: OhTwoVelocityStats }) {
  return (
    <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-[var(--brand-primary)]" aria-hidden />
        <h2 className="text-lg font-bold tracking-tight text-foreground">Velocity</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        Gun readings on the qualifying 0-2 fastballs ({vel.tracked} tracked, {vel.untracked} untracked).
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[20px] border border-border bg-background p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Avg</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
            {vel.avg !== null ? vel.avg.toFixed(1) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">mph</p>
        </div>
        <div className="rounded-[20px] border border-border bg-background p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Max</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
            {vel.max ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted">mph</p>
        </div>
        <div className="rounded-[20px] border border-border bg-background p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Min</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
            {vel.min ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted">mph</p>
        </div>
      </div>
    </div>
  );
}

function OpponentPanel({ opponents }: { opponents: OhTwoOpponentEntry[] }) {
  if (opponents.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-lg font-bold text-foreground">By Opponent</h2>
        <p className="mt-1 text-sm text-muted">K% and BAA are full PA results against each opponent.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                Opponent
              </th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
                #
              </th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
                K%
              </th>
              <th className="px-3 py-2.5 pr-5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
                BAA
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {opponents.map((opp) => (
              <tr key={opp.opponent} className="hover:bg-surface/60">
                <td className="px-5 py-3 text-sm font-semibold text-foreground">{opp.opponent}</td>
                <td className="px-3 py-3 text-center text-sm font-bold text-foreground">{opp.count}</td>
                <td className="px-3 py-3 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {fmtPctInt(opp.strikeoutRate)}
                </td>
                <td className="px-3 py-3 pr-5 text-center text-sm font-bold text-foreground">
                  {fmt3(opp.battingAverageAgainst)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InningPanel({ innings }: { innings: OhTwoInningEntry[] }) {
  if (innings.length === 0) return null;
  const maxCount = Math.max(...innings.map((i) => i.count));

  return (
    <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-bold tracking-tight text-foreground">By Inning</h2>
      <p className="mt-1 text-sm text-muted">Distribution of qualifying 0-2 fastballs by inning.</p>
      <div className="mt-5 flex flex-col gap-2">
        {innings.map((entry) => (
          <div key={entry.inning} className="flex items-center gap-3">
            <p className="w-16 shrink-0 text-sm font-semibold text-muted">
              Inning {entry.inning}
            </p>
            <div className="flex-1">
              <div className="h-2.5 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-[var(--brand-primary)]"
                  style={{ width: `${maxCount > 0 ? (entry.count / maxCount) * 100 : 0}%` }}
                />
              </div>
            </div>
            <p className="w-16 shrink-0 text-right text-sm font-bold text-foreground">
              {entry.count} ({fmtPctInt(entry.share)})
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function OhTwoPage() {
  const report = await loadChartingOhTwoReport();
  const { summary, execution, nextPitch, paOutcomes, pitchResults, velocity, byPitcher, byOpponent, inningDistribution, events, locationCounts } = report;

  return (
    <div className="font-display min-h-full bg-background text-foreground">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">

        {/* ------------------------------------------------------------------ */}
        {/* Header */}
        {/* ------------------------------------------------------------------ */}
        <header className="rounded-[28px] border border-border bg-surface shadow-sm">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  Charting Study · Babson Pitchers Only
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-[2.85rem] sm:leading-[1.02]">
                  0-2 Fastball Report
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
                  Isolates the first fastball thrown with an 0-2 count in every charted plate
                  appearance. Two coaching questions drive this report: did we execute the chase
                  fastball, and — when we reach 0-2 on a fastball — how does the full at-bat end?
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[24rem]">
                <div className="rounded-[22px] border border-border bg-background p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Crosshair className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden />
                    Scope
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">Babson pitchers · game sessions</p>
                </div>
                <div className="rounded-[22px] border border-border bg-background p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Radar className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden />
                    Sample
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{summary.qualifyingPitches} qualifying PAs</p>
                </div>
                <div className="rounded-[22px] border border-border bg-background p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <PanelBottomClose className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden />
                    Feed
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">Collapsed · expand below</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* Hero stats */}
        {/* ------------------------------------------------------------------ */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="0-2 Fastballs"
            value={String(summary.qualifyingPitches)}
            detail="Qualifying first 0-2 FB in each PA."
          />
          <StatCard
            label="Located"
            value={String(summary.locatedPitches)}
            detail={`${summary.qualifyingPitches - summary.locatedPitches} untracked location.`}
          />
          <StatCard
            label="Execution Rate"
            value={fmtPct(execution.executionRate)}
            detail="Chase-side location out of located pitches."
            accent="positive"
          />
          <StatCard
            label="K% (full PA)"
            value={fmtPct(paOutcomes.strikeoutRate)}
            detail="Strikeout rate across all qualifying PAs."
            accent="positive"
          />
          <StatCard
            label="BB% (full PA)"
            value={fmtPct(paOutcomes.walkRate)}
            detail="Walk rate across all qualifying PAs."
            accent="neutral"
          />
          <StatCard
            label="Whiff Rate"
            value={fmtPctInt(pitchResults.swingingStrikeRate)}
            detail="Swinging strikes on the 0-2 fastball."
            accent="positive"
          />
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Location map + Execution */}
        {/* ------------------------------------------------------------------ */}
        <section className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Location Map</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Catcher-view heatmap of where the qualifying 0-2 fastballs were thrown.
              </p>
            </div>
            <ChartingZoneHeatmap
              counts={locationCounts}
              emptyLabel="No 0-2 fastball locations charted yet."
            />
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[var(--brand-primary)]" aria-hidden />
              <h2 className="text-xl font-bold tracking-tight text-foreground">Execution</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">
              Chase execution uses lateral out-of-zone cells (11–14, 16–17). When hitter hand is
              unknown the fallback uses all lateral cells. In-zone fastballs are misses.
            </p>

            <div className="mt-5 grid gap-4">
              <div className="rounded-[24px] border border-border bg-background p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Execution Rate
                    </p>
                    <p className="mt-3 text-5xl font-black tracking-tight text-foreground">
                      {fmtPctInt(execution.executionRate)}
                    </p>
                  </div>
                  <div className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {execution.executedTotal} of {execution.locatedPitches} located
                  </div>
                </div>
                <div className="mt-5 h-3 rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-[var(--brand-primary)]"
                    style={{ width: `${Math.max(6, execution.executionRate ?? 0)}%` }}
                  />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <MiniStat
                    label="Chase · Ball"
                    value={`${execution.executedBall}`}
                    sub={fmtPctInt(execution.executedBallRate)}
                  />
                  <MiniStat
                    label="Chase · Strike"
                    value={`${execution.executedStrike}`}
                    sub={fmtPctInt(execution.executedStrikeRate)}
                  />
                  <MiniStat
                    label="In-Zone Misses"
                    value={`${execution.inZoneMisses}`}
                    sub={fmtPctInt(execution.inZoneMissRate)}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-border bg-background p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Damage On In-Zone Misses
                </p>
                <p className="mt-3 text-4xl font-black tracking-tight text-foreground">
                  {fmt3(execution.inZoneMissBattingAverageAgainst)}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Batting average on in-zone leaks that ended the at-bat.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <MiniStat label="Off-Target Misses" value={String(execution.otherMisses)} />
                  <MiniStat label="Unknown Hand" value={String(execution.unknownHandPitches)} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* PA Outcomes (the centerpiece) */}
        {/* ------------------------------------------------------------------ */}
        <PaOutcomesSection outcomes={paOutcomes} />

        {/* ------------------------------------------------------------------ */}
        {/* Pitch Results breakdown */}
        {/* ------------------------------------------------------------------ */}
        <PitchResultsSection pr={pitchResults} />

        {/* ------------------------------------------------------------------ */}
        {/* Next Pitch */}
        {/* ------------------------------------------------------------------ */}
        <NextPitchSection nextPitch={nextPitch} />

        {/* ------------------------------------------------------------------ */}
        {/* By Pitcher */}
        {/* ------------------------------------------------------------------ */}
        <ByPitcherSection pitchers={byPitcher} />

        {/* ------------------------------------------------------------------ */}
        {/* Context: Velocity + Opponent + Inning */}
        {/* ------------------------------------------------------------------ */}
        <section className="grid gap-6 lg:grid-cols-3">
          <VelocityPanel vel={velocity} />
          <OpponentPanel opponents={byOpponent} />
          <InningPanel innings={inningDistribution} />
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Event Feed */}
        {/* ------------------------------------------------------------------ */}
        <section className="rounded-[28px] border border-border bg-surface shadow-sm">
          <details>
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-foreground">Event Feed</h2>
                <p className="mt-1 text-sm text-muted">
                  Every qualifying 0-2 fastball with PA outcome and immediate next pitch.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {events.length} events
                </div>
                <Flame className="h-4 w-4 text-muted" aria-hidden />
              </div>
            </summary>

            {events.length === 0 ? (
              <div className="border-t border-border px-5 py-12 text-center sm:px-6">
                <p className="text-lg font-semibold text-foreground">No qualifying 0-2 fastballs yet.</p>
                <p className="mt-2 text-sm text-muted">
                  Charted plate appearances where the first 0-2 pitch is a fastball will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border border-t border-border">
                {events.map((event) => (
                  <article key={event.pitchId} className="px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                          <span>{fmtDate(event.gameDate)}</span>
                          <span>vs {event.opponent}</span>
                          <span>Inn. {event.inning}</span>
                          <span>Slot {event.lineupSlot}</span>
                        </div>
                        <h3 className="mt-2 text-lg font-bold tracking-tight text-foreground">
                          {event.pitcherName} vs {event.hitterName}
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground">
                            0-2 Fastball
                          </span>
                          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
                            {event.hitterHand ? `${event.hitterHand}HH` : "Hand N/A"}
                          </span>
                          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
                            {locationLabel(event.locationCell)}
                          </span>
                          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
                            {pitchResultLabel(event.pitchResult)}
                          </span>
                          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
                            {executionLabel(event.executionCategory)}
                          </span>
                          {event.velocity !== null && (
                            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
                              {event.velocity} mph
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-border bg-background p-4 lg:w-[24rem]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                          PA Outcome
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {event.endedPlateAppearance
                            ? `Ended on pitch — ${event.resultCode ?? "Unknown"}`
                            : `Continued — PA result: ${event.resultCode ?? "Open"}`}
                        </p>
                        {event.nextPitch ? (
                          <div className="mt-4 rounded-[18px] border border-border bg-surface p-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                              <span>Next pitch</span>
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                              <span>{event.nextPitch.countLabel}</span>
                            </div>
                            <div className="mt-2 grid gap-2 text-sm text-foreground sm:grid-cols-2">
                              <span>{event.nextPitch.pitchType}</span>
                              <span>{pitchResultLabel(event.nextPitch.pitchResult)}</span>
                              <span>{locationLabel(event.nextPitch.locationCell)}</span>
                              <span>
                                {event.nextPitch.velocity !== null
                                  ? `${event.nextPitch.velocity} mph`
                                  : "Velo N/A"}
                              </span>
                              <span>{event.nextPitch.isStrike ? "Strike" : "Ball"}</span>
                              <span>{event.nextPitch.recordedOut ? "Out recorded" : "No out"}</span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </details>
        </section>
      </div>
    </div>
  );
}
