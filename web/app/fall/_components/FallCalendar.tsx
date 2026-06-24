"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildCalendarData, getMonthLabel, type CalendarOuting } from "@/lib/fall/calendarData";
import type { FallPitcherOutingRecord } from "@/lib/fall/pitcherOutings";

const TYPE_COLOR: Record<string, string> = {
  bullpen: "bg-sky-500/80",
  live_ab: "bg-violet-500/80",
  intersquad: "bg-emerald-500/80",
  scrimmage: "bg-emerald-500/80",
  game: "bg-amber-500/80",
  other: "bg-zinc-400/80",
};

const TYPE_LABEL: Record<string, string> = {
  bullpen: "BP",
  live_ab: "Live",
  intersquad: "IS",
  scrimmage: "Scrm",
  game: "G",
  other: "—",
};

function OutingChip({ outing }: { outing: CalendarOuting }) {
  const bg = TYPE_COLOR[outing.outingType] ?? "bg-zinc-400/80";
  return (
    <span
      title={`${outing.playerName} — ${outing.pitchCount}p (${TYPE_LABEL[outing.outingType] ?? outing.outingType})`}
      className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold leading-none text-white ${bg}`}
    >
      {outing.initials}
      <span className="opacity-80">{outing.pitchCount}</span>
    </span>
  );
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  outings: FallPitcherOutingRecord[];
  today: string;
}

export function FallCalendar({ outings, today }: Props) {
  const [year, setYear] = useState(() => parseInt(today.slice(0, 4)));
  const [month, setMonth] = useState(() => parseInt(today.slice(5, 7)) - 1);

  const weeks = buildCalendarData(outings, year, month, today);
  const label = getMonthLabel(year, month);

  function prev() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function next() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  // Total pitches this month
  const monthPitches = weeks
    .flatMap((w) => w.days)
    .filter((d) => d.isCurrentMonth)
    .reduce((sum, d) => sum + d.outings.reduce((s, o) => s + o.pitchCount, 0), 0);

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-surface-muted px-4 py-3">
        <button
          onClick={prev}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <span className="text-sm font-bold text-foreground">{label}</span>
          {monthPitches > 0 && (
            <span className="ml-2 text-[11px] text-muted">{monthPitches} pitches</span>
          )}
        </div>
        <button
          onClick={next}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-border">
        {DOW.map((d) => (
          <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="divide-y divide-border/50">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-border/50">
            {week.days.map((day) => {
              const dayNum = parseInt(day.date.slice(8));
              return (
                <div
                  key={day.date}
                  className={`min-h-[4.5rem] p-1.5 ${
                    !day.isCurrentMonth ? "bg-surface-muted/50" : ""
                  } ${day.isToday ? "ring-1 ring-inset ring-[var(--brand-primary-border)]" : ""}`}
                >
                  <div
                    className={`mb-1 text-[11px] font-semibold leading-none ${
                      day.isToday
                        ? "text-[var(--brand-primary-subtle-text)]"
                        : day.isCurrentMonth
                          ? "text-foreground"
                          : "text-muted/50"
                    }`}
                  >
                    {dayNum}
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {day.outings.map((o, i) => (
                      <OutingChip key={i} outing={o} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface-muted px-4 py-2.5">
        {Object.entries(TYPE_LABEL).filter(([k]) => k !== "other").map(([type, label]) => (
          <span key={type} className="flex items-center gap-1.5 text-[10px] text-muted">
            <span className={`h-2 w-2 rounded-sm ${TYPE_COLOR[type]}`} />
            {label === "BP" ? "Bullpen" : label === "Live" ? "Live AB" : label === "IS" ? "Intersquad" : label === "Scrm" ? "Scrimmage" : "Game"}
          </span>
        ))}
      </div>
    </div>
  );
}
