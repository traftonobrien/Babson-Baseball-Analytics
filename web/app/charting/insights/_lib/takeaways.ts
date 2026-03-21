import type {
  ChartingPlayerComparisonSummary,
} from "@/lib/charting/playerComparison";
import type { PitcherComparisonSummary } from "@/lib/charting/pitcherComparison";

import type { ComparisonPitchMixItem } from "./types";

const MIN_EXPLORER_SAMPLE = 15;

export const derivePitcherExplorerTakeaways = (
  summary: PitcherComparisonSummary,
  pitchMix: ComparisonPitchMixItem[],
): string[] => {
  if (summary.totalPitches < MIN_EXPLORER_SAMPLE) return [];

  const takeaways: string[] = [];
  const sorted = [...pitchMix].sort((left, right) => right.share - left.share);
  const top = sorted[0];
  const second = sorted[1];
  const spreadCount = sorted.filter((pitch) => pitch.share >= 15).length;

  if (top) {
    if (top.share >= 50) {
      takeaways.push(
        `Leans on the ${top.label} (${top.share.toFixed(0)}% of pitches in this slice).`,
      );
    } else if (second && top.share + second.share >= 65) {
      takeaways.push(
        `Works mostly off the ${top.label} and ${second.label} (${(top.share + second.share).toFixed(0)}% combined).`,
      );
    } else if (spreadCount >= 3) {
      takeaways.push(`Spread mix across ${spreadCount} pitch types in this sample.`);
    }
  }

  if (summary.strikePct !== null) {
    if (summary.strikePct >= 68) {
      takeaways.push(
        `Strong attack zone — ${summary.strikePct.toFixed(0)}% strike rate in this sample.`,
      );
    } else if (summary.strikePct < 56) {
      takeaways.push(
        `Elevated ball rate — ${summary.strikePct.toFixed(0)}% strikes in this sample.`,
      );
    }
  }

  if (summary.whiffPct !== null && summary.whiffPct >= 22) {
    takeaways.push(`Generating misses — ${summary.whiffPct.toFixed(0)}% whiff rate on swings.`);
  }

  if (takeaways.length < 3 && summary.kPct !== null && summary.kPct >= 28) {
    takeaways.push(`Strong strikeout rate — ${summary.kPct.toFixed(0)}% of PAs end in a K.`);
  }

  return takeaways.slice(0, 3);
};

export const deriveHitterExplorerTakeaways = (
  summary: ChartingPlayerComparisonSummary,
  pitchMix: ComparisonPitchMixItem[],
): string[] => {
  if (summary.totalPitches < MIN_EXPLORER_SAMPLE) return [];

  const takeaways: string[] = [];
  const sorted = [...pitchMix].sort((left, right) => right.share - left.share);

  if (summary.swingPct !== null) {
    if (summary.swingPct >= 55) {
      takeaways.push(
        `Aggressive swing decisions — swinging at ${summary.swingPct.toFixed(0)}% of pitches in this slice.`,
      );
    } else if (summary.swingPct < 35) {
      takeaways.push(
        `Patient approach — swinging at only ${summary.swingPct.toFixed(0)}% of pitches in this slice.`,
      );
    }
  }

  if (summary.whiffPct !== null && summary.whiffPct >= 30) {
    takeaways.push(
      `Trouble making contact — ${summary.whiffPct.toFixed(0)}% whiff rate when swinging.`,
    );
  }

  if (summary.woba !== null && (summary.plateAppearances ?? 0) >= 8) {
    if (summary.woba >= 0.380) {
      takeaways.push(`Strong production in this sample — ${summary.woba.toFixed(3)} wOBA.`);
    } else if (summary.woba < 0.270) {
      takeaways.push(`Limited production in this sample — ${summary.woba.toFixed(3)} wOBA.`);
    }
  }

  if (takeaways.length < 3 && sorted[0] && sorted[0].share >= 55) {
    takeaways.push(
      `Mostly sees ${sorted[0].label} in this slice (${sorted[0].share.toFixed(0)}%).`,
    );
  }

  return takeaways.slice(0, 3);
};
