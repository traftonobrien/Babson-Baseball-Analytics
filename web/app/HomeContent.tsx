"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Film,
  LayoutGrid,
  Shield,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import LogoutButton from "./components/LogoutButton";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { cn } from "@/lib/utils";

type HomeTone =
  | "emerald"
  | "blue"
  | "orange"
  | "sky"
  | "violet"
  | "amber"
  | "zinc";

const HOME_TONE_STYLES: Record<
  HomeTone,
  {
    border: string;
    badge: string;
    glow: string;
    wash: string;
    icon: string;
  }
> = {
  emerald: {
    border: "border-emerald-500/25 hover:border-emerald-400/45",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
    glow: "hover:shadow-[0_28px_68px_rgba(16,185,129,0.12)]",
    wash: "from-emerald-500/14 via-transparent to-transparent",
    icon: "text-emerald-300",
  },
  blue: {
    border: "border-blue-500/25 hover:border-blue-400/45",
    badge: "border-blue-500/25 bg-blue-500/10 text-blue-200",
    glow: "hover:shadow-[0_28px_68px_rgba(59,130,246,0.12)]",
    wash: "from-blue-500/14 via-transparent to-transparent",
    icon: "text-blue-300",
  },
  orange: {
    border: "border-orange-500/25 hover:border-orange-400/45",
    badge: "border-orange-500/25 bg-orange-500/10 text-orange-200",
    glow: "hover:shadow-[0_28px_68px_rgba(249,115,22,0.12)]",
    wash: "from-orange-500/14 via-transparent to-transparent",
    icon: "text-orange-300",
  },
  sky: {
    border: "border-sky-500/25 hover:border-sky-400/45",
    badge: "border-sky-500/25 bg-sky-500/10 text-sky-200",
    glow: "hover:shadow-[0_28px_68px_rgba(14,165,233,0.12)]",
    wash: "from-sky-500/14 via-transparent to-transparent",
    icon: "text-sky-300",
  },
  violet: {
    border: "border-violet-500/25 hover:border-violet-400/45",
    badge: "border-violet-500/25 bg-violet-500/10 text-violet-200",
    glow: "hover:shadow-[0_28px_68px_rgba(139,92,246,0.12)]",
    wash: "from-violet-500/14 via-transparent to-transparent",
    icon: "text-violet-300",
  },
  amber: {
    border: "border-amber-500/25 hover:border-amber-400/45",
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-200",
    glow: "hover:shadow-[0_28px_68px_rgba(245,158,11,0.12)]",
    wash: "from-amber-500/14 via-transparent to-transparent",
    icon: "text-amber-300",
  },
  zinc: {
    border: "border-zinc-700/80 hover:border-zinc-500/80",
    badge: "border-zinc-700/80 bg-zinc-900/80 text-zinc-200",
    glow: "hover:shadow-[0_28px_68px_rgba(0,0,0,0.24)]",
    wash: "from-zinc-500/10 via-transparent to-transparent",
    icon: "text-zinc-300",
  },
};

function HomeIconBadge({
  tone,
  icon: Icon,
  size = "lg",
}: {
  tone: HomeTone;
  icon: LucideIcon;
  size?: "lg" | "sm";
}) {
  const toneStyles = HOME_TONE_STYLES[tone];

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-zinc-950/85",
        toneStyles.badge,
        size === "lg" ? "h-12 w-12" : "h-10 w-10",
      )}
    >
      <span className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <Icon className={cn(size === "lg" ? "h-5 w-5" : "h-4 w-4", toneStyles.icon)} />
    </div>
  );
}

function SectionMarker({
  label,
  note,
}: {
  label: string;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
        {label}
      </div>
      <div className="text-xs text-zinc-600">{note}</div>
    </div>
  );
}

function HomeLinkCard({
  href,
  tone,
  icon,
  title,
  description,
  eyebrow,
  badge,
  className,
  details,
}: {
  href: string;
  tone: HomeTone;
  icon: LucideIcon;
  title: string;
  description: string;
  eyebrow?: string;
  badge?: string;
  className?: string;
  details?: string[];
}) {
  const toneStyles = HOME_TONE_STYLES[tone];

  return (
    <Link href={href} className={cn("block", className)}>
      <div
        className={cn(
          "group relative h-full overflow-hidden rounded-[2rem] border bg-zinc-950/78 p-5 shadow-[0_28px_72px_rgba(0,0,0,0.28)] transition-smooth hover:-translate-y-0.5",
          toneStyles.border,
          toneStyles.glow,
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100",
            toneStyles.wash,
          )}
        />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between gap-4">
            <HomeIconBadge tone={tone} icon={icon} />
            {badge ? (
              <span className="rounded-full border border-zinc-700/80 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                {badge}
              </span>
            ) : (
              <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-500 transition-smooth group-hover:text-zinc-200" />
            )}
          </div>

          {eyebrow ? (
            <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              {eyebrow}
            </div>
          ) : null}

          <h2 className="mt-3 text-xl font-black tracking-tight text-zinc-100">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-zinc-400">{description}</p>

          {details?.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {details.map((detail) => (
                <span
                  key={detail}
                  className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400"
                >
                  {detail}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function HomeContent() {
  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <motion.div
        className="flex justify-end"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-950/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          Session
          <LogoutButton className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300 hover:text-zinc-100" />
        </div>
      </motion.div>

      <motion.div
        className="mt-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative overflow-hidden rounded-[2.35rem] border border-emerald-500/20 bg-zinc-950/82 p-6 shadow-[0_36px_90px_rgba(0,0,0,0.34)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_78%_24%,rgba(59,130,246,0.12),transparent_26%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="pointer-events-none absolute right-8 top-10 h-24 w-24 rounded-full border border-emerald-500/15" />
          <div className="pointer-events-none absolute right-14 top-16 h-10 w-10 rounded-full border border-sky-400/15" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Babson Baseball
            </div>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <Image
                  src="/babson-logo.svg"
                  alt="Babson Baseball"
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0"
                  priority
                />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-zinc-50 sm:text-[2.65rem] sm:leading-[1.02]">
                  Babson Baseball Pitching Portal
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-[15px]">
                  The full pitching operating system for the staff: profiles,
                  live tracking, model grades, rankings, and definitions in one
                  place.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {["Profiles", "Tracking", "Rankings", "Definitions"].map(
                (chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300"
                  >
                    {chip}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <SectionMarker
          label="Start Here"
          note="The main team surfaces players will open first."
        />
        <div className="mt-3 grid gap-4 lg:grid-cols-12">
          <HomeLinkCard
            href="/players"
            tone="emerald"
            icon={Users}
            eyebrow="Foundation"
            title="Player Profiles"
            description="Every pitcher, all in one place. Open the roster and get to stats, Trackman, command, and video from the same page."
            details={["Roster", "Profiles", "Comparisons"]}
            className="lg:col-span-6"
          />
          <HomeLinkCard
            href="/team-stats/leaderboard"
            tone="sky"
            icon={BarChart3}
            eyebrow="Production"
            title="Statistics"
            description="Season results for the staff, organized as one clean leaderboard."
            details={["ERA", "WHIP", "K%", "BB%"]}
            className="lg:col-span-3"
          />
          <HomeLinkCard
            href="/mechanics"
            tone="violet"
            icon={Film}
            eyebrow="Video"
            title="Mechanics"
            description="Phase-by-phase delivery review with session-level breakdowns."
            details={["Video", "Phases", "Sessions"]}
            badge="Beta"
            className="lg:col-span-3"
          />
        </div>
      </motion.div>

      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.09 }}
      >
        <SectionMarker
          label="Daily Work"
          note="The day-to-day pitch quality and execution systems."
        />
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <HomeLinkCard
            href="/trackman"
            tone="blue"
            icon={Activity}
            eyebrow="Movement"
            title="Trackman Hub"
            description="Live session data for velocity, movement, shape, and arsenal trends."
            details={["Velocity", "Movement", "Shapes"]}
          />
          <HomeLinkCard
            href="/command"
            tone="orange"
            icon={Target}
            eyebrow="Execution"
            title="Command Hub"
            description="Track strike quality, miss distance, and how consistently a pitcher repeats feel."
            details={["Strikes", "Misses", "Outings"]}
          />
          <HomeLinkCard
            href="/pitching-plus/leaderboard"
            tone="amber"
            icon={Sparkles}
            eyebrow="Blend"
            title="Pitching+"
            description="Roll the live stuff and command picture together into one ranking view."
            details={["Pitching+", "Command+", "Stuff+"]}
          />
        </div>
      </motion.div>

      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.12 }}
      >
        <SectionMarker
          label="Reference"
          note="Open the full rankings or the definitions behind the numbers."
        />
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <HomeLinkCard
            href="/leaderboards-hub"
            tone="blue"
            icon={LayoutGrid}
            eyebrow="Map"
            title="Leaderboards"
            description="See every leaderboard in one place, then jump directly into the ranking you need."
            details={["Command", "Trackman", "Pitching+", "Statistics"]}
          />
          <HomeLinkCard
            href="/dictionary"
            tone="zinc"
            icon={BookOpen}
            eyebrow="Reference"
            title="Metrics Dictionary"
            description="Definitions, grading context, and guide pages for each major part of the system."
            details={["Definitions", "Guides", "Context"]}
          />
        </div>
      </motion.div>

      <motion.div
        className="mt-6 flex items-center justify-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-950/75 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          <Shield className="h-3.5 w-3.5 text-zinc-400" />
          One home base for the full staff workflow
        </div>
      </motion.div>
    </LeaderboardPageFrame>
  );
}
