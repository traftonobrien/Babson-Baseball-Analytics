"use client";

import type { CSSProperties } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type HeroTone = "amber" | "orange" | "blue";

export interface HeroTileConfig {
  label: string;
  value: string;
  note: string;
  tone: HeroTone;
  badgeStyle?: CSSProperties;
  onClick?: () => void;
  active?: boolean;
  featured?: boolean;
}

const HERO_TONE_STYLES: Record<
  HeroTone,
  {
    border: string;
    surface: string;
    glow: string;
    rail: string;
    label: string;
    value: string;
    note: string;
  }
> = {
  amber: {
    border: "border-amber-500/20",
    surface: "from-amber-500/10 via-zinc-900/95 to-zinc-950",
    glow: "bg-amber-500/15",
    rail: "bg-amber-300/80",
    label: "text-amber-200/80",
    value: "text-amber-50",
    note: "text-amber-100/60",
  },
  orange: {
    border: "border-orange-500/20",
    surface: "from-orange-500/10 via-zinc-900/95 to-zinc-950",
    glow: "bg-orange-500/15",
    rail: "bg-orange-400/80",
    label: "text-orange-200/80",
    value: "text-orange-50",
    note: "text-orange-100/60",
  },
  blue: {
    border: "border-blue-500/20",
    surface: "from-blue-500/10 via-zinc-900/95 to-zinc-950",
    glow: "bg-blue-500/15",
    rail: "bg-blue-400/80",
    label: "text-blue-200/80",
    value: "text-blue-50",
    note: "text-blue-100/60",
  },
};

export function ProfileHeroTile({
  index,
  label,
  value,
  note,
  tone,
  badgeStyle,
  onClick,
  active = false,
  featured = false,
}: HeroTileConfig & { index: number }) {
  const toneStyles = HERO_TONE_STYLES[tone];
  const interactive = typeof onClick === "function";

  const valueNode = badgeStyle ? (
    <span
      className={`inline-flex items-center justify-center rounded-2xl font-mono font-black tracking-tight ${
        featured
          ? "min-h-[4.75rem] min-w-[8rem] px-6 py-3 text-[44px]"
          : "min-h-[3rem] min-w-[5.5rem] px-4 py-2 text-[30px]"
      }`}
      style={badgeStyle}
    >
      {value}
    </span>
  ) : (
    <span
      className={`font-mono font-black tracking-tight ${toneStyles.value} ${
        featured ? "text-[44px]" : "text-[30px]"
      }`}
    >
      {value}
    </span>
  );

  const content = featured ? (
    <>
      <div className={`absolute inset-y-4 left-0 w-[4px] rounded-full ${toneStyles.rail}`} />
      <div className={`pointer-events-none absolute -right-2 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full blur-3xl ${toneStyles.glow}`} />

      <div className="relative z-10 flex items-center justify-between gap-6 pl-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <p className={`text-[11px] font-black uppercase tracking-[0.24em] ${toneStyles.label}`}>
              {label}
            </p>
            {interactive && (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-zinc-300">
                {active ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            )}
          </div>
          <p className={`mt-3 max-w-xl text-[12px] sm:text-[13px] ${toneStyles.note}`}>
            {note}
          </p>
        </div>

        <div className="relative shrink-0">{valueNode}</div>
      </div>
    </>
  ) : (
    <>
      <div className={`absolute inset-y-4 left-0 w-[3px] rounded-full ${toneStyles.rail}`} />
      <div className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-3xl ${toneStyles.glow}`} />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <p className={`pl-4 text-[10px] font-black uppercase tracking-[0.18em] ${toneStyles.label}`}>
          {label}
        </p>
        {interactive && (
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/20 text-zinc-300">
            {active ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </div>

      <div className="relative z-10 mt-4 pl-4">{valueNode}</div>

      <p className={`relative z-10 mt-3 pl-4 text-[11px] ${toneStyles.note}`}>
        {note}
      </p>
    </>
  );

  const sharedClassName =
    `group relative overflow-hidden rounded-2xl border ${toneStyles.border} bg-gradient-to-br ${toneStyles.surface} opacity-0 backdrop-blur-sm ${
      featured ? "p-5 sm:p-6" : "p-4"
    }`;

  return interactive ? (
    <button
      type="button"
      onClick={onClick}
      className={`${sharedClassName} w-full text-left transition-smooth hover:border-white/15`}
      style={{
        animation: `savantFadeIn 0.4s ease-out ${index * 60}ms forwards`,
      }}
      aria-expanded={active}
      aria-label={`${label} breakdown`}
    >
      {content}
    </button>
  ) : (
    <div
      className={`relative overflow-hidden rounded-2xl border ${toneStyles.border} bg-gradient-to-br ${toneStyles.surface} p-4 opacity-0 backdrop-blur-sm`}
      style={{
        animation: `savantFadeIn 0.4s ease-out ${index * 60}ms forwards`,
      }}
    >
      {content}
    </div>
  );
}
