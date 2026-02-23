"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ExternalLink, Loader2 } from "lucide-react";

interface Clip {
  playId: string;
  date: string;
  velo: string;
  pitchTypeAbbrev: string;
}

interface VideoClipsModalProps {
  pitcherId: string;
  pitcherName: string;
  pitchType: string; // Canonical name e.g. "Curveball"
  year?: number;
  onClose: () => void;
}

export default function VideoClipsModal({
  pitcherId,
  pitcherName,
  pitchType,
  year = 2025,
  onClose,
}: VideoClipsModalProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      pitcherId,
      pitchType,
      year: String(year),
      n: "4",
    });

    fetch(`/api/savant-clips?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setClips(data.clips ?? []);
        setFallbackUrl(data.fallbackUrl ?? null);
        if (data.error) setError(data.error);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [pitcherId, pitchType, year]);

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

  const sportyUrl = (playId: string) =>
    `https://baseballsavant.mlb.com/sporty-videos?playId=${playId}`;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-5 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              {pitcherName} — {pitchType}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {year} pitch clips from Baseball Savant
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
              <p className="text-zinc-500 text-sm">
                Loading clips from Savant...
              </p>
            </div>
          )}

          {!loading && clips.length === 0 && (
            <div className="text-center py-12">
              <p className="text-zinc-400 text-sm mb-3">
                {error
                  ? "Could not load video clips."
                  : `No ${pitchType} clips found for ${year}.`}
              </p>
              {fallbackUrl && (
                <a
                  href={fallbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View on Savant <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {!loading && clips.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {clips.map((clip) => (
                  <div
                    key={clip.playId}
                    className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg overflow-hidden"
                  >
                    {/* Video iframe */}
                    <div className="relative aspect-video bg-black">
                      <iframe
                        src={sportyUrl(clip.playId)}
                        className="absolute inset-0 w-full h-full"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        loading="lazy"
                        title={`${pitcherName} ${pitchType} - ${clip.date}`}
                      />
                    </div>
                    {/* Clip info */}
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[11px] font-mono text-zinc-400">
                        {clip.date}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-zinc-500">
                          {clip.velo} mph
                        </span>
                        <a
                          href={sportyUrl(clip.playId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-zinc-300 transition-colors"
                          title="Open in Savant"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Savant link */}
              {fallbackUrl && (
                <div className="mt-4 text-center">
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    View full profile on Savant{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
