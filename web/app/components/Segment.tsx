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
        className={`inline-flex rounded-full border bg-background p-1 ${
          isLight ? "border-slate-100" : "border-zinc-800"
        }`}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              selected === opt.value
                ? "bg-surface text-slate-900 shadow-sm dark:text-zinc-50"
                : isLight
                  ? "text-slate-500 hover:text-slate-900"
                  : "text-zinc-400 hover:text-zinc-50"
            }`}
          >
            {opt.display}
          </button>
        ))}
      </div>
    </div>
  );
}
