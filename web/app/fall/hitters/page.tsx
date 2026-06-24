import Link from "next/link";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { deriveFallHitterStats, type FallHitterAggregate } from "@/lib/charting/fallHitterAggregation";

export const runtime = "nodejs";

function fmt(n: number | null, dec = 0): string {
  if (n === null) return "—";
  return dec === 0 ? String(n) : n.toFixed(dec);
}

function fmtAvg(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(3).replace(/^0\./, ".");
}

function SourceBadge({ source }: { source: FallHitterAggregate["source"] }) {
  if (source === "excel_import") {
    return (
      <span className="ml-2 inline-flex items-center rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Import
      </span>
    );
  }
  return null;
}

function HitterTableRow({ h, rank }: { h: FallHitterAggregate; rank: number }) {
  const opsValue = h.ops ?? 0;
  const opsColor =
    opsValue >= 0.85
      ? "text-emerald-600 dark:text-emerald-400"
      : opsValue >= 0.7
        ? "text-foreground"
        : "text-muted";

  return (
    <div className="grid grid-cols-[auto_1fr_repeat(10,auto)] items-center gap-x-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <span className="w-5 text-center text-[11px] font-bold text-muted">{rank}</span>
      <span className="flex min-w-0 items-center font-bold text-foreground">
        <span className="truncate">{h.hitterName}</span>
        <SourceBadge source={h.source} />
      </span>
      <span className="text-right text-muted">
        <span className="block text-[10px] uppercase tracking-wide">PA</span>
        <span className="font-bold text-foreground">{fmt(h.pa)}</span>
      </span>
      <span className="text-right text-muted">
        <span className="block text-[10px] uppercase tracking-wide">AB</span>
        <span className="font-bold text-foreground">{fmt(h.ab)}</span>
      </span>
      <span className="text-right text-muted">
        <span className="block text-[10px] uppercase tracking-wide">H</span>
        <span className="font-bold text-foreground">{fmt(h.hits)}</span>
      </span>
      <span className="text-right text-muted">
        <span className="block text-[10px] uppercase tracking-wide">HR</span>
        <span className="font-bold text-foreground">{fmt(h.hr)}</span>
      </span>
      <span className="text-right text-muted">
        <span className="block text-[10px] uppercase tracking-wide">BB</span>
        <span className="font-bold text-foreground">{fmt(h.bb)}</span>
      </span>
      <span className="text-right text-muted">
        <span className="block text-[10px] uppercase tracking-wide">K</span>
        <span className="font-bold text-foreground">{fmt(h.k)}</span>
      </span>
      <span className="text-right text-muted">
        <span className="block text-[10px] uppercase tracking-wide">AVG</span>
        <span className="font-bold text-foreground">{fmtAvg(h.avg)}</span>
      </span>
      <span className="text-right text-muted">
        <span className="block text-[10px] uppercase tracking-wide">OBP</span>
        <span className="font-bold text-foreground">{fmtAvg(h.obp)}</span>
      </span>
      <span className="text-right text-muted">
        <span className="block text-[10px] uppercase tracking-wide">SLG</span>
        <span className="font-bold text-foreground">{fmtAvg(h.slg)}</span>
      </span>
      <span className="text-right">
        <span className="block text-[10px] uppercase tracking-wide text-muted">OPS</span>
        <span className={`font-black ${opsColor}`}>{fmtAvg(h.ops)}</span>
      </span>
    </div>
  );
}

export default async function FallHittersPage() {
  const hitters = await deriveFallHitterStats().catch(() => []);

  if (hitters.length === 0) {
    return (
      <LeaderboardPageFrame variant="light" maxWidth="max-w-4xl">
        <div className="py-16 text-center">
          <p className="text-sm font-semibold text-foreground">No hitter stats yet</p>
          <p className="mt-2 text-sm text-muted">
            Stats appear once fall sessions are charted. Run the Excel import script to load
            historical data.
          </p>
          <Link
            href="/fall"
            className="mt-6 inline-block text-sm font-semibold text-muted underline underline-offset-2 hover:text-foreground"
          >
            ← Fall Hub
          </Link>
        </div>
      </LeaderboardPageFrame>
    );
  }

  const sorted = [...hitters].sort((a, b) => (b.ops ?? 0) - (a.ops ?? 0));

  const totals = hitters.reduce(
    (acc, h) => ({
      pa: acc.pa + h.pa,
      ab: acc.ab + h.ab,
      hits: acc.hits + h.hits,
      hr: acc.hr + h.hr,
      bb: acc.bb + h.bb,
      k: acc.k + h.k,
    }),
    { pa: 0, ab: 0, hits: 0, hr: 0, bb: 0, k: 0 },
  );

  const teamAvg = totals.ab > 0 ? totals.hits / totals.ab : null;
  const teamBb = totals.pa > 0 ? totals.bb / totals.pa : null;
  const teamK = totals.pa > 0 ? totals.k / totals.pa : null;

  const chartingCount = hitters.filter((h) => h.source === "charting").length;
  const importCount = hitters.filter((h) => h.source === "excel_import").length;
  const sourceNote =
    chartingCount > 0 && importCount > 0
      ? `${chartingCount} charted · ${importCount} imported`
      : chartingCount > 0
        ? `${chartingCount} from charted sessions`
        : `${importCount} from workbook import`;

  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-5xl">
      <div className="py-4 sm:py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Fall
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">
              Hitter Stats
            </h1>
            <p className="mt-2 text-sm text-muted">
              {hitters.length} hitters · {sourceNote} · sorted by OPS
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-7">
          {(
            [
              ["PA", fmt(totals.pa)],
              ["AB", fmt(totals.ab)],
              ["H", fmt(totals.hits)],
              ["HR", fmt(totals.hr)],
              ["BB%", teamBb !== null ? (teamBb * 100).toFixed(1) + "%" : "—"],
              ["K%", teamK !== null ? (teamK * 100).toFixed(1) + "%" : "—"],
              ["AVG", fmtAvg(teamAvg)],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                {label}
              </span>
              <span className="text-xl font-black tracking-tight text-foreground">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {sorted.map((h, i) => (
            <HitterTableRow key={h.hitterName} h={h} rank={i + 1} />
          ))}
        </div>

        <div className="mt-6">
          <Link
            href="/fall"
            className="text-sm font-semibold text-muted underline underline-offset-2 hover:text-foreground"
          >
            ← Fall Hub
          </Link>
        </div>
      </div>
    </LeaderboardPageFrame>
  );
}
