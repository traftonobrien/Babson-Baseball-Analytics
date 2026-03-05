"use client";

import type { ReactNode } from "react";
import { Activity, Search, Sparkles, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlowingEffect } from "@/components/ui/glowing-effect";

export function GlowingEffectDemo() {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-12 md:grid-rows-3 xl:max-h-[34rem] xl:grid-rows-2">
      <GlowingDemoCard
        area="md:[grid-area:1/1/2/7] xl:[grid-area:1/1/2/5]"
        icon={<Users className="h-4 w-4" />}
        title="Player Profiles"
        description="Start with the roster, then move into pitcher-level reports and comparisons."
      />
      <GlowingDemoCard
        area="md:[grid-area:1/7/2/13] xl:[grid-area:2/1/3/5]"
        icon={<Activity className="h-4 w-4" />}
        title="Trackman Hub"
        description="Shape, velo, movement, and arsenal context in one place."
      />
      <GlowingDemoCard
        area="md:[grid-area:2/1/3/7] xl:[grid-area:1/5/3/8]"
        icon={<Target className="h-4 w-4" />}
        title="Command Hub"
        description="Execution quality, miss patterns, and outing review."
      />
      <GlowingDemoCard
        area="md:[grid-area:2/7/3/13] xl:[grid-area:1/8/2/13]"
        icon={<Sparkles className="h-4 w-4" />}
        title="Pitching+"
        description="A blended read that connects live stuff and command."
      />
      <GlowingDemoCard
        area="md:[grid-area:3/1/4/13] xl:[grid-area:2/8/3/13]"
        icon={<Search className="h-4 w-4" />}
        title="Leaderboards"
        description="Open the board you need without losing the portal context."
      />
    </ul>
  );
}

function GlowingDemoCard({
  area,
  icon,
  title,
  description,
}: {
  area: string;
  icon: ReactNode;
  title: string;
  description: ReactNode;
}) {
  return (
    <li className={cn("min-h-[14rem] list-none", area)}>
      <div className="relative h-full rounded-[1.25rem] border-[0.75px] border-zinc-800 p-2 md:rounded-[1.5rem] md:p-3">
        <GlowingEffect
          spread={40}
          glow
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={3}
        />
        <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl border-[0.75px] border-zinc-800 bg-zinc-950 p-6 shadow-sm">
          <div className="relative flex flex-1 flex-col justify-between gap-3">
            <div className="w-fit rounded-lg border-[0.75px] border-zinc-800 bg-zinc-900 p-2">
              {icon}
            </div>
            <div className="space-y-3">
              <h3 className="pt-0.5 text-xl font-semibold tracking-[-0.04em] text-zinc-100 md:text-2xl text-balance">
                {title}
              </h3>
              <h2 className="text-sm leading-[1.125rem] text-zinc-400 md:text-base md:leading-[1.375rem]">
                {description}
              </h2>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
