import type { Pitch, Filters } from "./types";
export { pitchColor } from "@/lib/pitchColors";

/** Overlay MP4 URL */
export function overlayUrl(pitch: Pitch, overlayDir: string): string {
  const id = String(pitch.pitch_number).padStart(3, "0");
  return `${overlayDir}/pitch_${id}_overlay.mp4`;
}

/** Raw clip URL */
export function clipUrl(pitch: Pitch, clipsDir: string): string {
  const id = String(pitch.pitch_number).padStart(3, "0");
  return `${clipsDir}/pitch_${id}.mp4`;
}

/** Unique sorted pitch types from data (excludes empty/undefined) */
export function uniqueTypes(pitches: Pitch[]): string[] {
  return [...new Set(pitches.map((p) => p.pitch_type).filter(Boolean))].sort();
}

/** Apply filters to pitch array */
export function applyFilters(pitches: Pitch[], filters: Filters): Pitch[] {
  return pitches.filter((p) => {
    if (filters.pitchTypes.size > 0 && !filters.pitchTypes.has(p.pitch_type ?? ""))
      return false;
    if (filters.maxMiss !== null && p.total_miss_inches > filters.maxMiss)
      return false;
    return true;
  });
}
