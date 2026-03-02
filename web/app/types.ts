export interface Pitch {
  pitch_number: number;
  pitcher_name: string;
  pitcher_hand: string;
  pitch_type: string;
  raw_pitch_type?: string;
  target_frame: number;
  arrival_frame: number;
  target_x: number;
  target_y: number;
  ball_x: number;
  ball_y: number;
  total_miss_px: number;
  total_miss_inches: number;
  h_miss_px: number;
  h_miss_inches: number;
  h_direction: string;
  h_miss_signed: number;
  v_miss_px: number;
  v_miss_inches: number;
  v_direction: string;
  v_miss_signed: number;
  target_quadrant: string;
  result_quadrant: string;
  target_zone: string;
  timestamp: number;
  is_outlier?: number;
}

export interface Filters {
  pitchTypes: Set<string>;
  quadrants: Set<string>;
  maxMiss: number | null;   // null = no limit
}
