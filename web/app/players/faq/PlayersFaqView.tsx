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
      title="Player Profiles Guide"
      description="This guide explains how the player profiles pull data from each system into one development view."
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
        description="Each player has one canonical profile that acts as the home base for reports, models, and historical context."
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
            <h3 className="text-lg font-bold text-rose-400">2. Mechanics</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Pulls from the AWRE computer-vision pipeline to surface efficiency
              scores and delivery flags.
            </p>
          </DictionaryCard>

          <DictionaryCard>
            <h3 className="text-lg font-bold text-sky-400">3. Statistics</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Pulls in real competition results, including traditional D3 box
              score totals and advanced season metrics.
            </p>
          </DictionaryCard>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="indigo"
        icon={Users}
        title="Finding a Profile"
        description="The Players Hub is built to get you from the roster into a full profile quickly."
      >
        <div className="space-y-6">
          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-zinc-200">Search and Filters</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Use throwing-hand filters and the search bar to move through the
              roster quickly. Partial name search is supported.
              </p>
          </DictionaryCard>

          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-zinc-200">Profile Routing</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Every profile resolves through the same identity system, so
              Trackman, Command, Mechanics, and game stats all land on the same
              athlete record.
              </p>
          </DictionaryCard>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="indigo"
        icon={Database}
        title="Data Synchronization"
        description="The platform relies on one player identity contract so every subsystem joins cleanly."
      >
        <DictionaryCard className="sm:px-8">
          <p className="text-sm leading-relaxed text-zinc-400">
            The system uses canonical player IDs and shared alias resolution to
            bind different source formats into one profile. A player can be
            logged under slightly different names across Trackman, box scores,
            or mechanics exports and still resolve to the same profile without
            manual cleanup.
          </p>
        </DictionaryCard>
      </DictionarySection>
    </DictionaryPageShell>
  );
}
