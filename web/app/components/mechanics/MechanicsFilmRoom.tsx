"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { phaseLabel } from "@/lib/mechanics/labels";
import type { NotesJson } from "@/lib/mechanics/types";

interface MechanicsFilmRoomProps {
  notes: NotesJson;
  basePath: string;
}

const PHASE_ORDER = ["set", "peak_leg_lift", "foot_strike", "ball_release"] as const;
const PHASE_IMAGE_MAP: Record<string, string> = {
  set: "set.png",
  peak_leg_lift: "peak_leg_lift.png",
  foot_strike: "foot_strike.png",
  ball_release: "release.png",
};

export function MechanicsFilmRoom({ notes, basePath }: MechanicsFilmRoomProps) {
  const phases = notes.phases;
  const availablePhases = PHASE_ORDER.filter((pk) => PHASE_IMAGE_MAP[pk] && phases[pk]);

  const [activePhase, setActivePhase] = useState<string>(availablePhases[0] ?? "");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const goPrev = useCallback(() => {
    const i = (availablePhases as readonly string[]).indexOf(activePhase);
    if (i > 0) setActivePhase(availablePhases[i - 1]);
    else setActivePhase(availablePhases[availablePhases.length - 1]);
  }, [availablePhases, activePhase]);
  const goNext = useCallback(() => {
    const i = (availablePhases as readonly string[]).indexOf(activePhase);
    if (i < availablePhases.length - 1 && i >= 0) setActivePhase(availablePhases[i + 1]);
    else setActivePhase(availablePhases[0]);
  }, [availablePhases, activePhase]);

  useEffect(() => {
    if (availablePhases.length === 0) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goPrev, goNext, availablePhases.length]);

  if (availablePhases.length === 0) return null;

  const activeImg = `${basePath}/${PHASE_IMAGE_MAP[activePhase]}`;
  const activeTime = phases[activePhase]?.time_s;
  const videoUrl = `${basePath}/slowmo_review.mp4`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-5">Phase Frames</h2>

      {/* Large frame viewer */}
      <div
        className="relative w-full bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 cursor-zoom-in lg:min-h-[420px]"
        style={{ aspectRatio: "16/9" }}
        onClick={() => setLightboxOpen(true)}
      >
        <Image
          key={activeImg}
          src={activeImg}
          alt={phaseLabel(activePhase)}
          fill
          className="object-contain"
          sizes="(max-width: 1024px) 100vw, 896px"
          priority
        />

        {/* Bottom label */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-200 font-medium">
              {phaseLabel(activePhase)}
            </p>
            {activeTime != null && (
              <p className="text-[10px] font-mono text-zinc-500">{activeTime.toFixed(2)}s</p>
            )}
          </div>
          <span className="text-[9px] uppercase tracking-wider text-zinc-600">
            Click to zoom · ← → to change phase
          </span>
        </div>
      </div>

      {/* Phase selector chips */}
      <div className="flex flex-wrap gap-2 mt-4">
        {availablePhases.map((pk) => {
          const isActive = activePhase === pk;
          return (
            <button
              key={pk}
              onClick={() => setActivePhase(pk)}
              className={[
                "text-[10px] uppercase tracking-wider rounded-lg px-3 py-2 border transition-all",
                isActive
                  ? "bg-zinc-700 border-zinc-600 text-zinc-100"
                  : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200",
              ].join(" ")}
            >
              {phaseLabel(pk)}
              <span className="ml-1.5 font-mono text-zinc-600">
                {phases[pk].time_s.toFixed(2)}s
              </span>
            </button>
          );
        })}
      </div>

      {/* Slowmo link */}
      <div className="mt-3">
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-smooth inline-flex items-center gap-1"
        >
          <span>↗</span>
          <span>Open slowmo video</span>
        </a>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative w-full max-w-5xl"
            style={{ aspectRatio: "16/9" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={activeImg}
              alt={phaseLabel(activePhase)}
              fill
              className="object-contain rounded-lg"
              sizes="100vw"
            />
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-3 right-3 bg-zinc-900/80 border border-zinc-700 text-zinc-300 hover:text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-smooth"
            >
              ✕
            </button>
            <div className="absolute bottom-3 left-4">
              <p className="text-sm uppercase tracking-wider text-zinc-300 font-medium">
                {phaseLabel(activePhase)}
              </p>
              {activeTime != null && (
                <p className="text-xs font-mono text-zinc-500">{activeTime.toFixed(2)}s</p>
              )}
            </div>
          </div>

          {/* Phase navigation in lightbox */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {availablePhases.map((pk) => (
              <button
                key={pk}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePhase(pk);
                }}
                className={[
                  "text-[9px] uppercase tracking-wider rounded px-2.5 py-1.5 border transition-all",
                  pk === activePhase
                    ? "bg-zinc-700 border-zinc-600 text-zinc-100"
                    : "bg-zinc-900/80 border-zinc-700 text-zinc-500 hover:text-zinc-300",
                ].join(" ")}
              >
                {phaseLabel(pk)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
