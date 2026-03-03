"use client";

import { useState } from "react";
import type { Pitch } from "../types";
import { pitchColor } from "../utils";
import { isOutlier as isOutlierPitch, OUTLIER_MISS_THRESHOLD_IN } from "@/lib/reportModel";
import { pitchArmSideX, hDirectionLabel } from "@/lib/handedness";

interface Props {
  pitches: Pitch[];
  selected: Pitch | null;
  onSelect: (p: Pitch) => void;
  /** Pitcher hand resolved from Arsenals.csv — used for arm/glove labels. */
  pitcherHand: "R" | "L";
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
  pitcherHand,
  editedPitches,
  onEditPitchType,
  pitchTypeOptions,
}: Props) {
  const [editingPitch, setEditingPitch] = useState<number | null>(null);

  return (
    <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-zinc-950/95 text-zinc-500 backdrop-blur">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.2em]">#</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.2em]">Type</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.2em]">Miss</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.2em]">H</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.2em]">V</th>
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
                className={`cursor-pointer border-b border-zinc-800/70 transition-all duration-300 ${
                  isSelected
                    ? "bg-orange-500/[0.09] shadow-[inset_2px_0_0_rgba(251,146,60,0.7)]"
                    : "hover:bg-zinc-900/80"
                } ${isOutlier ? "opacity-55 grayscale hover:opacity-75" : ""}`}
              >
                <td className="px-3 py-2 font-mono text-zinc-300">{p.pitch_number}</td>
                <td className="px-3 py-2">
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
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none"
                    >
                      {pitchTypeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-zinc-100"
                        style={{
                          borderColor: `${pitchColor(p.pitch_type)}55`,
                          background: `linear-gradient(135deg, ${pitchColor(p.pitch_type)}22, rgba(9,9,11,0.92))`,
                        }}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: pitchColor(p.pitch_type) }}
                        />
                        {p.pitch_type}
                      </span>
                      {isEdited && (
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-300">
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
                <td className="px-3 py-2 text-right font-mono text-zinc-200">
                  {Number.isFinite(p.total_miss_inches) ? `${p.total_miss_inches.toFixed(1)}"` : "—"}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {Number.isFinite(p.h_miss_inches) ? `${p.h_miss_inches.toFixed(1)}" ${hDirectionLabel(pitchArmSideX(p, pitcherHand))}` : "—"}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {Number.isFinite(p.v_miss_inches) ? `${p.v_miss_inches.toFixed(1)}" ${p.v_direction}` : "—"}
                </td>
                {onEditPitchType && (
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      title="Edit pitch type"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPitch(isEditing ? null : p.pitch_number);
                      }}
                      className="rounded-md px-1 text-[11px] text-zinc-500 transition-all duration-300 hover:bg-zinc-800 hover:text-zinc-300"
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
