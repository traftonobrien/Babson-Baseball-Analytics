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

export const EDITOR_PANEL_CLASS =
  "rounded-[1.6rem] border border-border/80 bg-surface/95 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-zinc-800/90 dark:bg-zinc-950/82 dark:shadow-[0_18px_44px_rgba(0,0,0,0.35)]";

export const EDITOR_PANEL_MUTED_CLASS =
  "rounded-[1.35rem] border border-border/70 bg-background/92 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/74 dark:shadow-[0_12px_30px_rgba(0,0,0,0.24)]";

export const EDITOR_MUTED_LABEL_CLASS =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-muted";

export const EDITOR_MUTED_TEXT_CLASS = "text-sm text-muted";

export const EDITOR_INPUT_CLASS =
  "h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted focus:border-[var(--brand-primary-border)] focus:bg-surface focus:ring-2 focus:ring-[rgba(var(--brand-primary-rgb),0.14)] dark:border-zinc-700 dark:bg-zinc-900/82 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-[rgba(var(--brand-primary-rgb),0.45)] dark:focus:bg-zinc-900 dark:focus:ring-[rgba(var(--brand-primary-rgb),0.18)]";

export const EDITOR_SELECT_CLASS = EDITOR_INPUT_CLASS;

export const EDITOR_ICON_BUTTON_CLASS =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted shadow-sm transition-colors hover:border-[var(--brand-primary-border)] hover:bg-surface hover:text-[var(--brand-primary-subtle-text)] dark:border-zinc-700 dark:bg-zinc-900/82 dark:text-zinc-400 dark:hover:border-[rgba(var(--brand-primary-rgb),0.35)] dark:hover:bg-zinc-900 dark:hover:text-zinc-50";

export const EDITOR_GHOST_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-muted shadow-sm transition-colors hover:border-[var(--brand-primary-border)] hover:bg-surface hover:text-foreground dark:border-zinc-700 dark:bg-zinc-900/82 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-50";

export const EDITOR_PILL_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted shadow-sm dark:border-zinc-700 dark:bg-zinc-900/82 dark:text-zinc-400";

export const EDITOR_MODAL_BACKDROP_CLASS =
  "fixed inset-0 flex items-center justify-center bg-[rgba(15,23,42,0.42)] p-4 backdrop-blur-sm dark:bg-black/70";

export const EDITOR_MODAL_CLASS =
  "w-full rounded-[2rem] border border-border bg-surface/97 shadow-[0_24px_64px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/92 dark:shadow-[0_24px_64px_rgba(0,0,0,0.45)]";

export const ControlField = ({
  label,
  helper,
  children,
}: ControlFieldProps) => {
  return (
    <label className="block space-y-2">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        {label}
      </span>
      {children}
      <span className="block text-xs text-muted">{helper}</span>
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
      className={`${EDITOR_PANEL_CLASS} p-4 ${className}`}
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">
        {eyebrow}
      </div>
      <h2 className="text-lg font-bold leading-none tracking-tight text-foreground dark:text-zinc-50">
        {title}
      </h2>
      {body ? <p className="mt-1 text-xs text-muted">{body}</p> : null}
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
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
            {label}
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground dark:text-zinc-100">{value}</div>
        </div>
        <div className="text-muted dark:text-zinc-300">{icon}</div>
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
    <div className={`${EDITOR_PILL_CLASS} gap-3 py-2`}>
      <span>{label}</span>
      {action ?? <span className="text-foreground dark:text-zinc-100">{value}</span>}
    </div>
  );
};

interface StatusBadgeProps {
  status: ChartingGameStatus;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  if (status === "final") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Final
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
        <Timer className="h-3.5 w-3.5" />
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300">
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
    <div className="relative aspect-square w-full max-w-[26rem] rounded-[2.75rem] border border-[rgba(var(--brand-primary-rgb),0.12)] bg-[radial-gradient(circle_at_center,_rgba(var(--brand-primary-rgb),0.14),_transparent_54%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(241,245,249,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_24px_54px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_48%),linear-gradient(180deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.95))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
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
                  ? "border-[rgba(var(--brand-primary-rgb),0.34)] bg-[rgba(var(--brand-primary-rgb),0.16)] text-[var(--brand-primary-deep)] shadow-[0_18px_50px_rgba(var(--brand-primary-rgb),0.18)] dark:border-sky-300/50 dark:bg-sky-400/20 dark:text-white dark:shadow-[0_18px_50px_rgba(59,130,246,0.28)]"
                  : "border-slate-200 bg-white/90 text-slate-500 hover:border-[rgba(var(--brand-primary-rgb),0.22)] hover:text-[var(--brand-primary-subtle-text)] dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
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
      <div className="pointer-events-none absolute inset-4 rounded-[2.3rem] border border-slate-200/80 dark:border-white/5" />
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
      : "text-slate-600 hover:bg-surface dark:text-zinc-300 dark:hover:bg-white/6",
    disabled ? "cursor-not-allowed opacity-70 hover:bg-transparent" : "",
  ].join(" ");
};

const selectionToneClass = (
  tone: SelectionTone,
  active: boolean,
): string => {
  const palette = {
    emerald: active
      ? "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-[0_18px_40px_rgba(16,185,129,0.12)] dark:border-emerald-300/40 dark:bg-emerald-500/16 dark:text-emerald-100 dark:shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
      : "border-border bg-surface text-foreground hover:border-emerald-200 hover:bg-emerald-50/80 hover:text-emerald-950 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:border-emerald-400/25 dark:hover:text-zinc-100",
    rose: active
      ? "border-rose-300 bg-rose-50 text-rose-900 shadow-[0_18px_40px_rgba(244,63,94,0.12)] dark:border-rose-300/40 dark:bg-rose-500/16 dark:text-rose-100 dark:shadow-[0_18px_40px_rgba(244,63,94,0.16)]"
      : "border-border bg-surface text-foreground hover:border-rose-200 hover:bg-rose-50/80 hover:text-rose-950 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:border-rose-400/25 dark:hover:text-zinc-100",
    amber: active
      ? "border-amber-300 bg-amber-50 text-amber-900 shadow-[0_18px_40px_rgba(245,158,11,0.12)] dark:border-amber-300/40 dark:bg-amber-500/16 dark:text-amber-100 dark:shadow-[0_18px_40px_rgba(245,158,11,0.16)]"
      : "border-border bg-surface text-foreground hover:border-amber-200 hover:bg-amber-50/80 hover:text-amber-950 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:border-amber-400/25 dark:hover:text-zinc-100",
    sky: active
      ? "border-sky-300 bg-sky-50 text-sky-900 shadow-[0_18px_40px_rgba(59,130,246,0.12)] dark:border-sky-300/40 dark:bg-sky-500/16 dark:text-sky-100 dark:shadow-[0_18px_40px_rgba(59,130,246,0.16)]"
      : "border-border bg-surface text-foreground hover:border-sky-200 hover:bg-sky-50/80 hover:text-sky-950 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:border-sky-400/25 dark:hover:text-zinc-100",
    violet: active
      ? "border-violet-300 bg-violet-50 text-violet-900 shadow-[0_18px_40px_rgba(139,92,246,0.12)] dark:border-violet-300/40 dark:bg-violet-500/16 dark:text-violet-100 dark:shadow-[0_18px_40px_rgba(139,92,246,0.16)]"
      : "border-border bg-surface text-foreground hover:border-violet-200 hover:bg-violet-50/80 hover:text-violet-950 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:border-violet-400/25 dark:hover:text-zinc-100",
    slate: active
      ? "border-slate-300 bg-slate-100 text-slate-900 shadow-[0_18px_40px_rgba(148,163,184,0.14)] dark:border-zinc-500/40 dark:bg-zinc-700/40 dark:text-zinc-100 dark:shadow-[0_18px_40px_rgba(63,63,70,0.18)]"
      : "border-border bg-surface text-foreground hover:border-border hover:text-foreground dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100",
  };

  return palette[tone];
};

const metricToneClass = (
  tone: "emerald" | "amber" | "sky" | "slate",
): string => {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10";
    case "amber":
      return "border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10";
    case "sky":
      return "border-sky-200 bg-sky-50 dark:border-sky-500/20 dark:bg-sky-500/10";
    case "slate":
      return "border-border bg-background dark:border-zinc-800 dark:bg-zinc-950/80";
  }
};
