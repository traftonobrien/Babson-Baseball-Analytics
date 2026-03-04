"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  type LucideProps,
  ArrowLeft,
} from "lucide-react";
import Breadcrumbs, { type BreadcrumbItem } from "@/app/components/Breadcrumbs";
import {
  LeaderboardHero,
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

const TONE_ICON_CLASSES: Record<DictionaryTone, string> = {
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  orange: "border-orange-500/20 bg-orange-500/10 text-orange-300",
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  indigo: "border-indigo-500/20 bg-indigo-500/10 text-indigo-300",
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
    <LeaderboardPageFrame maxWidth={maxWidth}>
      <Breadcrumbs items={breadcrumbs} />
      <LeaderboardHero
        tone={tone}
        icon={Icon}
        eyebrow={eyebrow}
        title={title}
        description={description}
        meta={
          meta ?? (
            <>
              <LeaderboardPill tone={tone}>Reference</LeaderboardPill>
              <LeaderboardPill tone="neutral">Guides and definitions</LeaderboardPill>
            </>
          )
        }
      />
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
    <LeaderboardPanel className={cn("p-5 sm:p-7", className)}>
      <div className="border-b border-zinc-800/80 pb-4">
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
            <h2 className="text-2xl font-black tracking-tight text-zinc-50">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400">
                {description}
              </p>
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
        "rounded-2xl border border-zinc-800/70 bg-zinc-900/45 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
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
        "overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
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
        "group block rounded-3xl border p-5 transition-smooth hover:-translate-y-0.5 hover:border-zinc-700",
        TONE_ICON_CLASSES[tone],
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
        <ArrowLeft className="h-4 w-4 rotate-180 text-zinc-500 transition-smooth group-hover:text-zinc-200" />
      </div>
      <div className="mt-4">
        <div className="text-base font-bold text-zinc-100">{title}</div>
        <p className="mt-1 text-sm leading-7 text-zinc-400">{description}</p>
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
