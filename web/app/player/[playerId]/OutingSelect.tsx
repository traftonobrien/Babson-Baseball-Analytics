"use client";

import { useRouter } from "next/navigation";
import type { Outing } from "@/lib/dataIndex";

type OutingSelectProps = {
  playerId: string;
  outings: Outing[];
  selectedOutingId: string;
};

export default function OutingSelect({
  playerId,
  outings,
  selectedOutingId,
}: OutingSelectProps) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-xs text-zinc-400">
      <span>Outing</span>
      <select
        className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-md px-2 py-1 text-xs"
        value={selectedOutingId}
        onChange={(event) =>
          router.push(`/player/${playerId}?outingId=${event.target.value}`)
        }
      >
        {outings.map((outing) => (
          <option key={outing.id} value={outing.id}>
            {outing.label}
          </option>
        ))}
      </select>
    </label>
  );
}
