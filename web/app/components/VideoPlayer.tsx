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
      <div className="w-full overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
        <div className="border-b border-[#F1F5F9] px-4 py-3 dark:border-zinc-800">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#94A3B8] dark:text-zinc-500">
            Video Review
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Select a pitch from the log to load video.
          </div>
        </div>
        <div className="flex aspect-[352/342] items-center justify-center px-4 text-center text-sm text-slate-500 dark:text-zinc-400">
          Select a pitch to play overlay video
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
      {/* Header bar */}
      <div className="border-b border-[#F1F5F9] px-4 py-3 dark:border-zinc-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-subtle-text)]">
                Pitch #{pitch.pitch_number}
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{pitch.pitch_type}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {Number.isFinite(pitch.total_miss_inches)
                ? `${pitch.total_miss_inches.toFixed(1)}" miss`
                : "No read"}
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-zinc-400">
          {Number.isFinite(pitch.h_miss_inches) ? <>{pitch.h_miss_inches.toFixed(1)}&quot; {hDirectionLabel(pitchArmSideX(pitch, pitcherHand))},{" "}{pitch.v_miss_inches.toFixed(1)}&quot; {pitch.v_direction}</> : null}
          </span>
        </div>
      </div>

      {/* Video viewport */}
      <div className="relative aspect-[352/342] bg-black max-h-[45vh]">
        {errored ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm px-4 text-center">
            Video unavailable for this pitch. Check that the overlay file exists
            in public/data/&hellip;/results/
          </div>
        ) : (
          <>
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-sm text-slate-200">
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
