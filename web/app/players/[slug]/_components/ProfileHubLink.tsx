"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Activity } from "lucide-react";
import { useSiteAppearance } from "@/app/components/SiteAppearanceContext";

type HubTone = "blue" | "orange" | "violet";

const HUB_TONE_STYLES: Record<
  HubTone,
  {
    border: string;
    surface: string;
    icon: string;
    arrow: string;
    title: string;
    note: string;
  }
> = {
  blue: {
    border: "border-blue-200 hover:border-blue-300",
    surface: "bg-surface/95 shadow-[0_20px_44px_rgba(15,23,42,0.06)]",
    icon: "border-blue-200 bg-blue-50 text-blue-700",
    arrow: "text-blue-600",
    title: "text-slate-900",
    note: "text-slate-500",
  },
  orange: {
    border: "border-orange-200 hover:border-orange-300",
    surface: "bg-surface/95 shadow-[0_20px_44px_rgba(15,23,42,0.06)]",
    icon: "border-orange-200 bg-orange-50 text-orange-700",
    arrow: "text-orange-600",
    title: "text-slate-900",
    note: "text-slate-500",
  },
  violet: {
    border: "border-violet-200 hover:border-violet-300",
    surface: "bg-surface/95 shadow-[0_20px_44px_rgba(15,23,42,0.06)]",
    icon: "border-violet-200 bg-violet-50 text-violet-700",
    arrow: "text-violet-600",
    title: "text-slate-900",
    note: "text-slate-500",
  },
};

const HUB_TONE_STYLES_DARK: typeof HUB_TONE_STYLES = {
  blue: {
    border: "border-blue-500/30 hover:border-blue-400/40",
    surface: "bg-zinc-950/78 shadow-[0_20px_44px_rgba(0,0,0,0.38)]",
    icon: "border-blue-500/35 bg-blue-950/45 text-blue-200",
    arrow: "text-blue-300",
    title: "text-zinc-50",
    note: "text-zinc-400",
  },
  orange: {
    border: "border-orange-500/30 hover:border-orange-400/40",
    surface: "bg-zinc-950/78 shadow-[0_20px_44px_rgba(0,0,0,0.38)]",
    icon: "border-orange-500/35 bg-orange-950/45 text-orange-200",
    arrow: "text-orange-300",
    title: "text-zinc-50",
    note: "text-zinc-400",
  },
  violet: {
    border: "border-violet-500/30 hover:border-violet-400/40",
    surface: "bg-zinc-950/78 shadow-[0_20px_44px_rgba(0,0,0,0.38)]",
    icon: "border-violet-500/35 bg-violet-950/45 text-violet-200",
    arrow: "text-violet-300",
    title: "text-zinc-50",
    note: "text-zinc-400",
  },
};

export function ProfileHubLink({
  href,
  icon: Icon,
  title,
  note,
  tone,
}: {
  href: string;
  icon: typeof Activity;
  title: string;
  note: string;
  tone: HubTone;
}) {
  const siteDark = useSiteAppearance() === "dark";
  const toneStyles = siteDark ? HUB_TONE_STYLES_DARK[tone] : HUB_TONE_STYLES[tone];

  return (
    <Link href={href} className="block">
      <div
        className={`group rounded-[1.7rem] border p-5 transition-smooth hover:-translate-y-0.5 ${toneStyles.surface} ${toneStyles.border}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneStyles.icon}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className={`text-sm font-semibold ${toneStyles.title}`}>{title}</div>
              <p className={`mt-1 text-[11px] leading-5 ${toneStyles.note}`}>{note}</p>
            </div>
          </div>
          <ArrowRight
            className={`h-4 w-4 shrink-0 opacity-70 transition-smooth group-hover:opacity-100 ${toneStyles.arrow}`}
          />
        </div>
      </div>
    </Link>
  );
}
