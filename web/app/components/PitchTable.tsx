"use client";

import type { Pitch } from "../types";
import { pitchColor } from "../utils";

interface Props {
  pitches: Pitch[];
  selected: Pitch | null;
  onSelect: (p: Pitch) => void;
}

export default function PitchTable({ pitches, selected, onSelect }: Props) {
  return (
    <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-zinc-900 text-zinc-400 uppercase">
          <tr>
            <th className="px-2 py-1 text-left">#</th>
            <th className="px-2 py-1 text-left">Type</th>
            <th className="px-2 py-1 text-right">Miss</th>
            <th className="px-2 py-1 text-left">H</th>
            <th className="px-2 py-1 text-left">V</th>
          </tr>
        </thead>
        <tbody>
          {pitches.map((p) => {
            const isSelected = selected?.pitch_number === p.pitch_number;
            return (
              <tr
                key={p.pitch_number}
                onClick={() => onSelect(p)}
                className={`cursor-pointer border-b border-zinc-800 transition-colors ${
                  isSelected
                    ? "bg-zinc-700"
                    : "hover:bg-zinc-800"
                }`}
              >
                <td className="px-2 py-1.5 font-mono">{p.pitch_number}</td>
                <td className="px-2 py-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: pitchColor(p.pitch_type) }}
                  />
                  {p.pitch_type}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {p.total_miss_inches.toFixed(1)}&quot;
                </td>
                <td className="px-2 py-1.5 text-zinc-400">
                  {p.h_miss_inches.toFixed(1)}&quot; {p.h_direction}
                </td>
                <td className="px-2 py-1.5 text-zinc-400">
                  {p.v_miss_inches.toFixed(1)}&quot; {p.v_direction}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
