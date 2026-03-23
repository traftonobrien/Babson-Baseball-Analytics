"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSiteAppearance } from "@/app/components/SiteAppearanceContext";

const STAT_TONE_STYLES = {
  indigo: "from-[#EEF2FF] to-white text-[#4F46E5] border-[#E0E7FF]",
  emerald: "from-[#ECFDF5] to-white text-[#10B981] border-[#D1FAE5]",
  sky: "from-[#EFF6FF] to-white text-[#0EA5E9] border-[#DBEAFE]",
  violet: "from-[#FAF5FF] to-white text-[#8B5CF6] border-[#E9D5FF]",
} as const;

const STAT_TONE_STYLES_DARK = {
  indigo: "from-zinc-900 to-zinc-950 text-indigo-300 border-indigo-500/30",
  emerald: "from-zinc-900 to-zinc-950 text-emerald-300 border-emerald-500/30",
  sky: "from-zinc-900 to-zinc-950 text-sky-300 border-sky-500/30",
  violet: "from-zinc-900 to-zinc-950 text-violet-300 border-violet-500/30",
} as const;

export type HubStatTone = keyof typeof STAT_TONE_STYLES;

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
  const siteDark = useSiteAppearance() === "dark";
  const toneStyles = siteDark ? STAT_TONE_STYLES_DARK[tone] : STAT_TONE_STYLES[tone];

  return (
    <div
      className={`rounded-[24px] border bg-gradient-to-br p-4 shadow-[0_16px_36px_rgba(15,23,42,0.04)] ${toneStyles} ${
        siteDark ? "shadow-[0_16px_36px_rgba(0,0,0,0.35)]" : ""
      }`}
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
  icon: Icon,
  sectionTitle,
  buttonLabel,
}: {
  href: string;
  icon: LucideIcon;
  sectionTitle: string;
  buttonLabel: string;
}) {
  const siteDark = useSiteAppearance() === "dark";

  return (
    <div
      className={
        siteDark
          ? "rounded-[1.5rem] border border-zinc-700 bg-zinc-900/50 p-5 shadow-sm"
          : "rounded-[1.5rem] border border-slate-200 bg-surface p-5 shadow-sm"
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
        {sectionTitle}
      </div>
      <div className="mt-3">
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(var(--brand-primary-rgb),0.22)] transition-smooth hover:bg-[var(--brand-primary-hover)]"
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {buttonLabel}
          <ChevronRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
