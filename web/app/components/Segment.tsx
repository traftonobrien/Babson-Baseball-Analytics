"use client";

interface SegmentProps<T extends string> {
  label: string;
  options: { value: T; display: string }[];
  selected: T;
  onChange: (v: T) => void;
}

export default function Segment<T extends string>({ label, options, selected, onChange }: SegmentProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="flex rounded-lg overflow-hidden border border-zinc-700/80 bg-zinc-900/60 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-sm font-medium transition-smooth rounded-md ${
              selected === opt.value
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm"
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
