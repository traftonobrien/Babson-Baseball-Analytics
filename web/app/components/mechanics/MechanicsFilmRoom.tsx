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
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Film Room</h2>
        <p className="mt-1 text-xs text-zinc-600">Flip through the key frames and open the full slow-motion clip when needed.</p>
      </div>

      <div className="overflow-hidden rounded-[1.8rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(17,24,39,0.64),rgba(9,9,11,0.88))] p-4 shadow-[0_20px_56px_rgba(0,0,0,0.22)]">
        <div
          className="relative w-full cursor-zoom-in overflow-hidden rounded-[1.4rem] border border-zinc-800/80 bg-zinc-950 lg:min-h-[420px]"
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

          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-200">
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

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {availablePhases.map((pk) => {
              const isActive = activePhase === pk;
              return (
                <button
                  key={pk}
                  onClick={() => setActivePhase(pk)}
                  className={[
                    "rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all",
                    isActive
                      ? "border-violet-400/30 bg-violet-500/14 text-violet-200 shadow-[0_0_20px_rgba(139,92,246,0.12)]"
                      : "border-zinc-800/80 bg-zinc-950/75 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200",
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

          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/75 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 transition-smooth hover:border-zinc-700 hover:text-zinc-200"
          >
            <span>↗</span>
            <span>Open slowmo video</span>
          </a>
        </div>
      </div>

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
              className="object-contain rounded-[1.25rem]"
              sizes="100vw"
            />
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-sm text-zinc-300 transition-smooth hover:text-white"
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

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {availablePhases.map((pk) => (
              <button
                key={pk}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePhase(pk);
                }}
                className={[
                  "rounded-full border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] transition-all",
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
