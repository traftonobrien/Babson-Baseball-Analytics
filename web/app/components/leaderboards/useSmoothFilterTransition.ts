"use client";

import { useCallback, useState, useTransition, type CSSProperties } from "react";

const DEFAULT_DURATION_MS = 350;

export function useSmoothFilterTransition(durationMs: number = DEFAULT_DURATION_MS) {
  const [transitionKey, setTransitionKey] = useState(0);
  const [, startTransition] = useTransition();
  const contentTransitionClassName = "";

  const getRowTransitionProps = useCallback(
    (index: number): { className: string; style: CSSProperties } => ({
      className: "leaderboard-row-reveal",
      style: {
        animationDuration: `${durationMs}ms`,
        animationDelay: `${Math.min(index, 10) * 40}ms`,
      },
    }),
    [durationMs],
  );

  const runWithTransition = useCallback(
    (apply: () => void) => {
      startTransition(() => {
        apply();
        setTransitionKey((current) => current + 1);
      });
    },
    [startTransition],
  );

  return {
    contentTransitionClassName,
    getRowTransitionProps,
    runWithTransition,
    transitionKey,
  };
}
