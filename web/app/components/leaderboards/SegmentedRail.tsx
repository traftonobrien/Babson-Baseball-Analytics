"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface SegmentedItem<T extends string | number> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition-all ${
        active
          ? "bg-surface text-slate-900 shadow-sm ring-1 ring-slate-200 dark:text-zinc-50 dark:ring-zinc-600"
          : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Pitching+–style segmented control: slate rail, white active pill.
 */
export function SegmentedRail<T extends string | number>({
  label,
  items,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  items: SegmentedItem<T>[];
  value: T;
  onChange: (next: T) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
        {label}
      </div>
      <div
        className={`inline-flex flex-wrap gap-1 rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-zinc-700 dark:bg-zinc-900/70 ${
          compact ? "" : "w-full"
        }`}
      >
        {items.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
          const active = value === optionValue;
          return (
            <ToggleButton key={String(optionValue)} active={active} onClick={() => onChange(optionValue)}>
              <span className="inline-flex items-center gap-1.5">
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                <span>{optionLabel}</span>
              </span>
            </ToggleButton>
          );
        })}
      </div>
    </div>
  );
}
