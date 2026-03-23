import type { ReactNode } from "react";

import { CheckCircle2, PencilLine, Timer } from "lucide-react";

import {
  CHARTING_LOCATION_CELLS as LOCATION_CELLS,
  clipPathForLocationCell as clipPathForCell,
  cornerLabelClass,
} from "@/lib/charting/locationGrid";

import type { ChartingGameStatus } from "./types";
import type { SelectionTone } from "./pitch-utils";

interface ControlFieldProps {
  label: string;
  helper: string;
  children: ReactNode;
}

export const ControlField = ({
  label,
  helper,
  children,
}: ControlFieldProps) => {
  return (
    <label className="block space-y-2">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </span>
      {children}
      <span className="block text-xs text-zinc-500">{helper}</span>
    </label>
  );
};

interface SurfacePanelProps {
  children: ReactNode;
  className?: string;
}

export const SurfacePanel = ({
  children,
  className = "",
}: SurfacePanelProps) => {
  return (
    <section
      className={`rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)] ${className}`}
    >
      {children}
    </section>
  );
};

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  body: string;
}

export const SectionHeading = ({
  eyebrow,
  title,
  body,
}: SectionHeadingProps) => {
  return (
    <header className="flex flex-col gap-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        {eyebrow}
      </div>
      <h2 className="text-lg font-bold leading-none tracking-tight text-zinc-50">
        {title}
      </h2>
      {body ? <p className="mt-1 text-xs text-zinc-400">{body}</p> : null}
    </header>
  );
};

interface MetricPillProps {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "emerald" | "amber" | "sky" | "slate";
}

export const MetricPill = ({
  label,
  value,
  icon,
  tone,
}: MetricPillProps) => {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${metricToneClass(tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {label}
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">{value}</div>
        </div>
        <div className="text-zinc-300">{icon}</div>
      </div>
    </div>
  );
};

interface StatTagProps {
  label: string;
  value: string;
  action?: ReactNode;
}

export const StatTag = ({ label, value, action }: StatTagProps) => {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
      <span>{label}</span>
      {action ?? <span className="text-zinc-100">{value}</span>}
    </div>
  );
};

interface StatusBadgeProps {
  status: ChartingGameStatus;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  if (status === "final") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Final
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
        <Timer className="h-3.5 w-3.5" />
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
      <PencilLine className="h-3.5 w-3.5" />
      Draft
    </span>
  );
};

interface SelectionButtonProps {
  title: string;
  subtitle: string;
  active: boolean;
  tone: SelectionTone;
  onClick: () => void;
}

export const SelectionButton = ({
  title,
  subtitle,
  active,
  tone,
  onClick,
}: SelectionButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-4 text-left transition-all ${selectionToneClass(
        tone,
        active,
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-xs leading-6 opacity-80">{subtitle}</div>
          ) : null}
        </div>
        {active ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      </div>
    </button>
  );
};

interface PitchLocationGridProps {
  selectedLocation: number | null;
  disabled: boolean;
  onSelect: (cellId: number) => void;
}

export const PitchLocationGrid = ({
  selectedLocation,
  disabled,
  onSelect,
}: PitchLocationGridProps) => {
  return (
    <div className="relative aspect-square w-full max-w-[26rem] rounded-[2.75rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_48%),linear-gradient(180deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.95))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="grid h-full grid-cols-5 grid-rows-5 gap-2">
        {LOCATION_CELLS.map((cell) => {
          const active = selectedLocation === cell.id;
          return (
            <button
              key={cell.id}
              type="button"
              onClick={() => onSelect(cell.id)}
              disabled={disabled}
              className={`${cell.className} relative overflow-hidden border transition-all ${
                active
                  ? "border-sky-300/50 bg-sky-400/20 text-white shadow-[0_18px_50px_rgba(59,130,246,0.28)]"
                  : "border-zinc-700 bg-zinc-900/70 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100"
              } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
              style={{
                clipPath: clipPathForCell(cell.kind),
                borderRadius: cell.kind === "square" ? "1.1rem" : "1.5rem",
              }}
            >
              <span
                className={`absolute text-lg font-black ${
                  cell.kind === "square"
                    ? "inset-0 flex items-center justify-center"
                    : cornerLabelClass(cell.kind)
                }`}
              >
                {cell.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-4 rounded-[2.3rem] border border-white/5" />
    </div>
  );
};

export const countPresetButtonClass = (
  active: boolean,
  disabled: boolean,
): string => {
  return [
    "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
    active
      ? "bg-[var(--babson-green)] text-white shadow-[0_10px_22px_rgba(var(--babson-green-rgb),0.2)]"
      : "text-[rgb(212,220,218)] hover:bg-surface/6",
    disabled ? "cursor-not-allowed opacity-70 hover:bg-transparent" : "",
  ].join(" ");
};

const selectionToneClass = (
  tone: SelectionTone,
  active: boolean,
): string => {
  const palette = {
    emerald: active
      ? "border-emerald-300/40 bg-emerald-500/16 text-emerald-100 shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-emerald-400/25 hover:text-zinc-100",
    rose: active
      ? "border-rose-300/40 bg-rose-500/16 text-rose-100 shadow-[0_18px_40px_rgba(244,63,94,0.16)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-rose-400/25 hover:text-zinc-100",
    amber: active
      ? "border-amber-300/40 bg-amber-500/16 text-amber-100 shadow-[0_18px_40px_rgba(245,158,11,0.16)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-amber-400/25 hover:text-zinc-100",
    sky: active
      ? "border-sky-300/40 bg-sky-500/16 text-sky-100 shadow-[0_18px_40px_rgba(59,130,246,0.16)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-sky-400/25 hover:text-zinc-100",
    violet: active
      ? "border-violet-300/40 bg-violet-500/16 text-violet-100 shadow-[0_18px_40px_rgba(139,92,246,0.16)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-violet-400/25 hover:text-zinc-100",
    slate: active
      ? "border-zinc-500/40 bg-zinc-700/40 text-zinc-100 shadow-[0_18px_40px_rgba(63,63,70,0.18)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100",
  };

  return palette[tone];
};

const metricToneClass = (
  tone: "emerald" | "amber" | "sky" | "slate",
): string => {
  switch (tone) {
    case "emerald":
      return "border-emerald-500/20 bg-emerald-500/10";
    case "amber":
      return "border-amber-400/20 bg-amber-400/10";
    case "sky":
      return "border-sky-500/20 bg-sky-500/10";
    case "slate":
      return "border-zinc-800 bg-zinc-950/80";
  }
};
