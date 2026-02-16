import Link from "next/link";
import players from "@/data/players.json";

interface RawPlayerEntry {
  player_slug?: string;
  slug?: string;
  full_name?: string;
  name?: string;
  team?: string;
  school?: string;
  role?: string;
  d3_player_id?: number | string | null;
}

interface PlayerRegistryEntry {
  slug: string;
  name: string;
  team: string;
  role: string;
  d3_player_id: string | null;
}

function normalizePlayerEntry(entry: RawPlayerEntry): PlayerRegistryEntry | null {
  const slug = entry.slug ?? entry.player_slug ?? "";
  const name = entry.name ?? entry.full_name ?? "";
  const team = entry.team ?? entry.school ?? "";
  const role = entry.role ?? "";
  if (!slug || !name) return null;

  return {
    slug,
    name,
    team,
    role,
    d3_player_id: entry.d3_player_id != null ? String(entry.d3_player_id) : null,
  };
}

const registry = (players as RawPlayerEntry[])
  .map((entry) => normalizePlayerEntry(entry))
  .filter((entry): entry is PlayerRegistryEntry => entry != null);

export default function PlayersPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Player Profiles
          </p>
          <h1 className="text-3xl font-semibold">Babson Pitching Hub</h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Official season performance paired with Trackman development data.
            Click a player to open the profile view.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {registry.map((player) => (
            <Link
              key={player.slug}
              href={`/players/${player.slug}`}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 transition hover:border-emerald-500/60 hover:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    {player.name}
                  </h2>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">
                    {player.role || "Player"}
                  </p>
                </div>
                <span className="text-xs text-emerald-400 opacity-0 transition group-hover:opacity-100">
                  View
                </span>
              </div>
              <div className="mt-4 text-xs text-zinc-500">{player.team}</div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
