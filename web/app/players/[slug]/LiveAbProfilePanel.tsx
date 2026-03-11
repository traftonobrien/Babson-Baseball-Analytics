"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, ClipboardList } from "lucide-react";
import {
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardStatBlock,
} from "@/app/components/leaderboards/LeaderboardChrome";
import type { ChartingPlayerProfile } from "@/lib/charting/playerProfile";

function formatDateLabel(raw: string): string {
  const [year, month, day] = raw.split("-");
  if (!year || !month || !day) {
    return raw;
  }

  return `${Number(month)}/${Number(day)}/${year.slice(2)}`;
}

function formatPct(value: number | null): string {
  return value !== null ? `${value.toFixed(1)}%` : "--";
}

function formatRate(value: number | null): string {
  return value !== null ? value.toFixed(3).replace(/^0\./, ".") : "--";
}

function formatNumber(value: number | null): string {
  return value !== null ? String(value) : "--";
}

function SessionList({
  title,
  sessions,
}: {
  title: string;
  sessions: Array<{ gameId: string; gameDate: string; opponent: string | null; label: string }>;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
            {title}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Recent charted Live AB sessions for this player.
          </p>
        </div>
        <LeaderboardPill tone="emerald">
          {sessions.length} Session{sessions.length === 1 ? "" : "s"}
        </LeaderboardPill>
      </div>

      <LeaderboardPanel className="overflow-hidden p-2 sm:p-3">
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
            No Live AB sessions yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={`${session.gameId}-${title}`}>
                <Link
                  href={`/charting/games/${session.gameId}`}
                  className="group flex items-center justify-between rounded-2xl border border-zinc-900 bg-zinc-950/50 px-4 py-4 transition-smooth hover:border-emerald-500/20 hover:bg-zinc-900/60"
                >
                  <div>
                    <div className="text-sm font-bold text-zinc-200 transition-smooth group-hover:text-white">
                      {formatDateLabel(session.gameDate)}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {session.opponent || "Live AB"}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-600 opacity-70 transition-smooth group-hover:text-emerald-300 group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </LeaderboardPanel>
    </section>
  );
}

export default function LiveAbProfilePanel({
  profile,
}: {
  profile: ChartingPlayerProfile;
}) {
  const pitcher = profile.pitcher;
  const hitter = profile.hitter;

  if (!pitcher && !hitter) {
    return (
      <LeaderboardPanel className="p-5 text-sm text-zinc-500">
        No Live AB data has been charted for this player yet.
      </LeaderboardPanel>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <Link href="/charting/leaderboard">
          <div className="group rounded-[1.7rem] border border-emerald-500/25 bg-zinc-950/72 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.24)] transition-smooth hover:-translate-y-0.5 hover:border-emerald-400/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Live AB Leaderboard</div>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                    Open the full charting leaderboard and cross-session rankings.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-emerald-300 opacity-70 transition-smooth group-hover:opacity-100" />
            </div>
          </div>
        </Link>
      </section>

      {pitcher ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                Pitching Live AB
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Charted workload and pitch-quality context from Live AB sessions.
              </p>
            </div>
            <LeaderboardPill tone="emerald">
              {pitcher.stats?.sessions ?? pitcher.sessions.length} Session
              {(pitcher.stats?.sessions ?? pitcher.sessions.length) === 1 ? "" : "s"}
            </LeaderboardPill>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <LeaderboardStatBlock
              label="Innings"
              value={formatNumber(pitcher.stats?.innings ?? null)}
              detail="charted inning span"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="Pitches"
              value={formatNumber(pitcher.stats?.totalPitches ?? null)}
              detail="total charted pitches"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="TBF"
              value={formatNumber(pitcher.stats?.totalPAs ?? null)}
              detail="total batters faced"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="Strike%"
              value={formatPct(pitcher.stats?.strikePct ?? null)}
              detail="all charted pitches"
              emphasisClassName="text-emerald-300"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <LeaderboardStatBlock
              label="Zone%"
              value={formatPct(pitcher.stats?.zonePct ?? null)}
              detail="located pitches in zone"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="Whiff%"
              value={formatPct(pitcher.stats?.whiffPct ?? null)}
              detail="swinging strikes per swing"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="K%"
              value={formatPct(pitcher.stats?.kPct ?? null)}
              detail="completed plate appearances"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="BB%"
              value={formatPct(pitcher.stats?.bbPct ?? null)}
              detail="completed plate appearances"
              emphasisClassName="text-zinc-100"
            />
          </div>

          <SessionList title="Pitching Sessions" sessions={pitcher.sessions} />
        </section>
      ) : null}

      {hitter ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                Hitting Live AB
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Charted approach and production from Live AB plate appearances.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LeaderboardPill tone="emerald">
                {hitter.stats?.sessions ?? hitter.sessions.length} Session
                {(hitter.stats?.sessions ?? hitter.sessions.length) === 1 ? "" : "s"}
              </LeaderboardPill>
              {hitter.matchedHitterNames.length > 1 ? (
                <LeaderboardPill tone="neutral">
                  {hitter.matchedHitterNames.length} charted names merged
                </LeaderboardPill>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <LeaderboardStatBlock
              label="PAs"
              value={formatNumber(hitter.stats?.totalPAs ?? null)}
              detail="charted plate appearances"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="AVG"
              value={formatRate(hitter.stats?.avg ?? null)}
              detail="charted outcomes only"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="OPS"
              value={formatRate(hitter.stats?.ops ?? null)}
              detail="OBP + SLG"
              emphasisClassName="text-emerald-300"
            />
            <LeaderboardStatBlock
              label="Contact%"
              value={formatPct(hitter.stats?.contactPct ?? null)}
              detail="any contact per swing"
              emphasisClassName="text-zinc-100"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <LeaderboardStatBlock
              label="Chase%"
              value={formatPct(hitter.stats?.chasePct ?? null)}
              detail="swings outside zone"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="Z-Swing%"
              value={formatPct(hitter.stats?.zoneSwingPct ?? null)}
              detail="swings in zone"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="K%"
              value={formatPct(hitter.stats?.kPct ?? null)}
              detail="completed plate appearances"
              emphasisClassName="text-zinc-100"
            />
            <LeaderboardStatBlock
              label="BB%"
              value={formatPct(hitter.stats?.bbPct ?? null)}
              detail="completed plate appearances"
              emphasisClassName="text-zinc-100"
            />
          </div>

          <SessionList title="Hitting Sessions" sessions={hitter.sessions} />
        </section>
      ) : null}

      {profile.availableRoles.length > 1 ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <BarChart3 className="h-4 w-4" />
          This player has both pitcher and hitter Live AB data in the charting system.
        </div>
      ) : null}
    </div>
  );
}
