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
    border: "border-blue-500/25 hover:border-blue-400/40",
    icon: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    arrow: "text-blue-300",
  },
  orange: {
    border: "border-orange-500/25 hover:border-orange-400/40",
    icon: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    arrow: "text-orange-300",
  },
  violet: {
    border: "border-violet-500/25 hover:border-violet-400/40",
    icon: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    arrow: "text-violet-300",
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
    <Link href={href}>
      <div
        className={`group rounded-[1.7rem] border bg-zinc-950/72 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.24)] transition-smooth hover:-translate-y-0.5 ${toneStyles.border}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneStyles.icon}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100">{title}</div>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">{note}</p>
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
