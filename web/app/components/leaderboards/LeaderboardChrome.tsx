"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Breadcrumbs, { type BreadcrumbItem } from "@/app/components/Breadcrumbs";

type LeaderboardTone =
  | "amber"
  | "orange"
  | "blue"
  | "sky"
  | "emerald"
  | "violet"
  | "indigo";
type PillTone =
  | "brand"
  | "neutral"
  | "amber"
  | "orange"
  | "blue"
  | "sky"
  | "emerald"
  | "violet"
  | "indigo";
type SurfaceVariant = "dark" | "light";

const BRAND_FRAME_STYLE: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle at top left, rgba(var(--babson-green-rgb), 0.18), transparent 24%), radial-gradient(circle at top right, rgba(var(--babson-grey-rgb), 0.14), transparent 26%), linear-gradient(180deg, #09090b 0%, #111827 56%, #09090b 100%)",
};

const BRAND_PILL_STYLE: CSSProperties = {
  borderColor: "rgba(var(--babson-grey-rgb), 0.3)",
  background:
    "linear-gradient(135deg, rgba(var(--babson-green-rgb), 0.22), rgba(var(--babson-grey-rgb), 0.12) 58%, rgba(9, 9, 11, 0.92) 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(var(--babson-green-rgb), 0.08), 0 0 18px rgba(var(--babson-green-rgb), 0.1)",
  color: "rgb(233 240 236)",
};

const NEUTRAL_PILL_STYLE: CSSProperties = {
  borderColor: "rgba(var(--babson-grey-rgb), 0.22)",
  background:
    "linear-gradient(135deg, rgba(var(--babson-green-rgb), 0.1), rgba(var(--babson-grey-rgb), 0.08) 58%, rgba(9, 9, 11, 0.92) 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(var(--babson-green-rgb), 0.05)",
  color: "rgb(212 220 218)",
};

const BRAND_PANEL_STYLE: CSSProperties = {
  borderColor: "rgba(var(--babson-grey-rgb), 0.18)",
  background:
    "linear-gradient(180deg, rgba(12, 18, 17, 0.82), rgba(9, 9, 11, 0.92))",
  boxShadow:
    "0 24px 64px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(var(--babson-green-rgb), 0.04)",
};

const BRAND_RULE_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, transparent, rgba(var(--babson-grey-rgb), 0.28), transparent)",
};

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
  emerald: {
    border: "border-emerald-500/20",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    icon: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    backdrop:
      "bg-[radial-gradient(circle_at_14%_18%,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(34,197,94,0.10),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]",
  },
  violet: {
    border: "border-violet-500/20",
    badge: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    icon: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    backdrop:
      "bg-[radial-gradient(circle_at_14%_18%,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(59,130,246,0.08),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]",
  },
  indigo: {
    border: "border-indigo-500/20",
    badge: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
    icon: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
    backdrop:
      "bg-[radial-gradient(circle_at_14%_18%,rgba(99,102,241,0.16),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(14,165,233,0.08),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]",
  },
};

const PILL_TONES: Record<Exclude<PillTone, "brand" | "neutral">, string> = {
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  orange: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  blue: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  indigo: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
};

const LIGHT_PILL_TONES: Record<PillTone, string> = {
  brand: "border-indigo-200 bg-indigo-50 text-indigo-700",
  neutral: "border-slate-200 bg-slate-100/90 text-slate-600",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
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
    <main className="min-h-screen text-zinc-100" style={BRAND_FRAME_STYLE}>
      <div className={joinClasses("mx-auto px-4 py-8 sm:px-6", maxWidth)}>{children}</div>
    </main>
  );
}

export function LeaderboardPill({
  children,
  tone = "neutral",
  className,
  variant = "dark",
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
  variant?: SurfaceVariant;
}) {
  const pillStyle =
    variant === "dark"
      ? tone === "brand"
        ? BRAND_PILL_STYLE
        : tone === "neutral"
          ? NEUTRAL_PILL_STYLE
          : undefined
      : undefined;

  return (
    <span
      className={joinClasses(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        variant === "light"
          ? LIGHT_PILL_TONES[tone]
          : tone === "brand" || tone === "neutral"
            ? undefined
            : PILL_TONES[tone],
        className,
      )}
      style={pillStyle}
    >
      {children}
    </span>
  );
}

export function LeaderboardStatBlock({
  label,
  value,
  detail,
  emphasisClassName,
  variant = "dark",
}: {
  label: string;
  value: string;
  detail: string;
  emphasisClassName?: string;
  variant?: SurfaceVariant;
}) {
  const emphasisClass =
    emphasisClassName ?? (variant === "light" ? "text-slate-900" : "text-zinc-100");

  return (
    <div
      className={joinClasses(
        "relative overflow-hidden rounded-3xl border p-4",
        variant === "light"
          ? "border-slate-200/80 bg-white/95 shadow-[0_14px_32px_rgba(15,23,42,0.05)]"
          : undefined,
      )}
      style={variant === "light" ? undefined : BRAND_PANEL_STYLE}
    >
      <div
        className={joinClasses(
          "pointer-events-none absolute inset-x-8 top-0 h-px",
          variant === "light"
            ? "bg-gradient-to-r from-transparent via-slate-200 to-transparent"
            : undefined,
        )}
        style={variant === "light" ? undefined : BRAND_RULE_STYLE}
      />
      <div
        className={joinClasses(
          "text-[10px] font-semibold uppercase tracking-[0.24em]",
          variant === "light" ? "text-slate-500" : "text-zinc-500",
        )}
      >
        {label}
      </div>
      <div className={joinClasses("mt-2 text-2xl font-black sm:text-[2rem]", emphasisClass)}>
        {value}
      </div>
      <div className={joinClasses("mt-1 text-xs", variant === "light" ? "text-slate-500" : "text-zinc-500")}>
        {detail}
      </div>
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

export function LeaderboardIntro({
  breadcrumbs,
  actions,
  children,
  className,
}: {
  breadcrumbs: BreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={joinClasses("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs items={breadcrumbs} className="mb-0" />
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="[&>section]:mt-0">{children}</div>
    </div>
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
        "relative mt-5 overflow-visible rounded-[1.5rem] border p-4",
        className,
      )}
      style={BRAND_PANEL_STYLE}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px" style={BRAND_RULE_STYLE} />
      {children}
    </div>
  );
}

export function LeaderboardPanel({
  children,
  className,
  variant = "dark",
}: {
  children: ReactNode;
  className?: string;
  variant?: SurfaceVariant;
}) {
  return (
    <div
      className={joinClasses(
        "relative overflow-hidden rounded-3xl border",
        variant === "light"
          ? "border-slate-200/80 bg-white/95 shadow-[0_18px_44px_rgba(15,23,42,0.06)]"
          : undefined,
        className,
      )}
      style={variant === "light" ? undefined : BRAND_PANEL_STYLE}
    >
      <div
        className={joinClasses(
          "pointer-events-none absolute inset-x-8 top-0 h-px",
          variant === "light"
            ? "bg-gradient-to-r from-transparent via-slate-200 to-transparent"
            : undefined,
        )}
        style={variant === "light" ? undefined : BRAND_RULE_STYLE}
      />
      {children}
    </div>
  );
}
