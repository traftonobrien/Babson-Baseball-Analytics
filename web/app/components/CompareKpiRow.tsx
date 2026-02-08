"use client";

import type { Report } from "@/lib/reportModel";
import type { ComparisonReport } from "@/lib/comparisonModel";

interface Props {
  reportA: Report;
  reportB: Report;
  delta: ComparisonReport["delta"];
}

function fmt(v: number, decimals: number = 1): string {
  return v.toFixed(decimals);
}

function DeltaCell({ value, unit, invert }: { value: number; unit: string; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  const color = positive
    ? "text-red-400"
    : negative
      ? "text-green-400"
      : "text-zinc-400";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`font-mono text-[11px] ${color}`}>
      {sign}{fmt(value)}{unit}
    </span>
  );
}

function KpiCell({ label, valueA, valueB, delta, unit, invert, decimals = 1 }: {
  label: string;
  valueA: number;
  valueB: number;
  delta: number;
  unit: string;
  invert?: boolean;
  decimals?: number;
}) {
  return (
    <div className="rounded border border-zinc-700 px-2 py-1.5">
      <div className="text-[7px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="text-[7px] text-zinc-500 mb-0.5">A</div>
          <div className="font-mono text-[12px] font-bold">{valueA.toFixed(decimals)}{unit}</div>
        </div>
        <div>
          <div className="text-[7px] text-zinc-500 mb-0.5">B</div>
          <div className="font-mono text-[12px] font-bold">{valueB.toFixed(decimals)}{unit}</div>
        </div>
        <div>
          <div className="text-[7px] text-zinc-500 mb-0.5">&Delta;</div>
          <div><DeltaCell value={delta} unit={unit} invert={invert} /></div>
        </div>
      </div>
    </div>
  );
}

export default function CompareKpiRow({ reportA, reportB, delta }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
      <KpiCell
        label="Avg Miss"
        valueA={reportA.kpis.avgMiss}
        valueB={reportB.kpis.avgMiss}
        delta={delta.avgMiss}
        unit="&#8243;"
        invert
      />
      <KpiCell
        label="Median Miss"
        valueA={reportA.kpis.medianMiss}
        valueB={reportB.kpis.medianMiss}
        delta={delta.medianMiss}
        unit="&#8243;"
        invert
      />
      <KpiCell
        label="On Target"
        valueA={reportA.kpis.hitSpotPct}
        valueB={reportB.kpis.hitSpotPct}
        delta={delta.onTargetPct}
        unit="%"
        decimals={0}
      />
      <KpiCell
        label="Pitches"
        valueA={reportA.meta.includedPitchCount}
        valueB={reportB.meta.includedPitchCount}
        delta={delta.includedCount}
        unit=""
        decimals={0}
      />
      <KpiCell
        label="Outliers"
        valueA={reportA.meta.outlierCount}
        valueB={reportB.meta.outlierCount}
        delta={delta.outlierCount}
        unit=""
        invert
        decimals={0}
      />
    </div>
  );
}
