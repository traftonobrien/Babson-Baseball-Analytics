"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type LeaderboardTone = "amber" | "orange" | "blue" | "sky";
type PillTone = "neutral" | "amber" | "orange" | "blue" | "sky" | "emerald";

const HERO_TONES: Record<LeaderboardTone, {
  border: string;
  badge: string;
  icon: string;
  backdrop: string;
}> = {
  amber: {
    border: "border-amber-500/20",
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    icon: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    backdrop:
      "bg-[radial-gradient(circle_at_14%_18%,rgba(245,158,11,0.18),transparent_26%),radial-gradient(circle_at_86%_24%,rgba(34,197,94,0.10),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]",
  },
  orange: {
    border: "border-orange-500/20",
    badge: "border-orange-500/25 bg-orange-500/10 text-orange-300",
    icon: "border-orange-500/25 bg-orange-500/10 text-orange-300",
    backdrop:
      "bg-[radial-gradient(circle_at_14%_18%,rgba(249,115,22,0.16),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(251,191,36,0.09),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]",
  },
  blue: {
    border: "border-blue-500/20",
    badge: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    icon: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    backdrop:
      "bg-[radial-gradient(circle_at_14%_18%,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(14,165,233,0.11),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]",
  },
  sky: {
    border: "border-sky-500/20",
    badge: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    icon: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    backdrop:
      "bg-[radial-gradient(circle_at_14%_18%,rgba(14,165,233,0.16),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(6,182,212,0.10),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]",
  },
};

const PILL_TONES: Record<PillTone, string> = {
  neutral: "border-zinc-800 bg-zinc-950/70 text-zinc-300",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  orange: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  blue: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function LeaderboardPageFrame({
  children,
  maxWidth = "max-w-7xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.1),_transparent_26%),linear-gradient(180deg,_#09090b_0%,_#111827_56%,_#09090b_100%)] text-zinc-100">
      <div className={joinClasses("mx-auto px-4 py-8 sm:px-6", maxWidth)}>{children}</div>
    </main>
  );
}

export function LeaderboardPill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={joinClasses(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LeaderboardStatBlock({
  label,
  value,
  detail,
  emphasisClassName = "text-zinc-100",
}: {
  label: string;
  value: string;
  detail: string;
  emphasisClassName?: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        {label}
      </div>
      <div className={joinClasses("mt-2 text-2xl font-black sm:text-[2rem]", emphasisClassName)}>
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{detail}</div>
    </div>
  );
}

export function LeaderboardHero({
  tone,
  icon: Icon,
  eyebrow,
  title,
  description,
  meta,
  summary,
  side,
}: {
  tone: LeaderboardTone;
  icon: LucideIcon;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  summary?: ReactNode;
  side?: ReactNode;
}) {
  const toneClasses = HERO_TONES[tone];

  return (
    <section className="mt-6">
      <div
        className={joinClasses(
          "relative overflow-hidden rounded-[2rem] border bg-zinc-950/80 shadow-2xl shadow-black/30",
          toneClasses.border,
        )}
      >
        <div className={joinClasses("pointer-events-none absolute inset-0", toneClasses.backdrop)} />
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

        <div className="relative grid gap-5 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
          <div className="min-w-0">
            <div
              className={joinClasses(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
                toneClasses.badge,
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-zinc-50 sm:text-[2.9rem] sm:leading-[1.02]">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-[14px]">
                {description}
              </p>
            ) : null}
            {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>

          {(summary || side) ? (
            <div className="grid gap-3">
              {summary}
              {side}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function LeaderboardToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClasses(
        "mt-5 rounded-[1.5rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(17,24,39,0.7),rgba(9,9,11,0.92))] p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LeaderboardPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClasses(
        "rounded-3xl border border-zinc-800/80 bg-zinc-950/65 shadow-[0_24px_64px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
