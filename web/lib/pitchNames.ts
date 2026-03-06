const PITCH_NAMES: Record<string, string> = {
  FF: "Fastball",
  FASTBALL: "Fastball",
  SI: "Sinker",
  SINKER: "Sinker",
  SL: "Slider",
  SLIDER: "Slider",
  CH: "Changeup",
  CHANGEUP: "Changeup",
  CU: "Curveball",
  CB: "Curveball",
  CURVEBALL: "Curveball",
  FC: "Cutter",
  CT: "Cutter",
  CUTTER: "Cutter",
  FS: "Splitter",
  SPLITTER: "Splitter",
  KC: "Knuckle Curve",
  "KNUCKLE CURVE": "Knuckle Curve",
  SW: "Sweeper",
  SWEEPER: "Sweeper",
  FF_SI: "Fastball / Sinker",
  CH_FS: "Changeup / Splitter",
  SL_SW: "Slider / Sweeper",
};

export function pitchDisplayName(pitchType: string): string {
  const normalized = pitchType.trim();
  return PITCH_NAMES[normalized.toUpperCase()] ?? normalized;
}
