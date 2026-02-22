"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Play, Pause, RotateCcw } from "lucide-react";
import { phaseLabel } from "@/lib/mechanics/labels";
import type { NotesJson } from "@/lib/mechanics/types";

interface MechanicsFilmRoomProps {
  notes: NotesJson;
  basePath: string; // e.g. "/mechanics/trafton_obrien/trafton_mechanics_test"
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
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  function jumpTo(timeS: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = timeS;
    v.play();
    setIsPlaying(true);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }

  function restart() {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play();
    setIsPlaying(true);
  }

  const phases = notes.phases;

  return (
    <div className="max-w-5xl mx-auto px-6 py-2">
      <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-4">Film Room</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Video column */}
        <div>
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
            {/* Custom controls overlay */}
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
              <span className="ml-auto text-[9px] text-zinc-600 uppercase tracking-wider">Slowmo review</span>
            </div>
          </div>

          {/* Phase jump buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            {PHASE_ORDER.filter((pk) => phases[pk]).map((pk) => (
              <button
                key={pk}
                onClick={() => jumpTo(phases[pk].time_s)}
                className="text-[10px] uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white rounded-lg px-3 py-1.5 transition-colors"
              >
                → {phaseLabel(pk)}
                <span className="ml-1.5 text-zinc-600 font-mono">
                  {phases[pk].time_s.toFixed(2)}s
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Phase frames column */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Phase Frames</p>
          <div className="grid grid-cols-2 gap-2">
            {PHASE_ORDER.filter((pk) => PHASE_IMAGE_MAP[pk]).map((pk) => {
              const imgSrc = `${basePath}/${PHASE_IMAGE_MAP[pk]}`;
              const label = phaseLabel(pk);
              const timeS = phases[pk]?.time_s;
              return (
                <button
                  key={pk}
                  onClick={() => setLightboxImg(imgSrc)}
                  className="group relative rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-colors bg-zinc-900 aspect-video"
                  title={label}
                >
                  <Image
                    src={imgSrc}
                    alt={label}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-200"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-zinc-300">{label}</p>
                    {timeS != null && (
                      <p className="text-[8px] font-mono text-zinc-500">{timeS.toFixed(2)}s</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
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
