/**
 * Debug surface for verifying handedness resolution in the browser.
 *
 * Usage (browser console):
 *   window.__PT_DEBUG_HAND = true   // enable per-pitch logging
 *   window.__PT_DEBUG               // inspect resolved state
 */

import type { Pitch } from "@/app/types";
import { pitchArmSideX, hDirectionLabel, laneOf } from "./handedness";

declare global {
  interface Window {
    __PT_DEBUG_HAND: boolean;
    __PT_DEBUG: {
      lastPlayerId: string;
      resolvedHand: "R" | "L";
      samplePitchDebug: SamplePitchDebug | null;
      lastDxTruthTable: string;
    };
  }
}

interface SamplePitchDebug {
  pitchNumber: number;
  ball_x: number;
  target_x: number;
  dx: number;
  h_miss_inches: number;
  armSideX: number;
  sideLabel: string;
  lane: string;
  csvH_direction: string;
  csvPitcherHand: string;
}

/** Initialize the debug globals (safe to call multiple times). */
export function initDebug(): void {
  if (typeof window === "undefined") return;

  if (window.__PT_DEBUG_HAND === undefined) {
    window.__PT_DEBUG_HAND = false;
  }
  if (!window.__PT_DEBUG) {
    window.__PT_DEBUG = {
      lastPlayerId: "",
      resolvedHand: "R",
      samplePitchDebug: null,
      lastDxTruthTable: "",
    };
  }
}

/** Update debug state after pitch data loads. */
export function updateDebug(
  playerId: string,
  pitcherHand: "R" | "L",
  pitches: Pitch[],
): void {
  if (typeof window === "undefined") return;
  initDebug();

  const truthTable =
    pitcherHand === "R"
      ? "RHP: dx>0 => arm-side, dx<0 => glove-side"
      : "LHP: dx>0 => glove-side, dx<0 => arm-side";

  let sample: SamplePitchDebug | null = null;
  if (pitches.length > 0) {
    // Pick first pitch with nonzero dx
    const p = pitches.find((p) => p.ball_x !== p.target_x) ?? pitches[0];
    const dx = p.ball_x - p.target_x;
    const armSideX = pitchArmSideX(p, pitcherHand);
    sample = {
      pitchNumber: p.pitch_number,
      ball_x: p.ball_x,
      target_x: p.target_x,
      dx,
      h_miss_inches: p.h_miss_inches,
      armSideX,
      sideLabel: hDirectionLabel(armSideX),
      lane: laneOf(armSideX),
      csvH_direction: p.h_direction,
      csvPitcherHand: p.pitcher_hand,
    };
  }

  window.__PT_DEBUG = {
    lastPlayerId: playerId,
    resolvedHand: pitcherHand,
    samplePitchDebug: sample,
    lastDxTruthTable: truthTable,
  };

  // Per-pitch console logging when toggled on
  if (window.__PT_DEBUG_HAND && pitches.length > 0) {
    const limit = Math.min(pitches.length, 5);
    for (let i = 0; i < limit; i++) {
      const p = pitches[i];
      const dx = p.ball_x - p.target_x;
      const asx = pitchArmSideX(p, pitcherHand);
      console.log(
        `[PT_DEBUG] #${p.pitch_number} hand=${pitcherHand} dx=${dx.toFixed(1)} mag=${p.h_miss_inches.toFixed(2)} armSideX=${asx.toFixed(2)} => ${hDirectionLabel(asx)} (csv said: ${p.h_direction})`,
      );
    }
  }
}
