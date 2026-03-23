import { cn } from "@/lib/utils";

/**
 * Brand “soft” surfaces use `--brand-primary-*` from `layout.tsx` (body inline).
 * Those hexes are light-theme; on site dark, mix against `var(--surface)` / `var(--border-subtle)`.
 */

/** Small pills / chips (hero eyebrow, Command+ season badge, quick-link emphasis). */
export const brandSoftPillClasses = cn(
  "border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)]",
  "dark:border-[color-mix(in_srgb,rgb(var(--brand-primary-rgb))_42%,var(--border-subtle))]",
  "dark:bg-[color-mix(in_srgb,rgb(var(--brand-primary-rgb))_18%,var(--surface))]",
);

/** Highlight card (“This outing”, edited-pitch notice) — gradient + inset depth in dark. */
export const brandHighlightCardClasses = cn(
  "border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
  "dark:border-[color-mix(in_srgb,rgb(var(--brand-primary-rgb))_40%,var(--border-subtle))]",
  "dark:bg-[linear-gradient(180deg,color-mix(in_srgb,rgb(var(--brand-primary-rgb))_26%,var(--surface))_0%,color-mix(in_srgb,rgb(var(--brand-primary-rgb))_10%,var(--surface))_100%)]",
  "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.35)]",
);

export const brandSoftEyebrowTextClasses =
  "text-[var(--brand-primary-subtle-text)] dark:text-[var(--brand-primary-spotlight)]";

/** Selected lane tile in LaneReport (pill surface + focus ring). */
export const brandSoftActiveRingClasses = cn(
  brandSoftPillClasses,
  "ring-2 ring-[rgba(var(--brand-primary-rgb),0.22)] dark:ring-[rgba(var(--brand-primary-rgb),0.38)]",
);
