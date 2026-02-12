"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Pitch } from "../types";
import { overlayUrl, clipUrl } from "../utils";
import { pitchArmSideX, hDirectionLabel } from "@/lib/handedness";

const DEBUG_HOTKEYS = false;
const VIDEO_FPS = 30;

interface Props {
  pitch: Pitch | null;
  overlayDir: string;
  clipsDir: string;
  pitcherHand: "R" | "L";
}

export default function VideoPlayer({ pitch, overlayDir, clipsDir, pitcherHand }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!pitch) {
      setSrc(null);
      setLoading(false);
      setErrored(false);
      return;
    }
    setLoading(true);
    setErrored(false);
    setSrc(overlayUrl(pitch, overlayDir));
  }, [pitch, overlayDir]);

  /* ---- Global J/L frame-stepping hotkeys ---- */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore when typing in form elements
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    // Ignore when modifier keys are held
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const video = videoRef.current;
    if (!video) return;

    const frameDuration = 1 / VIDEO_FPS;

    if (e.key === "j") {
      e.preventDefault();
      video.pause();
      video.currentTime = Math.max(0, video.currentTime - frameDuration);
      if (DEBUG_HOTKEYS) console.log(`[hotkey] J: step back to ${video.currentTime.toFixed(4)}s`);
    } else if (e.key === "l") {
      e.preventDefault();
      video.pause();
      video.currentTime = Math.min(video.duration, video.currentTime + frameDuration);
      if (DEBUG_HOTKEYS) console.log(`[hotkey] L: step forward to ${video.currentTime.toFixed(4)}s`);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleLoadedData = () => setLoading(false);

  const handleError = () => {
    if (!pitch) return;
    const fallback = clipUrl(pitch, clipsDir);
    if (src !== fallback) {
      setSrc(fallback);
    } else {
      setLoading(false);
      setErrored(true);
    }
  };

  if (!pitch) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden w-full">
        <div className="aspect-[352/342] flex items-center justify-center text-zinc-500 text-sm">
          Select a pitch to play overlay video
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden w-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 text-xs text-zinc-400">
        <span>
          Pitch #{pitch.pitch_number} &middot; {pitch.pitch_type} &middot;{" "}
          {pitch.total_miss_inches.toFixed(1)}&quot; miss
        </span>
        <span>
          {pitch.h_miss_inches.toFixed(1)}&quot; {hDirectionLabel(pitchArmSideX(pitch, pitcherHand))},{" "}
          {pitch.v_miss_inches.toFixed(1)}&quot; {pitch.v_direction}
        </span>
      </div>

      {/* Video viewport */}
      <div className="relative aspect-[352/342] bg-black max-h-[45vh]">
        {errored ? (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm px-4 text-center">
            Video unavailable for this pitch. Check that the overlay file exists
            in public/data/&hellip;/results/
          </div>
        ) : (
          <>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-zinc-400 text-sm z-10">
                Loading video&hellip;
              </div>
            )}
            {src && (
              <video
                ref={videoRef}
                key={src}
                src={src}
                controls
                autoPlay
                loop
                className="absolute inset-0 w-full h-full object-contain"
                onLoadedData={handleLoadedData}
                onError={handleError}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
