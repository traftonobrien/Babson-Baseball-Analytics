"use client";

import { useState } from "react";
import type { Pitch } from "../types";
import { pitchColor } from "../utils";
import { OUTLIER_MISS_THRESHOLD_IN } from "@/lib/reportModel";

const isOutlierPitch = (p: Pitch) =>
  Number.isFinite(p.total_miss_inches) &&
  p.total_miss_inches > OUTLIER_MISS_THRESHOLD_IN;

interface Props {
  pitches: Pitch[];
  selected: Pitch | null;
  onSelect: (p: Pitch) => void;
  /** Set of pitch_number values that have been edited. */
  editedPitches?: Set<number>;
  /** Callback to change a pitch's type. */
  onEditPitchType?: (pitchNumber: number, newType: string) => void;
  /** Available pitch type options for the editor. */
  pitchTypeOptions?: string[];
}

export default function PitchTable({
  pitches,
  selected,
  onSelect,
  editedPitches,
  onEditPitchType,
  pitchTypeOptions,
}: Props) {
  const [editingPitch, setEditingPitch] = useState<number | null>(null);

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
            {onEditPitchType && <th className="w-6" />}
          </tr>
        </thead>
        <tbody>
          {pitches.map((p) => {
            const isSelected = selected?.pitch_number === p.pitch_number;
            const isEdited = editedPitches?.has(p.pitch_number);
            const isEditing = editingPitch === p.pitch_number;
            const isOutlier = isOutlierPitch(p);

            return (
              <tr
                key={p.pitch_number}
                onClick={() => onSelect(p)}
                className={`cursor-pointer border-b border-zinc-800 transition-colors ${
                  isSelected ? "bg-zinc-700" : "hover:bg-zinc-800"
                } ${isOutlier ? "opacity-50 grayscale hover:opacity-70" : ""}`}
              >
                <td className="px-2 py-1.5 font-mono">{p.pitch_number}</td>
                <td className="px-2 py-1.5">
                  {isEditing && onEditPitchType && pitchTypeOptions ? (
                    <select
                      value={p.pitch_type}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        onEditPitchType(p.pitch_number, e.target.value);
                        setEditingPitch(null);
                      }}
                      onBlur={() => setEditingPitch(null)}
                      className="bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-100 outline-none"
                    >
                      {pitchTypeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: pitchColor(p.pitch_type) }}
                      />
                      {p.pitch_type}
                      {isEdited && (
                        <span className="ml-1 px-1 py-0 rounded text-[9px] bg-amber-500/20 text-amber-400 leading-tight">
                          edited
                        </span>
                      )}
                      {isOutlier && (
                        <span
                          className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-zinc-700 bg-zinc-900 px-1.5 py-0 text-[9px] font-semibold text-amber-300 print:border-zinc-400 print:bg-white print:text-black"
                          title={`Outlier: miss > ${OUTLIER_MISS_THRESHOLD_IN}\u2033`}
                        >
                          OUTLIER
                          <span className="text-[8px] font-normal text-zinc-400 print:text-black">
                            &gt;{OUTLIER_MISS_THRESHOLD_IN}&Prime;
                          </span>
                        </span>
                      )}
                    </span>
                  )}
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
                {onEditPitchType && (
                  <td className="px-1 py-1.5 text-center">
                    <button
                      type="button"
                      title="Edit pitch type"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPitch(isEditing ? null : p.pitch_number);
                      }}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors text-[11px]"
                    >
                      ✎
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
