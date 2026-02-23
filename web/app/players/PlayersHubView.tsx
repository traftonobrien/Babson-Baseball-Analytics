"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import { getCanonicalName, getHand } from "@/lib/canonicalPlayers";
import { handBadgeClasses } from "@/lib/handBadge";

export interface PlayerRegistryEntry {
  slug: string;
  name: string;
  team: string;
  role: string;
  d3_player_id: string | null;
}

export interface RosterEntry {
  height?: string;
  weight?: string;
  class?: string;
}

export default function PlayersHubView({
  registry,
  roster = {},
}: {
  registry: PlayerRegistryEntry[];
  roster?: Record<string, RosterEntry>;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = registry;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          getCanonicalName(p.name).toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => a.slug.localeCompare(b.slug));
  }, [registry, search]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="space-y-2">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Players" }]} />
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50 mt-2">
            Pitching Hub
          </h1>
          <p className="max-w-2xl text-sm text-zinc-500">
            Official season performance paired with Trackman development data.
            Click a player to open the profile view.
          </p>
          <div className="flex items-center gap-3 text-[11px] text-zinc-600 pt-1">
            <span>
              {registry.length} pitcher{registry.length !== 1 ? "s" : ""}
            </span>
          </div>
        </header>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-smooth"
          />
        </div>

        {/* Player grid */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((player) => {
            const hand = getHand(player.slug);
            const rosterInfo = roster[player.slug];
            return (
              <Link
                key={player.slug}
                href={`/players/${player.slug}`}
                className="group relative rounded-xl border-2 border-zinc-800 bg-zinc-900 p-6 transition-smooth duration-300 hover:border-emerald-500/70 hover:bg-zinc-900/95 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 overflow-hidden"
              >
                {/* Accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/0 group-hover:bg-emerald-500 transition-smooth" />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-zinc-100 truncate group-hover:text-zinc-50 transition-smooth">
                      {getCanonicalName(player.name)}
                    </h2>
                    {(rosterInfo?.height || rosterInfo?.weight || rosterInfo?.class) && (
                      <p className="text-xs text-zinc-500 mt-2.5 flex items-center gap-2 flex-wrap">
                        {rosterInfo.height && <span>{rosterInfo.height}</span>}
                        {rosterInfo.weight && (
                          <span>{rosterInfo.weight} lbs</span>
                        )}
                        {rosterInfo.class && (
                          <span className="text-zinc-600">{rosterInfo.class}</span>
                        )}
                      </p>
                    )}
                  </div>
                  {hand && (
                    <span
                      className={`text-sm font-semibold px-3 py-1.5 rounded-full shrink-0 uppercase tracking-wider ${handBadgeClasses(hand)}`}
                    >
                      {hand === "R" ? "RHP" : "LHP"}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </section>

        {filtered.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-8">
            No players match your search.
          </p>
        )}
      </div>
    </main>
  );
}
