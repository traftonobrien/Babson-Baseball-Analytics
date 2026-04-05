import { format, parseISO } from "date-fns";
import type { Metadata } from "next";
import {
  ChevronRight,
  ClipboardList,
  Crosshair,
  PanelBottomClose,
  Radar,
  Target,
  TrendingUp,
} from "lucide-react";
import { ChartingZoneHeatmap } from "@/app/charting/_components/ChartingZoneHeatmap";
import { TEAM_NAME } from "@/lib/teamConfig";
import { loadChartingOhTwoReport } from "@/lib/charting/ohtwo";

export const metadata: Metadata = {
  title: `0-2 Fastball Report — ${TEAM_NAME} Baseball`,
  description: "Unlinked charting study for the first 0-2 fastball in each plate appearance.",
  robots: {
    index: false,
    follow: false,
  },
};

export const revalidate = 0;

function formatAvg(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return value.toFixed(3).replace(/^0/, "");
}

function formatPct(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return `${value.toFixed(1)}%`;
}

function formatPctCompact(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return `${Math.round(value)}%`;
}

function formatDate(value: string): string {
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

function locationLabel(locationCell: number | null): string {
  return locationCell === null ? "Untracked" : `Cell ${locationCell}`;
}

function pitchResultLabel(value: string): string {
  switch (value) {
    case "called_strike":
      return "Called strike";
    case "swinging_strike":
      return "Swinging strike";
    case "bunt_foul":
      return "Bunt foul";
    case "in_play":
      return "In play";
    case "hit_by_pitch":
      return "Hit by pitch";
    default:
      return value.replace("_", " ");
  }
}

function executionLabel(value: string): string {
  switch (value) {
    case "executedBall":
      return "Executed side chase for ball";
    case "executedStrike":
      return "Executed side chase for strike";
    case "inZoneMiss":
      return "Missed in zone";
    case "otherMiss":
      return "Missed outside target";
    default:
      return "Location untracked";
  }
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-[24px] border border-border bg-surface p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
    </article>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-background px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-lg font-black tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function BreakdownBar({
  label,
  count,
  share,
}: {
  label: string;
  count: number;
  share: number | null;
}) {
  const width = share === null ? 0 : Math.max(6, Math.min(100, share));

  return (
    <div className="rounded-[20px] border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted">{count} follow-up pitches</p>
        </div>
        <p className="text-xl font-black tracking-tight text-foreground">{formatPctCompact(share)}</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-[var(--brand-primary)]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default async function OhTwoPage() {
  const report = await loadChartingOhTwoReport();

  return (
    <div className="font-display min-h-full bg-background text-foreground">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-border bg-surface shadow-sm">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  Charting Study
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-[2.85rem] sm:leading-[1.02]">
                  0-2 Fastball Report
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
                  This page isolates the exact first pitch in each plate appearance thrown on an
                  `0-2` count. If that first `0-2` pitch is a fastball, it qualifies. The report
                  is centered on two questions: did we execute the chase fastball, and did the next
                  pitch actually turn that setup into a better outcome?
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[24rem]">
                <div className="rounded-[22px] border border-border bg-background p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Crosshair className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden />
                    Scope
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">Babson pitchers only</p>
                </div>
                <div className="rounded-[22px] border border-border bg-background p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Radar className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden />
                    Sample
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">All charted game data</p>
                </div>
                <div className="rounded-[22px] border border-border bg-background p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <PanelBottomClose className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden />
                    Review
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">Feed collapsed by default</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Qualifying Fastballs"
            value={String(report.summary.qualifyingPitches)}
            detail="First 0-2 pitches that were charted as fastballs."
          />
          <StatCard
            label="Located Fastballs"
            value={String(report.summary.locatedPitches)}
            detail="Qualifying fastballs with a recorded charting location cell."
          />
          <StatCard
            label="Ended On Pitch"
            value={String(report.summary.plateAppearancesEnded)}
            detail="Plate appearances that ended on the qualifying 0-2 fastball."
          />
          <StatCard
            label="BAA On Pitch"
            value={formatAvg(report.summary.battingAverageAgainst)}
            detail="Batting average only on qualifying 0-2 fastballs that ended the at-bat."
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Location Map</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Catcher-view heatmap for the first qualifying `0-2` fastball in each plate
                appearance.
              </p>
            </div>
            <ChartingZoneHeatmap
              counts={report.locationCounts}
              emptyLabel="No 0-2 fastball locations have been charted yet."
            />
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[var(--brand-primary)]" aria-hidden />
              <h2 className="text-xl font-bold tracking-tight text-foreground">Execution</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">
              The source rows currently do not carry hitter-handedness, so execution uses the
              recorded lateral chase cells from the actual charting source: `11/12/13/14` plus
              `16/17` when present. In-zone fastballs still count as misses.
            </p>

            <div className="mt-5 grid gap-4">
              <div className="rounded-[24px] border border-border bg-background p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Execution Rate
                    </p>
                    <p className="mt-3 text-5xl font-black tracking-tight text-foreground">
                      {formatPctCompact(report.execution.executionRate)}
                    </p>
                  </div>
                  <div className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {report.execution.executedTotal} of {report.execution.locatedPitches} located
                  </div>
                </div>
                <div className="mt-5 h-3 rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-[var(--brand-primary)]"
                    style={{ width: `${Math.max(6, report.execution.executionRate ?? 0)}%` }}
                  />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <MiniStat
                    label="Executed For Ball"
                    value={`${report.execution.executedBall} • ${formatPctCompact(report.execution.executedBallRate)}`}
                  />
                  <MiniStat
                    label="Executed For Strike"
                    value={`${report.execution.executedStrike} • ${formatPctCompact(report.execution.executedStrikeRate)}`}
                  />
                  <MiniStat
                    label="In-Zone Misses"
                    value={`${report.execution.inZoneMisses} • ${formatPctCompact(report.execution.inZoneMissRate)}`}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-border bg-background p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Damage On In-Zone Misses
                </p>
                <p className="mt-3 text-4xl font-black tracking-tight text-foreground">
                  {formatAvg(report.execution.inZoneMissBattingAverageAgainst)}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Only fastballs that leaked into the zone and ended the at-bat.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <MiniStat label="Other Misses" value={String(report.execution.otherMisses)} />
                  <MiniStat label="Unknown Hands" value={String(report.execution.unknownHandPitches)} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[var(--brand-primary)]" aria-hidden />
              <h2 className="text-xl font-bold tracking-tight text-foreground">Next Pitch Results</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">
              These metrics look only at the immediate next pitch after a qualifying 0-2 fastball
              when the plate appearance continued.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
                Fastball share: {formatPctCompact(report.nextPitch.fastballShare)}
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
                Breaking-ball share: {formatPctCompact(report.nextPitch.breakingBallShare)}
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
                {report.nextPitch.total} next pitches
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Strike Rate"
                value={formatPct(report.nextPitch.strikeRate)}
                detail="How often the immediate next pitch landed as a strike."
              />
              <StatCard
                label="Out Rate"
                value={formatPct(report.nextPitch.outRate)}
                detail="Immediate next pitches that directly recorded an out."
              />
              <StatCard
                label="BAA On Next Pitch"
                value={formatAvg(report.nextPitch.battingAverageAgainst)}
                detail="Batting average on next pitches that ended the at-bat."
              />
              <StatCard
                label="Two-Pitch Out Conversion"
                value={formatPct(report.nextPitch.twoPitchOutConversionRate)}
                detail="Outs recorded either on the 0-2 fastball or on the immediate next pitch."
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-foreground">Next Pitch Breakdown</h2>
              <p className="mt-1 text-sm text-muted">
                Follow-up pitch mix and effectiveness by exact next-pitch type.
              </p>
            </div>

            {report.nextPitch.pitchTypeBreakdown.length === 0 ? (
              <div className="px-5 py-10 text-sm text-muted sm:px-6">
                No next-pitch sample yet. Every qualifying 0-2 fastball ended the at-bat.
              </div>
            ) : (
              <div className="grid gap-4 px-5 py-5 sm:px-6">
                {report.nextPitch.pitchTypeBreakdown.map((entry) => (
                  <div
                    key={entry.pitchType}
                    className="grid gap-4 rounded-[22px] border border-border bg-background p-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
                  >
                    <BreakdownBar label={entry.pitchType} count={entry.count} share={entry.share} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MiniStat label="Strike Rate" value={formatPct(entry.strikeRate)} />
                      <MiniStat label="Out Rate" value={formatPct(entry.outRate)} />
                      <MiniStat label="BAA" value={formatAvg(entry.battingAverageAgainst)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-surface shadow-sm">
          <details>
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-foreground">Event Feed</h2>
                <p className="mt-1 text-sm text-muted">
                  Expand to inspect each qualifying first `0-2` fastball and the immediate next pitch.
                </p>
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {report.events.length} events
              </div>
            </summary>

            {report.events.length === 0 ? (
              <div className="border-t border-border px-5 py-12 text-center sm:px-6">
                <p className="text-lg font-semibold text-foreground">No qualifying 0-2 fastballs yet.</p>
                <p className="mt-2 text-sm text-muted">
                  Once Babson pitchers have charted plate appearances where the first `0-2` pitch is
                  a fastball, they will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border border-t border-border">
                {report.events.map((event) => (
                  <article key={event.pitchId} className="px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                          <span>{formatDate(event.gameDate)}</span>
                          <span>vs {event.opponent}</span>
                          <span>Inning {event.inning}</span>
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
                            {event.hitterHand ? `${event.hitterHand}HH` : "Hand unknown"}
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
                          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
                            {event.velocity === null ? "Velo N/A" : `${event.velocity} mph`}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-border bg-background p-4 lg:w-[23rem]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                          Plate Appearance Outcome
                        </p>
                        <p className="mt-2 text-base font-semibold text-foreground">
                          {event.endedPlateAppearance
                            ? `Ended on the 0-2 fastball (${event.resultCode ?? "Unknown"})`
                            : `Continued after the 0-2 fastball (${event.resultCode ?? "Open PA"})`}
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
                                {event.nextPitch.velocity === null
                                  ? "Velo N/A"
                                  : `${event.nextPitch.velocity} mph`}
                              </span>
                              <span>{event.nextPitch.isStrike ? "Strike" : "Ball"}</span>
                              <span>{event.nextPitch.recordedOut ? "Recorded out" : "No out recorded"}</span>
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
