export const RELEASE_THEME = {
  colors: {
    amber: {
      core: "#fbbf24", // amber-400
      glow: "#f59e0b", // amber-500
      dim: "#78350f",  // amber-900
    },
    zinc: {
      bg: "#09090b",   // zinc-950
      border: "#27272a", // zinc-800
      textDim: "#71717a", // zinc-500
      text: "#e4e4e7", // zinc-200
    },
    tier: {
      extreme: "#ef4444", // red-500 (Submarine)
      low: "#f97316",     // orange-500 (Low Sidearm)
      mid: "#fbbf24",     // amber-400 (3/4)
      high: "#facc15",    // yellow-400 (High 3/4) - Electric Yellow
      ott: "#bef264",     // lime-400 (OTT) - Distinct from mid/high
    }
  },
  filters: {
    beamGlow: "beam-glow-filter",
    ballGlow: "ball-glow-filter",
    shadow: "drop-shadow-filter",
  },
  animation: {
    duration: "400ms",
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  }
};

export function getTierColor(tier: string | null | undefined, angleDeg?: number): string {
  if (angleDeg !== undefined) {
    if (angleDeg < 20) return RELEASE_THEME.colors.tier.extreme;
    if (angleDeg < 45) return RELEASE_THEME.colors.tier.low;
    if (angleDeg < 65) return RELEASE_THEME.colors.tier.mid;
    if (angleDeg < 80) return RELEASE_THEME.colors.tier.high;
    return RELEASE_THEME.colors.tier.ott;
  }

  switch (tier) {
    case "extreme": return RELEASE_THEME.colors.tier.extreme; // Default to sub mapping if unknown
    case "low": return RELEASE_THEME.colors.tier.low;
    case "mid": return RELEASE_THEME.colors.tier.mid;
    case "high": return RELEASE_THEME.colors.tier.high;
    default: return RELEASE_THEME.colors.amber.core;
  }
}
