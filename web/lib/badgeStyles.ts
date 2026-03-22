/**
 * Shared badge styles used across leaderboards and hub surfaces.
 */

export function mutedBadgeClasses(): string {
  return "border-[rgba(var(--babson-grey-rgb),0.28)] bg-[rgba(var(--babson-grey-rgb),0.1)] text-slate-600";
}

export function readinessBadgeClasses(isReady: boolean): string {
  if (isReady) {
    // Light surfaces (e.g. Pitching+ leaderboard): dark green text on soft tint for contrast.
    return "border-[rgba(var(--babson-green-rgb),0.38)] bg-[rgba(var(--babson-green-rgb),0.12)] text-[var(--babson-green)] shadow-none";
  }

  return mutedBadgeClasses();
}
