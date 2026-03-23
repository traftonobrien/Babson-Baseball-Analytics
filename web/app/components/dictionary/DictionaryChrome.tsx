"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  type LucideProps,
  ArrowLeft,
} from "lucide-react";
import { type BreadcrumbItem } from "@/app/components/Breadcrumbs";
import {
  LeaderboardHero,
  LeaderboardIntro,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";
import { cn } from "@/lib/utils";

type DictionaryTone =
  | "amber"
  | "orange"
  | "blue"
  | "sky"
  | "emerald"
  | "violet"
  | "indigo";

/** Light-surface chips (metrics dictionaries / updated UI). */
const TONE_ICON_CLASSES: Record<DictionaryTone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

export function DictionaryPageShell({
  tone,
  icon: Icon,
  title,
  description,
  breadcrumbs,
  eyebrow = "Metrics Dictionary",
  meta,
  maxWidth = "max-w-5xl",
  children,
}: {
  tone: DictionaryTone;
  icon: LucideIcon;
  title: ReactNode;
  description: ReactNode;
  breadcrumbs: BreadcrumbItem[];
  eyebrow?: string;
  meta?: ReactNode;
  maxWidth?: string;
  children: ReactNode;
}) {
  return (
    <LeaderboardPageFrame maxWidth={maxWidth} variant="light">
      <LeaderboardIntro breadcrumbs={breadcrumbs} surface="light">
        <LeaderboardHero
          variant="light"
          tone={tone}
          icon={Icon}
          eyebrow={eyebrow}
          title={title}
          description={description}
          meta={
            meta ?? (
              <>
                <LeaderboardPill tone={tone} variant="light">
                  Reference
                </LeaderboardPill>
                <LeaderboardPill tone="neutral" variant="light">
                  Guides and definitions
                </LeaderboardPill>
              </>
            )
          }
        />
      </LeaderboardIntro>
      <div className="mt-6 space-y-6">{children}</div>
    </LeaderboardPageFrame>
  );
}

export function DictionarySection({
  tone,
  title,
  description,
  icon: Icon,
  children,
  className,
  contentClassName,
}: {
  tone: DictionaryTone;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <LeaderboardPanel variant="light" className={cn("p-5 sm:p-7", className)}>
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                TONE_ICON_CLASSES[tone],
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50">{title}</h2>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className={cn("mt-6", contentClassName)}>{children}</div>
    </LeaderboardPanel>
  );
}

export function DictionaryCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DictionaryTableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DictionaryHubCard({
  href,
  tone,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  tone: DictionaryTone;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-3xl border border-border bg-surface p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition-smooth hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.06)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl border",
            TONE_ICON_CLASSES[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <ArrowLeft className="h-4 w-4 rotate-180 text-slate-400 transition-smooth group-hover:text-[#6366F1]" />
      </div>
      <div className="mt-4">
        <div className="text-base font-bold text-slate-900 dark:text-zinc-50">{title}</div>
        <p className="mt-1 text-sm leading-7 text-slate-600">{description}</p>
      </div>
    </Link>
  );
}

export function DictionarySectionLabel({
  tone,
  icon: Icon = BookOpen,
  children,
}: {
  tone: DictionaryTone;
  icon?: (props: LucideProps) => ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
        TONE_ICON_CLASSES[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}
