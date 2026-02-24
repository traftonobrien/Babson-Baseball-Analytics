"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import playersJson from "@/data/players.json";

const LS_KEY = "pt_selected_player";

const validSlugs = new Set(
  (playersJson as { slug: string }[]).map((p) => p.slug),
);

const nameBySlug: Record<string, string> = Object.fromEntries(
  (playersJson as { slug: string; name: string }[]).map((p) => [p.slug, p.name]),
);

interface SelectedPlayerContextValue {
  slug: string | null;
  name: string | null;
  setSelectedPlayer: (slug: string | null) => void;
}

const SelectedPlayerContext = createContext<SelectedPlayerContextValue>({
  slug: null,
  name: null,
  setSelectedPlayer: () => {},
});

export function SelectedPlayerProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored && validSlugs.has(stored)) {
        setSlug(stored);
      } else if (stored) {
        localStorage.removeItem(LS_KEY);
      }
    } catch {
      /* SSR or localStorage unavailable */
    }
  }, []);

  const setSelectedPlayer = useCallback((newSlug: string | null) => {
    if (newSlug && !validSlugs.has(newSlug)) return;
    setSlug(newSlug);
    try {
      if (newSlug) {
        localStorage.setItem(LS_KEY, newSlug);
      } else {
        localStorage.removeItem(LS_KEY);
      }
    } catch {
      /* noop */
    }
  }, []);

  const name = slug ? nameBySlug[slug] ?? null : null;

  return (
    <SelectedPlayerContext.Provider value={{ slug, name, setSelectedPlayer }}>
      {children}
    </SelectedPlayerContext.Provider>
  );
}

export function useSelectedPlayer() {
  return useContext(SelectedPlayerContext);
}

export { validSlugs, nameBySlug };
