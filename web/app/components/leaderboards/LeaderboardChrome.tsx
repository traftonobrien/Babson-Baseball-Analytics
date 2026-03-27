"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Breadcrumbs, { type BreadcrumbItem } from "@/app/components/Breadcrumbs";
import { useHydratedSiteAppearance } from "@/app/components/SiteAppearanceContext";

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
    "radial-gradient(circle at top left, rgba(var(--brand-primary-rgb), 0.18), transparent 24%), radial-gradient(circle at top right, rgba(148, 163, 184, 0.14), transparent 26%), linear-gradient(180deg, #09090b 0%, #111827 56%, #09090b 100%)",
};

const BRAND_PILL_STYLE: CSSProperties = {
  borderColor: "rgba(var(--brand-primary-rgb), 0.22)",
  background:
    "linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.22), rgba(148, 163, 184, 0.12) 58%, rgba(9, 9, 11, 0.92) 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(var(--brand-primary-rgb), 0.08), 0 0 18px rgba(var(--brand-primary-rgb), 0.1)",
  color: "rgb(233 240 236)",
};

const NEUTRAL_PILL_STYLE: CSSProperties = {
  borderColor: "rgba(148, 163, 184, 0.22)",
  background:
    "linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.1), rgba(148, 163, 184, 0.08) 58%, rgba(9, 9, 11, 0.92) 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(var(--brand-primary-rgb), 0.05)",
  color: "rgb(212 220 218)",
};

const BRAND_PANEL_STYLE: CSSProperties = {
  borderColor: "rgba(148, 163, 184, 0.18)",
  background:
    "linear-gradient(180deg, rgba(12, 18, 17, 0.82), rgba(9, 9, 11, 0.92))",
  boxShadow:
    "0 24px 64px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(var(--brand-primary-rgb), 0.04)",
};

const BRAND_RULE_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, transparent, rgba(148, 163, 184, 0.28), transparent)",
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

/** Light dictionary / hub-style hero eyebrow chips (matches updated UI). */
const LIGHT_HERO_EYEBROW: Record<LeaderboardTone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  orange: "border-orange-200 bg-orange-50 text-orange-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
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
  brand:
    "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-subtle-text)]",
  neutral: "border-slate-200 bg-slate-100/90 text-slate-600",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

/** Light chrome when the site is in dark mode — zinc surfaces, readable tints. */
const LIGHT_PILL_ON_DARK_SITE: Record<PillTone, string> = {
  brand:
    "border-[color-mix(in_srgb,rgb(var(--brand-primary-rgb))_42%,var(--border-subtle))] bg-[color-mix(in_srgb,rgb(var(--brand-primary-rgb))_18%,var(--surface))] text-[var(--brand-primary-spotlight)]",
  neutral: "border-zinc-600 bg-zinc-800/90 text-zinc-200",
  amber: "border-amber-500/35 bg-amber-950/55 text-amber-200",
  orange: "border-orange-500/35 bg-orange-950/50 text-orange-200",
  blue: "border-blue-500/35 bg-blue-950/50 text-blue-200",
  sky: "border-sky-500/35 bg-sky-950/55 text-sky-200",
  emerald: "border-emerald-500/35 bg-emerald-950/50 text-emerald-200",
  violet: "border-violet-500/35 bg-violet-950/50 text-violet-200",
  indigo: "border-indigo-500/35 bg-indigo-950/50 text-indigo-200",
};

const LIGHT_HERO_EYEBROW_ON_DARK_SITE: Record<LeaderboardTone, string> = {
  amber: "border-amber-500/35 bg-amber-950/50 text-amber-200",
  orange: "border-orange-500/35 bg-orange-950/45 text-orange-200",
  blue: "border-blue-500/35 bg-blue-950/50 text-blue-200",
  sky: "border-sky-500/35 bg-sky-950/50 text-sky-200",
  emerald: "border-emerald-500/35 bg-emerald-950/45 text-emerald-200",
  violet: "border-violet-500/35 bg-violet-950/50 text-violet-200",
  indigo: "border-indigo-500/35 bg-indigo-950/50 text-indigo-200",
};

function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function LeaderboardPageFrame({
  children,
  maxWidth = "max-w-7xl",
  variant = "dark",
}: {
  children: ReactNode;
  maxWidth?: string;
  variant?: SurfaceVariant;
}) {
  if (variant === "light") {
    return (
      <main className="min-h-screen bg-background text-slate-900 dark:text-zinc-50">
        <div className={joinClasses("mx-auto px-4 py-5 sm:px-6 sm:py-8 lg:px-8", maxWidth)}>{children}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-zinc-100" style={BRAND_FRAME_STYLE}>
      <div className={joinClasses("mx-auto px-4 py-5 sm:px-6 sm:py-8 lg:px-8", maxWidth)}>{children}</div>
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
  const siteAppearance = useHydratedSiteAppearance();
  const lightOnDarkSite = variant === "light" && siteAppearance === "dark";

  const pillStyle =
    variant === "dark"
      ? tone === "brand"
        ? BRAND_PILL_STYLE
        : tone === "neutral"
          ? NEUTRAL_PILL_STYLE
          : undefined
      : undefined;

  const lightPillClass = lightOnDarkSite ? LIGHT_PILL_ON_DARK_SITE[tone] : LIGHT_PILL_TONES[tone];

  return (
    <span
      className={joinClasses(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        variant === "light"
          ? lightPillClass
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
  const siteAppearance = useHydratedSiteAppearance();
  const lightOnDarkSite = variant === "light" && siteAppearance === "dark";

  const emphasisClass =
    emphasisClassName ?? (variant === "light" ? "text-slate-900 dark:text-zinc-50" : "text-zinc-100");

  return (
    <div
      className={joinClasses(
        "relative overflow-hidden rounded-3xl border p-4",
        variant === "light"
          ? lightOnDarkSite
            ? "border-zinc-700/80 bg-zinc-900/55 shadow-[0_14px_32px_rgba(0,0,0,0.35)]"
            : "border-slate-200/80 bg-surface/95 shadow-[0_14px_32px_rgba(15,23,42,0.05)]"
          : undefined,
      )}
      style={variant === "light" ? undefined : BRAND_PANEL_STYLE}
    >
      <div
        className={joinClasses(
          "pointer-events-none absolute inset-x-8 top-0 h-px",
          variant === "light"
            ? lightOnDarkSite
              ? "bg-gradient-to-r from-transparent via-zinc-600 to-transparent"
              : "bg-gradient-to-r from-transparent via-slate-200 to-transparent"
            : undefined,
        )}
        style={variant === "light" ? undefined : BRAND_RULE_STYLE}
      />
      <div
        className={joinClasses(
          "text-[10px] font-semibold uppercase tracking-[0.24em]",
          variant === "light" ? "text-slate-500 dark:text-zinc-400" : "text-zinc-500",
        )}
      >
        {label}
      </div>
      <div className={joinClasses("mt-2 text-2xl font-black sm:text-[2rem]", emphasisClass)}>
        {value}
      </div>
      <div
        className={joinClasses(
          "mt-1 text-xs",
          variant === "light" ? "text-slate-500 dark:text-zinc-400" : "text-zinc-500",
        )}
      >
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
  variant = "dark",
}: {
  tone: LeaderboardTone;
  icon: LucideIcon;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  summary?: ReactNode;
  side?: ReactNode;
  variant?: SurfaceVariant;
}) {
  const siteAppearance = useHydratedSiteAppearance();
  const lightOnDarkSite = variant === "light" && siteAppearance === "dark";

  const toneClasses = HERO_TONES[tone];
  const lightEyebrow = lightOnDarkSite ? LIGHT_HERO_EYEBROW_ON_DARK_SITE[tone] : LIGHT_HERO_EYEBROW[tone];

  if (variant === "light") {
    return (
      <section className="mt-6">
        <div
          className={joinClasses(
            "relative overflow-hidden rounded-[28px] border shadow-[0_16px_40px_rgba(15,23,42,0.04)]",
            lightOnDarkSite
              ? "border-zinc-700 bg-zinc-900/50 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
              : "border-border bg-surface",
          )}
        >
          <div className="relative grid gap-5 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
            <div className="min-w-0">
              <div
                className={joinClasses(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
                  lightEyebrow,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.85rem] sm:leading-[1.02]">
                {title}
              </h1>
              {description ? (
                <div className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-zinc-400 sm:text-[14px]">
                  {description}
                </div>
              ) : null}
              {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
            </div>

            {summary || side ? (
              <div className="flex min-w-0 w-full flex-col gap-3 self-start items-stretch xl:items-end">
                {summary}
                {side}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div
        className={joinClasses(
          "relative overflow-hidden rounded-[28px] border bg-zinc-950/80 shadow-2xl shadow-black/30",
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
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-zinc-50 sm:text-[2.85rem] sm:leading-[1.02]">
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
            <div className="flex min-w-0 w-full flex-col gap-3 self-start items-stretch xl:items-end">
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
  surface = "dark",
}: {
  breadcrumbs: BreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  surface?: "dark" | "light";
}) {
  return (
    <div className={joinClasses("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs items={breadcrumbs} className="mb-0" variant={surface} />
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="[&>section]:mt-0">{children}</div>
    </div>
  );
}

export function LeaderboardToolbar({
  children,
  className,
  variant = "dark",
}: {
  children: ReactNode;
  className?: string;
  variant?: SurfaceVariant;
}) {
  if (variant === "light") {
    return (
      <div
        className={joinClasses(
          "relative overflow-visible rounded-[28px] border p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] sm:p-5",
          "border-border bg-surface dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={joinClasses(
        "relative overflow-visible rounded-[28px] border p-4 sm:p-5",
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
  const siteAppearance = useHydratedSiteAppearance();
  const lightOnDarkSite = variant === "light" && siteAppearance === "dark";

  return (
    <div
      className={joinClasses(
        "relative overflow-hidden rounded-3xl border",
        variant === "light"
          ? lightOnDarkSite
            ? "border-zinc-700/90 bg-zinc-900/55 shadow-[0_18px_44px_rgba(0,0,0,0.35)]"
            : "border-slate-200/80 bg-surface/95 shadow-[0_18px_44px_rgba(15,23,42,0.06)]"
          : undefined,
        className,
      )}
      style={variant === "light" ? undefined : BRAND_PANEL_STYLE}
    >
      <div
        className={joinClasses(
          "pointer-events-none absolute inset-x-8 top-0 h-px",
          variant === "light"
            ? lightOnDarkSite
              ? "bg-gradient-to-r from-transparent via-zinc-600 to-transparent"
              : "bg-gradient-to-r from-transparent via-slate-200 to-transparent"
            : undefined,
        )}
        style={variant === "light" ? undefined : BRAND_RULE_STYLE}
      />
      {children}
    </div>
  );
}
