export const METRIC_LABELS: Record<string, string> = {
  lead_leg_block_v3: "Lead Leg Block",
  lead_leg_block_v2: "Lead Leg Block",
  lead_leg_block_viz: "Lead Leg Block",
  hip_shoulder_sep_v3: "Hip-Shoulder Sep",
  hip_shoulder_sep_v2: "Hip-Shoulder Sep",
  hip_shoulder_separation_proxy: "Hip-Shoulder Sep",
  front_side_closedness_v2: "Front Side Closure",
  front_side_closedness: "Front Side Closure",
  release_extension_v2: "Release Extension",
  release_extension_proxy: "Release Extension",
  timing: "Timing",
  swivel_stabilize: "Glove Swivel",
  trunk_stability_v2: "Trunk Stability",
  trunk_stability: "Trunk Stability",
  stack_track: "Stack & Track",
  torque_retention: "Torque Retention",
  balance: "Balance",
  posture: "Posture",
  drift_forward: "Forward Drift",
};

export const PHASE_LABELS: Record<string, string> = {
  set: "Set",
  peak_leg_lift: "Leg Lift",
  foot_strike: "Foot Strike",
  ball_release: "Release",
};

export const PHASE_IMAGE_KEYS: Record<string, string> = {
  set: "set.png",
  peak_leg_lift: "peak_leg_lift.png",
  foot_strike: "foot_strike.png",
  ball_release: "release.png",
};

// Which metrics are conceptually linked to foot strike vs release
export const FOOT_STRIKE_METRIC_AFFINITY = new Set([
  "lead_leg_block_v3", "lead_leg_block_v2", "lead_leg_block_viz",
  "hip_shoulder_sep_v3", "hip_shoulder_sep_v2", "hip_shoulder_separation_proxy",
  "front_side_closedness_v2", "front_side_closedness",
  "timing",
]);

export const RELEASE_METRIC_AFFINITY = new Set([
  "release_extension_v2", "release_extension_proxy",
  "swivel_stabilize",
  "trunk_stability_v2", "trunk_stability",
  "stack_track", "torque_retention",
]);

export function metricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key.replace(/_v\d+$/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function phaseLabel(key: string): string {
  return PHASE_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function scoreColor(score: number | null): string {
  if (score === null) return "#71717a";
  if (score >= 8) return "#22c55e";
  if (score >= 6) return "#a3e635";
  if (score >= 4) return "#f59e0b";
  return "#ef4444";
}

export function scoreBg(score: number | null): string {
  if (score === null) return "bg-zinc-800";
  if (score >= 8) return "bg-green-950/60 border-green-800/40";
  if (score >= 6) return "bg-lime-950/60 border-lime-800/40";
  if (score >= 4) return "bg-amber-950/60 border-amber-800/40";
  return "bg-red-950/60 border-red-800/40";
}

export function confidenceLabel(conf: number | null): string {
  if (conf === null) return "—";
  if (conf >= 0.7) return "High";
  if (conf >= 0.5) return "Med";
  if (conf >= 0.3) return "Low";
  return "Very Low";
}
