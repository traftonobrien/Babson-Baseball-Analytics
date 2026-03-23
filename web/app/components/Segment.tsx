"use client";

interface SegmentProps<T extends string> {
  label: string;
  options: { value: T; display: string }[];
  selected: T;
  onChange: (v: T) => void;
  variant?: "dark" | "light";
}

export default function Segment<T extends string>({
  label,
  options,
  selected,
  onChange,
  variant = "dark",
}: SegmentProps<T>) {
  const isLight = variant === "light";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-[11px] font-semibold uppercase tracking-wider ${
          isLight ? "text-slate-500" : "text-zinc-500"
        }`}
      >
        {label}
      </span>
      <div
        className={`flex rounded-lg overflow-hidden border p-0.5 ${
          isLight ? "border-slate-200 bg-slate-100/90" : "border-zinc-700/80 bg-zinc-900/60"
        }`}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-sm font-medium transition-smooth rounded-md ${
              selected === opt.value
                ? isLight
                  ? "border border-[var(--brand-primary-border)] bg-surface text-[var(--brand-primary-subtle-text)] shadow-sm"
                  : "bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm"
                : isLight
                  ? "text-slate-500 hover:bg-surface hover:text-slate-900"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
            }`}
          >
            {opt.display}
          </button>
        ))}
      </div>
    </div>
  );
}
