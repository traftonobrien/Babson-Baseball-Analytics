"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Activity } from "lucide-react";

type HubTone = "blue" | "orange" | "violet";

const HUB_TONE_STYLES: Record<
  HubTone,
  {
    border: string;
    icon: string;
    arrow: string;
  }
> = {
  blue: {
    border: "border-blue-200 hover:border-blue-300",
    icon: "border-blue-200 bg-blue-50 text-blue-700",
    arrow: "text-blue-600",
  },
  orange: {
    border: "border-orange-200 hover:border-orange-300",
    icon: "border-orange-200 bg-orange-50 text-orange-700",
    arrow: "text-orange-600",
  },
  violet: {
    border: "border-violet-200 hover:border-violet-300",
    icon: "border-violet-200 bg-violet-50 text-violet-700",
    arrow: "text-violet-600",
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
  const toneStyles = HUB_TONE_STYLES[tone];

  return (
    <Link href={href} className="block">
      <div
        className={`group rounded-[1.7rem] border bg-surface/95 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.06)] transition-smooth hover:-translate-y-0.5 ${toneStyles.border}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneStyles.icon}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">{title}</div>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{note}</p>
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
