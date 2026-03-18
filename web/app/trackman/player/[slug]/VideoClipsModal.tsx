"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ExternalLink, Loader2 } from "lucide-react";

interface ClipData {
  mp4Url: string;
  playId: string;
  date: string;
  velo: string;
  pitchTypeAbbrev: string;
}

interface VideoClipsModalProps {
  pitcherId: string;
  pitcherName: string;
  pitchType: string;
  pitchTypeCode?: string | null;
  pitchLabel?: string | null;
  year?: number;
  onClose: () => void;
}

export default function VideoClipsModal({
  pitcherId,
  pitcherName,
  pitchType,
  pitchTypeCode,
  pitchLabel,
  year = 2025,
  onClose,
}: VideoClipsModalProps) {
  const [clip, setClip] = useState<ClipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [noClip, setNoClip] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      pitcherId,
      pitchType,
      year: String(year),
    });
    if (pitchTypeCode) params.set("pitchTypeCode", pitchTypeCode);

    fetch(`/api/savant-clips?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setClip(data.clip ?? null);
        setFallbackUrl(data.fallbackUrl ?? null);
        if (!data.clip) setNoClip(true);
        setLoading(false);
      })
      .catch(() => {
        setNoClip(true);
        setLoading(false);
      });
  }, [pitcherId, pitchType, pitchTypeCode, year]);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [handleEscape]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              {pitcherName}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {pitchLabel ?? pitchType} · {year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video area */}
        <div className="bg-black">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
              <p className="text-zinc-500 text-xs">Finding clip...</p>
            </div>
          )}

          {!loading && noClip && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-zinc-400 text-sm">
                No strike clip found for {year}.
              </p>
              {fallbackUrl && (
                <a
                  href={fallbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                >
                  View on Savant <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {!loading && clip && (
            <video
              src={clip.mp4Url}
              autoPlay
              muted
              loop
              playsInline
              controls
              className="w-full aspect-video object-contain"
            />
          )}
        </div>

        {/* Footer info */}
        {!loading && clip && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-zinc-400">
                {clip.date}
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                {clip.velo} mph
              </span>
            </div>
            <a
              href={`https://baseballsavant.mlb.com/sporty-videos?playId=${clip.playId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Savant <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
