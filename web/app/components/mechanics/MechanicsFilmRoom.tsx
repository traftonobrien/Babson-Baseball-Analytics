"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Play, Pause, RotateCcw } from "lucide-react";
import { phaseLabel } from "@/lib/mechanics/labels";
import type { NotesJson } from "@/lib/mechanics/types";

interface MechanicsFilmRoomProps {
  notes: NotesJson;
  basePath: string;
}

const PHASE_ORDER = ["set", "peak_leg_lift", "foot_strike", "ball_release"];
const PHASE_IMAGE_MAP: Record<string, string> = {
  set: "set.png",
  peak_leg_lift: "peak_leg_lift.png",
  foot_strike: "foot_strike.png",
  ball_release: "release.png",
};

export function MechanicsFilmRoom({ notes, basePath }: MechanicsFilmRoomProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const phases = notes.phases;
  const availablePhases = PHASE_ORDER.filter((pk) => phases[pk]);

  const jumpTo = useCallback(
    (phaseKey: string) => {
      const v = videoRef.current;
      if (!v) return;
      const t = phases[phaseKey]?.time_s;
      if (t == null) return;
      v.currentTime = t;
      v.play();
      setIsPlaying(true);
      setActivePhase(phaseKey);
    },
    [phases],
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, []);

  const restart = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play();
    setIsPlaying(true);
    setActivePhase(null);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-5">Film Room</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
        {/* LEFT: Video + phase chips */}
        <div className="space-y-3">
          {/* Video player */}
          <div className="bg-black rounded-xl overflow-hidden border border-zinc-800 relative">
            <video
              ref={videoRef}
              src={`${basePath}/slowmo_review.mp4`}
              className="w-full block"
              loop
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-700 rounded-full p-2 text-zinc-200 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={restart}
                className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-700 rounded-full p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <span className="ml-auto text-[9px] text-zinc-600 uppercase tracking-wider">
                Slowmo review
              </span>
            </div>
          </div>

          {/* Phase chips */}
          <div className="flex flex-wrap gap-2">
            {availablePhases.map((pk) => {
              const isActive = activePhase === pk;
              return (
                <button
                  key={pk}
                  onClick={() => jumpTo(pk)}
                  className={[
                    "text-[10px] uppercase tracking-wider rounded-lg px-3 py-1.5 border transition-all",
                    isActive
                      ? "bg-zinc-700 border-zinc-600 text-zinc-100"
                      : "bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200",
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
        </div>

        {/* RIGHT: Phase thumbnail stack */}
        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">Phase Frames</p>
          {availablePhases.map((pk) => {
            const imgSrc = `${basePath}/${PHASE_IMAGE_MAP[pk] ?? pk + ".png"}`;
            const timeS = phases[pk]?.time_s;
            const isActive = activePhase === pk;

            return (
              <button
                key={pk}
                onClick={() => {
                  setLightboxImg(imgSrc);
                  setActivePhase(pk);
                }}
                className={[
                  "group relative w-full rounded-lg overflow-hidden border transition-all aspect-video",
                  isActive
                    ? "border-zinc-500 shadow-lg shadow-black/40"
                    : "border-zinc-800 hover:border-zinc-600",
                ].join(" ")}
              >
                <Image
                  src={imgSrc}
                  alt={phaseLabel(pk)}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                  sizes="220px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-zinc-300">
                    {phaseLabel(pk)}
                  </p>
                  {timeS != null && (
                    <p className="text-[8px] font-mono text-zinc-500">{timeS.toFixed(2)}s</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={lightboxImg}
              alt="Phase frame"
              width={1280}
              height={720}
              className="w-full rounded-lg"
              style={{ objectFit: "contain" }}
            />
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute top-3 right-3 bg-zinc-900/80 border border-zinc-700 text-zinc-300 hover:text-white rounded-full p-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
