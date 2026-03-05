"use client";

import Link from "next/link";
import { Trophy, Target, Activity, BarChart3, ArrowRight, Sparkles } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import {
  LeaderboardHero,
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
];

const COLOR_CLASSES: Record<string, string> = {
  amber: "border-amber-500/30 hover:border-amber-500/60 text-amber-400",
  orange: "border-orange-500/30 hover:border-orange-500/60 text-orange-400",
  blue: "border-blue-500/30 hover:border-blue-500/60 text-blue-400",
  sky: "border-sky-500/30 hover:border-sky-500/60 text-sky-400",
};

export default function LeaderboardsHubPage() {
  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Leaderboards" }]} />
      <LeaderboardHero
        tone="amber"
        icon={Trophy}
        eyebrow="All Rankings"
        title={<>Leaderboards</>}
        meta={(
          <>
            <LeaderboardPill tone="amber">4 boards</LeaderboardPill>
            <LeaderboardPill tone="neutral">All rankings</LeaderboardPill>
          </>
        )}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LEADERBOARD_ITEMS.map(({ href, label, description, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`group relative overflow-hidden rounded-[1.75rem] border bg-zinc-950/70 p-5 transition-smooth hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.25)] ${COLOR_CLASSES[color]}`}
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
    </LeaderboardPageFrame>
  );
}
