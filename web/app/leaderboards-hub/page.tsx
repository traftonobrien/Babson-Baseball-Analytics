"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowRight, Activity, BarChart3, BookOpen, ClipboardList, Sparkles, Target, Trophy } from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { HubActionCard, HubStatCard } from "@/app/components/hub/HubHeader";

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

const LEADERBOARD_ITEMS = [
  {
    href: "/pitching-plus/leaderboard",
    label: "Pitching+",
    description: "Pitching+, Command+, Stuff+, and pitch-mix rankings",
    icon: Sparkles,
    accent: "amber",
  },
  {
    href: "/command/leaderboard",
    label: "Command",
    description: "On-target %, average miss, and consistency by outing",
    icon: Target,
    accent: "orange",
  },
  {
    href: "/trackman/leaderboard",
    label: "Trackman",
    description: "Stuff+, velocity, spin, and extension by session",
    icon: Activity,
    accent: "blue",
  },
  {
    href: "/team-stats/leaderboard",
    label: "Statistics",
    description: "ERA, FIP, WHIP, K%, and season production",
    icon: BarChart3,
    accent: "sky",
  },
  {
    href: "/charting/leaderboard",
    label: "Charting",
    description: "Pitcher and hitter rankings from charted game sessions",
    icon: ClipboardList,
    accent: "emerald",
  },
] as const;

const ACCENT_STYLES: Record<string, { ring: string; chip: string; icon: string; wash: string }> = {
  amber: {
    ring: "border-amber-100 hover:border-amber-200",
    chip: "bg-amber-50 text-amber-600",
    icon: "text-amber-500",
    wash: "from-amber-50 to-transparent",
  },
  orange: {
    ring: "border-orange-100 hover:border-orange-200",
    chip: "bg-orange-50 text-orange-600",
    icon: "text-orange-500",
    wash: "from-orange-50 to-transparent",
  },
  blue: {
    ring: "border-blue-100 hover:border-blue-200",
    chip: "bg-blue-50 text-blue-600",
    icon: "text-blue-500",
    wash: "from-blue-50 to-transparent",
  },
  sky: {
    ring: "border-sky-100 hover:border-sky-200",
    chip: "bg-sky-50 text-sky-600",
    icon: "text-sky-500",
    wash: "from-sky-50 to-transparent",
  },
  emerald: {
    ring: "border-emerald-100 hover:border-emerald-200",
    chip: "bg-emerald-50 text-emerald-600",
    icon: "text-emerald-500",
    wash: "from-emerald-50 to-transparent",
  },
};

function BoardCard({
  href,
  label,
  description,
  icon: Icon,
  accent,
  featured = false,
}: {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  accent: keyof typeof ACCENT_STYLES;
  featured?: boolean;
}) {
  const styles = ACCENT_STYLES[accent];

  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-[1.75rem] border bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(15,23,42,0.08)] ${styles.ring} ${featured ? "sm:col-span-2" : ""}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.wash} opacity-60`} />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="relative flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#F1F5F9] bg-[#F8FAFC] ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className={`${plusJakarta.className} text-[17px] font-bold tracking-tight text-[#0F172A]`}>
              {label}
            </h2>
            {featured ? (
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles.chip}`}>
                Featured
              </span>
            ) : null}
          </div>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[#64748B]">
            {description}
          </p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#6366F1]" />
      </div>
    </Link>
  );
}

export default function LeaderboardsHubPage() {
  const featuredBoard = LEADERBOARD_ITEMS[0];
  const secondaryBoards = LEADERBOARD_ITEMS.slice(1);
  const boardCount = LEADERBOARD_ITEMS.length;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="rounded-[28px] border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6366F1]">
                  <Trophy className="h-3.5 w-3.5" aria-hidden />
                  Leaderboards
                </div>
                <h1 className={`${plusJakarta.className} mt-4 text-3xl font-black tracking-tight text-[#0F172A] sm:text-[2.85rem] sm:leading-[1.02]`}>
                  Metric Leaderboards
                </h1>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
                <HubActionCard
                  href="/dictionary"
                  icon={BookOpen}
                  sectionTitle="Dictionary"
                  buttonLabel="Metrics glossary"
                />
                <HubActionCard
                  href="/pitching-plus"
                  icon={Sparkles}
                  sectionTitle="Plus models"
                  buttonLabel="Methodology guide"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <HubStatCard
                label="Surfaces"
                value={String(boardCount)}
                detail="Pitching+, Command, Trackman, team stats, and charting boards."
                tone="indigo"
              />
              <HubStatCard
                label="Featured entry"
                value={featuredBoard?.label ?? "—"}
                detail={featuredBoard?.description ?? "Open any card below to jump in."}
                tone="emerald"
              />
              <HubStatCard
                label="Scope"
                value="D3"
                detail="Team-first views with NCAA Division III context where noted."
                tone="sky"
              />
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {featuredBoard ? (
            <BoardCard
              href={featuredBoard.href}
              label={featuredBoard.label}
              description={featuredBoard.description}
              icon={featuredBoard.icon}
              accent={featuredBoard.accent}
              featured
            />
          ) : null}
          {secondaryBoards.map((item) => (
            <BoardCard
              key={item.href}
              href={item.href}
              label={item.label}
              description={item.description}
              icon={item.icon}
              accent={item.accent}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
