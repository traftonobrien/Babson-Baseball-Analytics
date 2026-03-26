"use client";

import Link from "next/link";
import { Trophy, Target, Activity, BarChart3, ArrowRight, Sparkles, ClipboardList } from "lucide-react";
import {
  LeaderboardHero,
  LeaderboardIntro,
  LeaderboardPageFrame,
  LeaderboardPill,
} from "../components/leaderboards/LeaderboardChrome";
import { GlowingEffect } from "@/components/ui/glowing-effect";

const LEADERBOARD_ITEMS = [
  {
    href: "/pitching-plus/leaderboard",
    label: "Pitching+",
    description: "Pitching+, Command+, Stuff+, and pitch-mix rankings",
    icon: Sparkles,
    color: "amber",
  },
  {
    href: "/command/leaderboard",
    label: "Command",
    description: "On-target %, avg miss, consistency by outing",
    icon: Target,
    color: "orange",
  },
  {
    href: "/trackman/leaderboard",
    label: "Trackman",
    description: "Stuff+, velocity, spin, extension by session",
    icon: Activity,
    color: "blue",
  },
  {
    href: "/team-stats/leaderboard",
    label: "Statistics",
    description: "ERA, FIP, WHIP, K%, and season production",
    icon: BarChart3,
    color: "sky",
  },
  {
    href: "/charting/leaderboard",
    label: "Charting",
    description: "Game-only swing, zone, and pitch-execution leaderboards from charted sessions",
    icon: ClipboardList,
    color: "emerald",
  },
];

const COLOR_CLASSES: Record<string, string> = {
  amber: "border-amber-500/30 hover:border-amber-500/60 text-amber-400",
  orange: "border-orange-500/30 hover:border-orange-500/60 text-orange-400",
  blue: "border-blue-500/30 hover:border-blue-500/60 text-blue-400",
  sky: "border-sky-500/30 hover:border-sky-500/60 text-sky-400",
  emerald: "border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400",
};

export default function LeaderboardsHubPage() {
  const featuredBoard = LEADERBOARD_ITEMS[0]!;
  const secondaryBoards = LEADERBOARD_ITEMS.slice(1);
  const FeaturedIcon = featuredBoard.icon;

  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <LeaderboardIntro breadcrumbs={[{ label: "Home", href: "/" }, { label: "Leaderboards" }]}>
        <LeaderboardHero
          tone="amber"
          icon={Trophy}
          eyebrow="All Rankings"
          title={<>Leaderboards</>}
          meta={(
            <>
              <LeaderboardPill tone="amber">{LEADERBOARD_ITEMS.length} boards</LeaderboardPill>
              <LeaderboardPill tone="neutral">All rankings</LeaderboardPill>
            </>
          )}
        />
      </LeaderboardIntro>

      <div className="mt-6 space-y-4">
        <Link
          href={featuredBoard.href}
          className={`group relative block overflow-hidden rounded-[2rem] border bg-zinc-950/70 p-6 transition-smooth hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(0,0,0,0.28)] ${COLOR_CLASSES[featuredBoard.color]}`}
        >
          <GlowingEffect
            glow
            disabled={false}
            proximity={72}
            inactiveZone={0.12}
            spread={36}
            movementDuration={0.9}
            borderWidth={2}
            className="opacity-95"
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_24%),linear-gradient(90deg,rgba(24,24,27,0.52),rgba(9,9,11,0.88))]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
                Featured Leaderboard
              </div>
              <div className="mt-4 flex items-start gap-4">
                <FeaturedIcon className="mt-1 h-7 w-7 shrink-0" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-[2rem]">
                    {featuredBoard.label}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
                    {featuredBoard.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 self-start rounded-2xl border border-amber-400/15 bg-zinc-950/60 px-4 py-3 text-sm font-semibold text-zinc-100">
              Open leaderboard
              <ArrowRight className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {secondaryBoards.map(({ href, label, description, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-start gap-4 overflow-hidden rounded-[1.75rem] border bg-zinc-950/70 p-5 transition-smooth hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.25)] ${COLOR_CLASSES[color]}`}
            >
              <GlowingEffect
                glow
                disabled={false}
                proximity={64}
                inactiveZone={0.18}
                spread={28}
                movementDuration={0.85}
                borderWidth={2}
                className="opacity-90"
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.04),transparent_24%),linear-gradient(180deg,rgba(24,24,27,0.45),rgba(9,9,11,0.82))]" />
              <Icon className="w-6 h-6 shrink-0 mt-0.5" />
              <div className="relative flex-1 min-w-0">
                <h2 className="font-semibold text-zinc-100 group-hover:text-inherit">
                  {label}
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {description}
                </p>
              </div>
              <ArrowRight className="relative w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </LeaderboardPageFrame>
  );
}
