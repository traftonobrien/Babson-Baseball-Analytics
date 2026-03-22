import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STAT_TONE_STYLES = {
  indigo: "from-[#EEF2FF] to-white text-[#4F46E5] border-[#E0E7FF]",
  emerald: "from-[#ECFDF5] to-white text-[#10B981] border-[#D1FAE5]",
  sky: "from-[#EFF6FF] to-white text-[#0EA5E9] border-[#DBEAFE]",
  violet: "from-[#FAF5FF] to-white text-[#8B5CF6] border-[#E9D5FF]",
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
  const toneStyles = STAT_TONE_STYLES[tone];

  return (
    <div className={`rounded-[24px] border bg-gradient-to-br p-4 shadow-[0_16px_36px_rgba(15,23,42,0.04)] ${toneStyles}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">{label}</div>
      <div className="mt-3 text-[2rem] font-black tracking-tight text-[#0F172A]">{value}</div>
      <div className="mt-1 text-sm text-[#64748B]">{detail}</div>
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
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{sectionTitle}</div>
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
