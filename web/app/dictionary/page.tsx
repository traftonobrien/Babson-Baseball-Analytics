"use client";

import Link from "next/link";
import { BookOpen, Activity, Target, Users, Film, BarChart3, Sparkles, ArrowRight } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";

const DICTIONARY_ITEMS = [
  { href: "/pitching-plus", label: "Plus Models", description: "Pitching+, Command+, and Stuff+ in one place", icon: Sparkles, color: "amber" },
  { href: "/trackman/faq", label: "Trackman", description: "Stuff+, velocity, spin, and movement metrics", icon: Activity, color: "blue" },
  { href: "/leaderboards/faq", label: "Command", description: "On-target %, avg miss, consistency", icon: Target, color: "orange" },
  { href: "/players/faq", label: "Players", description: "Roster, profiles, and D3 stats", icon: Users, color: "emerald" },
  { href: "/mechanics/faq", label: "Mechanics", description: "AWRE metrics and video analysis", icon: Film, color: "violet" },
  { href: "/team-stats/faq", label: "Team Stats", description: "ERA, FIP, WHIP, and season stats", icon: BarChart3, color: "sky" },
];

const COLOR_CLASSES: Record<string, string> = {
  amber: "border-amber-500/30 hover:border-amber-500/60 text-amber-400",
  blue: "border-blue-500/30 hover:border-blue-500/60 text-blue-400",
  orange: "border-orange-500/30 hover:border-orange-500/60 text-orange-400",
  emerald: "border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400",
  violet: "border-violet-500/30 hover:border-violet-500/60 text-violet-400",
  sky: "border-sky-500/30 hover:border-sky-500/60 text-sky-400",
};

export default function DictionaryPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Dictionary" }]} />
        <div className="flex items-center gap-3 mt-6 mb-2">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <BookOpen className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
              Data Dictionary
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Select a section to view its metrics and definitions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          {DICTIONARY_ITEMS.map(({ href, label, description, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`group flex items-start gap-4 p-5 rounded-xl border bg-zinc-900/50 transition-smooth hover:scale-[1.02] hover:shadow-lg ${COLOR_CLASSES[color]}`}
            >
              <Icon className="w-6 h-6 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-zinc-100 group-hover:text-inherit">
                  {label}
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {description}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
