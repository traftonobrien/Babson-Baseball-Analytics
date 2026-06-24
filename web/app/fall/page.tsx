import Link from "next/link";
import { ClipboardList, Plus, Users, TrendingUp } from "lucide-react";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import {
  listAllFallPitcherOutingsForTeam,
  aggregateFallPitcherOutings,
  type FallPitcherRosterEntry,
} from "@/lib/fall/pitcherOutings";
import { deriveFallHitterStats } from "@/lib/charting/fallHitterAggregation";
import { deriveAvailability } from "@/lib/fall/availability";
import { FallAvailabilityBoard } from "./_components/FallAvailabilityBoard";
import { FallCalendar } from "./_components/FallCalendar";

export const runtime = "nodejs";

const TYPE_SHORT: Record<string, string> = {
  bullpen: "BP",
  live_ab: "Live",
  intersquad: "IS",
  scrimmage: "Scrm",
  game: "Game",
  other: "—",
};

function fmt1(n: number | null): string {
  return n !== null ? n.toFixed(1) : "—";
}
function fmt2(n: number | null): string {
  return n !== null ? n.toFixed(2) : "—";
}
function fmtPct(n: number | null): string {
  return n !== null ? n.toFixed(1) + "%" : "—";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
      {children}
    </div>
  );
}

function PitcherStatsRow({ entry }: { entry: FallPitcherRosterEntry }) {
  const s = entry.season;
  const outingTypeCounts = Object.entries(s.byType)
    .filter(([, v]) => v.outings > 0)
    .map(([t, v]) => `${v.outings}${TYPE_SHORT[t] ?? t}`)
    .join(" / ");

  return (
    <div className="grid grid-cols-[1fr_repeat(8,auto)] items-center gap-x-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <div>
        <div className="font-bold text-foreground">{entry.playerName}</div>
        <div className="mt-0.5 text-[11px] text-muted">{outingTypeCounts || "—"}</div>
      </div>
      {[
        [fmt1(s.inningsPitched), "IP"],
        [String(s.pitchCount), "P"],
        [fmtPct(s.strikePct), "Str%"],
        [fmtPct(s.fpsPct), "FPS%"],
        [`${s.strikeouts}/${s.walks}`, "K/BB"],
        [fmt2(s.whip), "WHIP"],
        [fmt2(s.era), "ERA"],
        [String(s.outingCount), "G"],
      ].map(([val, label]) => (
        <div key={label} className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
          <div className="font-bold text-foreground">{val}</div>
        </div>
      ))}
    </div>
  );
}

export default async function FallHubPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [{ allOutings, byPlayer }, allHitters] = await Promise.all([
    listAllFallPitcherOutingsForTeam().catch(() => ({ allOutings: [], byPlayer: [] })),
    deriveFallHitterStats().catch(() => []),
  ]);

  const topHitters = [...allHitters]
    .filter((h) => h.pa >= 10)
    .sort((a, b) => (b.ops ?? 0) - (a.ops ?? 0))
    .slice(0, 5);

  const teamSeason = aggregateFallPitcherOutings(allOutings);
  const availability = deriveAvailability(allOutings, today);

  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-5xl">
      <div className="py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Babson Baseball
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Fall Hub
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
              Pitcher arm status, throw calendar, stats, and quick access.
            </p>
          </div>
          <Link
            href="/fall/outing/new"
            className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-foreground transition-smooth hover:bg-surface-muted"
          >
            <Plus className="h-4 w-4" />
            Log Outing
          </Link>
        </div>

        {/* Availability board */}
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <SectionLabel>Arm Status — {today}</SectionLabel>
            <span className="text-[10px] text-muted">Hover status badge for detail</span>
          </div>
          <FallAvailabilityBoard players={availability} />
        </section>

        {/* Throw calendar */}
        <section className="mt-8">
          <div className="mb-3">
            <SectionLabel>Throw Calendar</SectionLabel>
          </div>
          <FallCalendar outings={allOutings} today={today} />
        </section>

        {/* Team totals bar */}
        {allOutings.length > 0 && (
          <div className="mt-8 grid grid-cols-4 gap-2 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-8">
            {[
              ["Players", String(byPlayer.length)],
              ["Outings", String(teamSeason.outingCount)],
              ["IP", fmt1(teamSeason.inningsPitched)],
              ["Pitches", String(teamSeason.pitchCount)],
              ["Str%", fmtPct(teamSeason.strikePct)],
              ["FPS%", fmtPct(teamSeason.fpsPct)],
              ["WHIP", fmt2(teamSeason.whip)],
              ["ERA", fmt2(teamSeason.era)],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 text-center">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</span>
                <span className="text-xl font-black tracking-tight text-foreground">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pitcher stats table */}
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <SectionLabel>Pitcher Stats</SectionLabel>
            <Link href="/fall/outings" className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-foreground">
              All outings →
            </Link>
          </div>

          {byPlayer.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted">
              No pitcher outings logged yet.{" "}
              <Link href="/fall/outing/new" className="font-bold text-foreground underline underline-offset-2">
                Log the first one.
              </Link>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {byPlayer.map((entry) => (
                <PitcherStatsRow key={entry.playerId} entry={entry} />
              ))}
            </div>
          )}
        </section>

        {/* Hitter stats preview */}
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <SectionLabel>Hitter Stats — Top OPS</SectionLabel>
            <Link href="/fall/hitters" className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-foreground">
              Full leaderboard →
            </Link>
          </div>
          {topHitters.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface-muted p-6 text-center text-sm text-muted">
              No hitter stats available (min 10 PA).
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {topHitters.map((h, i) => (
                <div
                  key={h.hitterName}
                  className="grid grid-cols-[auto_1fr_repeat(4,auto)] items-center gap-x-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                >
                  <span className="w-5 text-center text-[11px] font-bold text-muted">{i + 1}</span>
                  <span className="font-bold text-foreground">{h.hitterName}</span>
                  {[
                    ["AVG", h.avg !== null ? h.avg.toFixed(3).replace(/^0\./, ".") : "—"],
                    ["OBP", h.obp !== null ? h.obp.toFixed(3).replace(/^0\./, ".") : "—"],
                    ["SLG", h.slg !== null ? h.slg.toFixed(3).replace(/^0\./, ".") : "—"],
                    ["OPS", h.ops !== null ? h.ops.toFixed(3).replace(/^0\./, ".") : "—"],
                  ].map(([label, value]) => (
                    <span key={label} className="text-right">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</span>
                      <span className="font-bold text-foreground">{value}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick links */}
        <section className="mt-8">
          <SectionLabel>Quick Access</SectionLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { href: "/fall/outing/new", icon: Plus, title: "Log Pitcher Outing", detail: "Enter pitch, result, FPS, and summary rows." },
              { href: "/fall/outings", icon: ClipboardList, title: "All Outings", detail: "Browse every logged outing across all pitchers." },
              { href: "/fall/hitters", icon: TrendingUp, title: "Hitter Stats", detail: "Full fall hitting leaderboard sorted by OPS." },
              { href: "/account", icon: Users, title: "My Portal", detail: "Personalized view — outing history and player links." },
            ].map(({ href, icon: Icon, title, detail }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4 transition-smooth hover:border-[var(--brand-primary-border)] hover:bg-surface-muted"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-muted">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-foreground">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted">{detail}</span>
                  </span>
                </span>
                <svg className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </LeaderboardPageFrame>
  );
}
