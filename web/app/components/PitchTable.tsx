"use client";

import { useState } from "react";
import type { Pitch } from "../types";
import { pitchColor } from "../utils";
import { pitchChipSurfaceStyle } from "@/lib/pitchColors";
import { useSiteAppearance } from "@/app/components/SiteAppearanceContext";
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
  const siteDark = useSiteAppearance() === "dark";

  return (
    <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 border-b border-[#F1F5F9] bg-background/95 text-[#94A3B8] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-500">
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
                className={`cursor-pointer border-b border-[#F1F5F9] transition-all duration-300 ${
                  isSelected
                    ? "bg-[var(--brand-primary-soft)] shadow-[inset_2px_0_0_rgba(var(--brand-primary-rgb),0.55)]"
                    : "hover:bg-background"
                } ${isOutlier ? "opacity-55 grayscale hover:opacity-75" : ""}`}
              >
                <td className="px-3 py-2 font-mono text-[#475569] dark:text-zinc-400">{p.pitch_number}</td>
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
                      className="rounded-xl border border-[#E2E8F0] bg-surface px-2 py-1 text-xs text-slate-900 outline-none focus:border-[var(--brand-primary-border)] dark:border-zinc-700 dark:text-zinc-50"
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
                        className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-surface px-2 py-0.5 text-[10px] font-semibold text-slate-900 dark:bg-zinc-900/88 dark:text-zinc-50"
                        style={pitchChipSurfaceStyle(pitchColor(p.pitch_type), "tableSoft", siteDark)}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: pitchColor(p.pitch_type) }}
                        />
                        {p.pitch_type}
                      </span>
                      {isEdited && (
                        <span className="rounded-full border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary-subtle-text)]">
                          edited
                        </span>
                      )}
                      {isOutlier && (
                        <span
                          className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0 text-[9px] font-semibold text-slate-700 print:border-slate-300 print:bg-surface print:text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                          title={`Outlier: miss > ${OUTLIER_MISS_THRESHOLD_IN}\u2033`}
                        >
                          OUTLIER
                          <span className="text-[8px] font-normal text-slate-500 dark:text-zinc-400 print:text-black">
                            &gt;{OUTLIER_MISS_THRESHOLD_IN}&Prime;
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[#334155] dark:text-zinc-300">
                  {Number.isFinite(p.total_miss_inches) ? `${p.total_miss_inches.toFixed(1)}"` : "—"}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-zinc-400">
                  {Number.isFinite(p.h_miss_inches) ? `${p.h_miss_inches.toFixed(1)}" ${hDirectionLabel(pitchArmSideX(p, pitcherHand))}` : "—"}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-zinc-400">
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
                      className="rounded-md px-1 text-[11px] text-[#94A3B8] transition-all duration-300 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
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
