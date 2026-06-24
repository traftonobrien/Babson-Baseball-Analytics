import type { FallPitcherOutingRecord } from "./pitcherOutings";

export interface CalendarOuting {
  playerId: string;
  playerName: string;
  initials: string;
  pitchCount: number;
  outingType: string;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  outings: CalendarOuting[];
}

export interface CalendarWeek {
  days: CalendarDay[];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildCalendarData(
  allOutings: FallPitcherOutingRecord[],
  year: number,
  month: number, // 0-indexed
  today: string, // YYYY-MM-DD
): CalendarWeek[] {
  // Build lookup: date → outings[]
  const byDate = new Map<string, CalendarOuting[]>();
  for (const o of allOutings) {
    const list = byDate.get(o.outingDate) ?? [];
    list.push({
      playerId: o.playerId,
      playerName: o.playerName,
      initials: initials(o.playerName),
      pitchCount: o.summary.pitchCount,
      outingType: o.outingType,
    });
    byDate.set(o.outingDate, list);
  }

  // First day of month, pad to Sunday
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build flat day list: pad-before + month + pad-after (complete weeks)
  const days: CalendarDay[] = [];

  // Pad before
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    const dateStr = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    days.push({ date: dateStr, isCurrentMonth: false, isToday: dateStr === today, outings: byDate.get(dateStr) ?? [] });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(year, month, d);
    days.push({ date: dateStr, isCurrentMonth: true, isToday: dateStr === today, outings: byDate.get(dateStr) ?? [] });
  }

  // Pad after to complete last week
  let afterDay = 1;
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, afterDay++);
    const dateStr = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    days.push({ date: dateStr, isCurrentMonth: false, isToday: dateStr === today, outings: byDate.get(dateStr) ?? [] });
  }

  // Split into weeks
  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push({ days: days.slice(i, i + 7) });
  }

  return weeks;
}

export function getMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}
