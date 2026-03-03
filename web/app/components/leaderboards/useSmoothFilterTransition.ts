"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

const DEFAULT_DURATION_MS = 220;

export function useSmoothFilterTransition(durationMs: number = DEFAULT_DURATION_MS) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runWithTransition = useCallback(
    (apply: () => void) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsTransitioning(true);
      startTransition(() => {
        apply();
      });

      timeoutRef.current = setTimeout(() => {
        setIsTransitioning(false);
        timeoutRef.current = null;
      }, durationMs);
    },
    [durationMs, startTransition],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isTransitioning, runWithTransition };
}
