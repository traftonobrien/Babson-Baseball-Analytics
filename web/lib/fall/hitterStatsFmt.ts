export function formatHitterAvg(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(3).replace(/^0\./, ".");
}

export function formatHitterStat(value: number | null, decimals = 3): string {
  if (value === null) return "—";
  return value.toFixed(decimals);
}
