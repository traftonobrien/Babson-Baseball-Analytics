"use client";

import { Database, LayoutDashboard, Users } from "lucide-react";
import {
  DictionaryCard,
  DictionaryPageShell,
  DictionarySection,
} from "@/app/components/dictionary/DictionaryChrome";

export default function PlayersFaqView() {
  return (
    <DictionaryPageShell
      tone="indigo"
      icon={Users}
      eyebrow="Metrics Dictionary"
      title="Roster and Profiles Guide"
      description="This guide explains how the unified player profiles pull together information from each tracking system into one development view."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Metrics Dictionary", href: "/dictionary" },
        { label: "Players" },
      ]}
      maxWidth="max-w-5xl"
    >
      <DictionarySection
        tone="indigo"
        icon={LayoutDashboard}
        title="The Unified Profile"
        description="Each pitcher has one canonical profile that acts as the home base for reports, live models, and historical context."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <DictionaryCard>
            <h3 className="text-lg font-bold text-blue-400">1. Trackman Data</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Pulls arsenal data, velocity, Stuff+, and movement metrics from
              radar-tracked bullpens and scrimmages.
            </p>
          </DictionaryCard>

          <DictionaryCard>
            <h3 className="text-lg font-bold text-rose-400">2. Mechanics AI</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Connects to the AWRE computer-vision pipeline to surface efficiency
              scores and delivery flags.
            </p>
          </DictionaryCard>

          <DictionaryCard>
            <h3 className="text-lg font-bold text-sky-400">3. Game Stats</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Displays real competition outcomes, including traditional D3 box
              scores and advanced season metrics.
            </p>
          </DictionaryCard>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="indigo"
        icon={Users}
        title="Navigating the Roster"
        description="The Players Hub is built to get you from the roster into a full profile quickly."
      >
        <div className="space-y-6">
          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-zinc-200">Search and Filters</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Use handedness filters and the universal search bar to move quickly
              through the roster. Partial name search is supported so players
              can find a profile fast.
            </p>
          </DictionaryCard>

          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-zinc-200">Profile Routing</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Every player profile resolves through the same canonical identity
              system, so Trackman, Command, Mechanics, and game stats all land
              on the same athlete record.
            </p>
          </DictionaryCard>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="indigo"
        icon={Database}
        title="Data Synchronization"
        description="The platform relies on a single player identity contract so every subsystem joins cleanly."
      >
        <DictionaryCard className="sm:px-8">
          <p className="text-sm leading-relaxed text-zinc-400">
            The system uses canonical player IDs and shared alias resolution to
            bind different source formats into one profile. That means a player
            can be logged with slightly different naming formats across Trackman,
            box scores, or mechanics exports and still resolve to the same
            profile without manual cleanup.
          </p>
        </DictionaryCard>
      </DictionarySection>
    </DictionaryPageShell>
  );
}
