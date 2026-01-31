"use client";

import { useEffect, useRef, useState } from "react";
import type { Pitch } from "../types";
import { overlayUrl, clipUrl } from "../utils";

interface Props {
  pitch: Pitch | null;
  overlayDir: string;
  clipsDir: string;
}

export default function VideoPlayer({ pitch, overlayDir, clipsDir }: Props) {
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
          {pitch.h_miss_inches.toFixed(1)}&quot; {pitch.h_direction},{" "}
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
