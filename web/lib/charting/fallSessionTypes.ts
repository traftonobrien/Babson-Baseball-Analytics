// Client-safe constants — no DB imports

export const FALL_SESSION_TYPES = [
  "fall_bullpen",
  "fall_live_ab",
  "fall_intersquad",
  "fall_scrimmage",
] as const;

export type FallSessionType = (typeof FALL_SESSION_TYPES)[number];

export const FALL_SESSION_LABELS: Record<FallSessionType, string> = {
  fall_bullpen: "Bullpen",
  fall_live_ab: "Live ABs",
  fall_intersquad: "Intersquad",
  fall_scrimmage: "Scrimmage",
};

export function isFallSessionType(v: string): v is FallSessionType {
  return (FALL_SESSION_TYPES as readonly string[]).includes(v);
}
