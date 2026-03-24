"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STAT_TONE_STYLES = {
  indigo: "from-[#EEF2FF] to-white border-[#E0E7FF] dark:from-zinc-900 dark:to-zinc-950 dark:border-indigo-500/30",
  emerald: "from-[#ECFDF5] to-white border-[#D1FAE5] dark:from-zinc-900 dark:to-zinc-950 dark:border-emerald-500/30",
  sky: "from-[#EFF6FF] to-white border-[#DBEAFE] dark:from-zinc-900 dark:to-zinc-950 dark:border-sky-500/30",
  violet: "from-[#FAF5FF] to-white border-[#E9D5FF] dark:from-zinc-900 dark:to-zinc-950 dark:border-violet-500/30",
} as const;

export type HubStatTone = keyof typeof STAT_TONE_STYLES;

const HUB_ACTION_ICONS = {
  activity: Activity,
  barChart3: BarChart3,
  bookOpen: BookOpen,
  clipboardList: ClipboardList,
  sparkles: Sparkles,
  target: Target,
  trophy: Trophy,
} as const;

export type HubActionIconName = keyof typeof HUB_ACTION_ICONS;

/** Gradient stat tile (Trackman / Command / Charting hub pattern). */
export function HubStatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: HubStatTone;
}) {
  const toneStyles = STAT_TONE_STYLES[tone];

  return (
    <div
      className={`rounded-[24px] border bg-gradient-to-br p-4 shadow-[0_16px_36px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.35)] ${toneStyles}`}
    >
      <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">{label}</div>
      <div className="font-display mt-3 text-[2rem] font-black tracking-tight text-slate-900 dark:text-zinc-50">{value}</div>
      <div className="font-sans mt-1 text-sm text-slate-500 dark:text-zinc-400">{detail}</div>
    </div>
  );
}

/** Section label + brand primary CTA (hub pattern). */
export function HubActionCard({
  href,
  icon,
  iconName,
  sectionTitle,
  buttonLabel,
}: {
  href: string;
  icon?: LucideIcon;
  iconName?: HubActionIconName;
  sectionTitle: string;
  buttonLabel: string;
}) {
  const Icon = iconName ? HUB_ACTION_ICONS[iconName] : icon;

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-surface p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
        {sectionTitle}
      </div>
      <div className="mt-3">
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(var(--brand-primary-rgb),0.22)] transition-smooth hover:bg-[var(--brand-primary-hover)]"
        >
          {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
          {buttonLabel}
          <ChevronRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
