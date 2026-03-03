const PITCH_NAMES: Record<string, string> = {
  FF: "Fastball",
  SI: "Sinker",
  SL: "Slider",
  CH: "Changeup",
  CU: "Curveball",
  FC: "Cutter",
  FS: "Splitter",
  KC: "Knuckle Curve",
  CB: "Curveball",
  CT: "Cutter",
};

export function pitchDisplayName(pitchType: string): string {
  return PITCH_NAMES[pitchType] ?? pitchType;
}
