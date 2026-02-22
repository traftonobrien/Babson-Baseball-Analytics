export type MetricStatus = "ok" | "insufficient_data" | "error" | "skipped";

export interface MetricResult {
  status: MetricStatus;
  raw_value: number | null;
  unit: string;
  score: number | null;
  score_raw: number | null;
  score_eff: number | null;
  pass_fail: boolean | null;
  callout: string | null;
  confidence: number | null;
  low_confidence: boolean;
  manual_review_recommended?: boolean;
  reasons?: string[];
  coaching_cues: string[];
}

export interface PhaseFrame {
  frame_idx: number;
  time_s: number;
}

export interface NotesJson {
  efficiency_score: number;
  efficiency_low_confidence: boolean;
  hand: "R" | "L";
  view_mode: string;
  metrics: Record<string, MetricResult>;
  phases: Record<string, PhaseFrame>;
  camera_limitations: string[];
  limitations: {
    camera_view: string;
    not_measurable: string[];
    low_confidence_metrics: string[];
  };
  official_metric_set: string;
  official_metrics: string[];
  excluded_metrics_reason?: string;
  excluded_metrics_detail?: Record<string, string>;
}
