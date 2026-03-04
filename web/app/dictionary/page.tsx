"use client";

import {
  Activity,
  Target,
  Users,
  Film,
  BarChart3,
  Sparkles,
} from "lucide-react";
import {
  DictionaryHubCard,
  DictionaryPageShell,
} from "@/app/components/dictionary/DictionaryChrome";

const DICTIONARY_ITEMS = [
  {
    href: "/pitching-plus",
    label: "Plus Statistics",
    description: "Pitching+, Command+, and Stuff+ reference in one place.",
    icon: Sparkles,
    tone: "amber" as const,
  },
  {
    href: "/trackman/faq",
    label: "Trackman",
    description: "Stuff+, velocity, spin, movement, and pitch quality context.",
    icon: Activity,
    tone: "blue" as const,
  },
  {
    href: "/command/faq",
    label: "Command",
    description: "On-target rate, miss shape, and Command+ definitions.",
    icon: Target,
    tone: "orange" as const,
  },
  {
    href: "/players/faq",
    label: "Players",
    description: "How roster profiles combine the full data stack.",
    icon: Users,
    tone: "indigo" as const,
  },
  {
    href: "/mechanics/faq",
    label: "Mechanics",
    description: "AWRE movement metrics and efficiency model context.",
    icon: Film,
    tone: "violet" as const,
  },
  {
    href: "/team-stats/faq",
    label: "Statistics",
    description: "Traditional stats, value metrics, and season leaderboard math.",
    icon: BarChart3,
    tone: "sky" as const,
  },
];

export default function DictionaryPage() {
  return (
    <DictionaryPageShell
      tone="blue"
      icon={Activity}
      title="Metrics Dictionary"
      description="One place for the definitions behind every leaderboard, model, and player view."
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Metrics Dictionary" }]}
      maxWidth="max-w-6xl"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DICTIONARY_ITEMS.map(({ href, label, description, icon, tone }) => (
          <DictionaryHubCard
            key={href}
            href={href}
            tone={tone}
            title={label}
            description={description}
            icon={icon}
          />
        ))}
      </div>
    </DictionaryPageShell>
  );
}
