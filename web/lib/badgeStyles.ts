/**
 * Shared badge styles used across leaderboards and hub surfaces.
 */

export function mutedBadgeClasses(): string {
  return "border-[rgba(var(--babson-grey-rgb),0.22)] bg-[rgba(var(--babson-grey-rgb),0.08)] text-zinc-400";
}

export function readinessBadgeClasses(isReady: boolean): string {
  if (isReady) {
    return "border-[rgba(var(--babson-green-rgb),0.34)] bg-[rgba(var(--babson-green-rgb),0.16)] text-[rgb(198_237_221)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.08)]";
  }

  return mutedBadgeClasses();
}
