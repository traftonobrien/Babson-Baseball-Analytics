"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardList,
  Film,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { HubActionCard } from "@/app/components/hub/HubHeader";

const DICTIONARY_ITEMS = [
  {
    href: "/pitching-plus",
    label: "Plus Statistics",
    description: "How Pitching+, Command+, and Stuff+ fit together.",
    icon: Sparkles,
    accent: "amber",
  },
  {
    href: "/trackman/faq",
    label: "Trackman",
    description: "Definitions for Stuff+, velocity, spin, movement, and pitch quality.",
    icon: Activity,
    accent: "blue",
  },
  {
    href: "/command/faq",
    label: "Command",
    description: "Definitions for on-target rate, miss shape, and Command+.",
    icon: Target,
    accent: "orange",
  },
  {
    href: "/players/faq",
    label: "Players",
    description: "How each player profile pulls the full picture together.",
    icon: Users,
    accent: "indigo",
  },
  {
    href: "/mechanics/faq",
    label: "Mechanics",
    description: "AWRE metrics, movement checks, and efficiency scoring.",
    icon: Film,
    accent: "violet",
  },
  {
    href: "/team-stats/faq",
    label: "Statistics",
    description: "Traditional stats, value metrics, and season rankings.",
    icon: BarChart3,
    accent: "sky",
  },
  {
    href: "/charting/faq",
    label: "Charting",
    description: "Charted pitcher and hitter metrics from game sessions.",
    icon: ClipboardList,
    accent: "emerald",
  },
] as const;

const ACCENT_STYLES: Record<string, { ring: string; chip: string; icon: string; wash: string }> = {
  amber: {
    ring: "border-amber-100 hover:border-amber-200 dark:border-amber-900/45 dark:hover:border-amber-800/60",
    chip: "bg-amber-50 text-amber-600 dark:bg-amber-950/45 dark:text-amber-300",
    icon: "text-amber-500 dark:text-amber-300",
    wash: "from-amber-50 to-transparent dark:from-amber-950/35 dark:to-transparent",
  },
  blue: {
    ring: "border-blue-100 hover:border-blue-200 dark:border-blue-900/45 dark:hover:border-blue-800/60",
    chip: "bg-blue-50 text-blue-600 dark:bg-blue-950/45 dark:text-blue-300",
    icon: "text-blue-500 dark:text-blue-300",
    wash: "from-blue-50 to-transparent dark:from-blue-950/35 dark:to-transparent",
  },
  orange: {
    ring: "border-orange-100 hover:border-orange-200 dark:border-orange-900/45 dark:hover:border-orange-800/60",
    chip: "bg-orange-50 text-orange-600 dark:bg-orange-950/45 dark:text-orange-300",
    icon: "text-orange-500 dark:text-orange-300",
    wash: "from-orange-50 to-transparent dark:from-orange-950/35 dark:to-transparent",
  },
  indigo: {
    ring: "border-indigo-100 hover:border-indigo-200 dark:border-indigo-900/45 dark:hover:border-indigo-800/60",
    chip: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/45 dark:text-indigo-300",
    icon: "text-indigo-500 dark:text-indigo-300",
    wash: "from-indigo-50 to-transparent dark:from-indigo-950/35 dark:to-transparent",
  },
  violet: {
    ring: "border-violet-100 hover:border-violet-200 dark:border-violet-900/45 dark:hover:border-violet-800/60",
    chip: "bg-violet-50 text-violet-600 dark:bg-violet-950/45 dark:text-violet-300",
    icon: "text-violet-500 dark:text-violet-300",
    wash: "from-violet-50 to-transparent dark:from-violet-950/35 dark:to-transparent",
  },
  sky: {
    ring: "border-sky-100 hover:border-sky-200 dark:border-sky-900/45 dark:hover:border-sky-800/60",
    chip: "bg-sky-50 text-sky-600 dark:bg-sky-950/45 dark:text-sky-300",
    icon: "text-sky-500 dark:text-sky-300",
    wash: "from-sky-50 to-transparent dark:from-sky-950/35 dark:to-transparent",
  },
  emerald: {
    ring: "border-emerald-100 hover:border-emerald-200 dark:border-emerald-900/45 dark:hover:border-emerald-800/60",
    chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-300",
    icon: "text-emerald-500 dark:text-emerald-300",
    wash: "from-emerald-50 to-transparent dark:from-emerald-950/35 dark:to-transparent",
  },
};

function DictCard({
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
      className={`group relative block overflow-hidden rounded-[1.75rem] border bg-surface p-5 shadow-[0_18px_40px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(15,23,42,0.08)] ${styles?.ring ?? ""} ${featured ? "sm:col-span-2" : ""}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles?.wash ?? ""} opacity-60`} />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-zinc-700 to-transparent" />
      <div className="relative flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-100 dark:border-zinc-800 bg-background ${styles?.icon ?? ""}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            {label}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-slate-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:group-hover:text-indigo-300" />
      </div>
    </Link>
  );
}

export default function DictionaryPage() {
  const featuredItem = DICTIONARY_ITEMS[0];
  const secondaryItems = DICTIONARY_ITEMS.slice(1);

  return (
    <main className="min-h-screen bg-background text-slate-900 dark:text-zinc-50">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6 sm:p-7">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                Metrics Dictionary
              </div>
              <h1 className="font-display mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.85rem] sm:leading-[1.02]">
                Metrics Dictionary
              </h1>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
              <HubActionCard
                href="/leaderboards-hub"
                icon={BarChart3}
                sectionTitle="Leaderboards"
                buttonLabel="All Leaderboards"
              />
              <HubActionCard
                href="/pitching-plus"
                icon={Sparkles}
                sectionTitle="Plus models"
                buttonLabel="Methodology Guide"
              />
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {featuredItem ? (
            <DictCard
              href={featuredItem.href}
              label={featuredItem.label}
              description={featuredItem.description}
              icon={featuredItem.icon}
              accent={featuredItem.accent}
              featured
            />
          ) : null}
          {secondaryItems.map((item) => (
            <DictCard
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
