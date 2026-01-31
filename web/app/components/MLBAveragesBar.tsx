import { pitchColor } from "@/lib/pitchColors";

const MLB_AVERAGES: { code: string; avg: number }[] = [
  { code: "FF", avg: 12.7 },
  { code: "SI", avg: 11.7 },
  { code: "FC", avg: 11.4 },
  { code: "SL", avg: 11.7 },
  { code: "CB", avg: 13.0 },
  { code: "CH", avg: 11.4 },
  { code: "FS", avg: 11.4 },
];

export default function MLBAveragesBar() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-5 py-4">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-xs font-medium text-zinc-300">
          MLB Averages (Miss Distance)
        </span>
        <span className="text-[10px] text-zinc-500">
          inches &middot; Driveline Baseball
        </span>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {MLB_AVERAGES.map(({ code, avg }) => {
          const color = pitchColor(code);
          return (
            <div
              key={code}
              className="flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-900/70 px-3 py-2"
              style={{ boxShadow: `0 0 12px ${color}40` }}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span
                className="text-sm font-mono font-bold"
                style={{ color }}
              >
                {code}
              </span>
              <span className="text-sm font-mono font-semibold tabular-nums text-zinc-300">
                {avg.toFixed(1)}&Prime;
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
