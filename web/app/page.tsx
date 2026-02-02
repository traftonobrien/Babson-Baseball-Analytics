import Link from "next/link";
import { players } from "@/lib/dataIndex";
import LogoutButton from "./components/LogoutButton";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8 relative">
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>
      <h1 className="text-2xl font-semibold mb-8">Pitch Tracker</h1>
      <div className="grid gap-4 w-full max-w-md">
        {players.map((player) => (
          <Link
            key={player.id}
            href={`/player/${player.id}`}
            className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors"
          >
            <div className="font-medium">{player.name}</div>
            <div className="text-sm text-zinc-400 mt-1">
              {player.outings.length} outing{player.outings.length !== 1 ? "s" : ""}
            </div>
            <ul className="mt-2 text-xs text-zinc-500">
              {player.outings.map((o) => (
                <li key={o.id}>{o.label}</li>
              ))}
            </ul>
          </Link>
        ))}
      </div>
    </div>
  );
}
// deploy bump
