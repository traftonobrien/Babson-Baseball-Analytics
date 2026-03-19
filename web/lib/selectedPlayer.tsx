"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from "react";

const LS_KEY = "pt_selected_player";

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
  const [slug, setSlug] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_KEY) ?? null;
    } catch {
      return null;
    }
  });

  const setSelectedPlayer = useCallback((newSlug: string | null) => {
    setSlug(newSlug);
    try {
      if (newSlug) {
        localStorage.setItem(LS_KEY, newSlug);
      } else {
        localStorage.removeItem(LS_KEY);
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  return (
    <SelectedPlayerContext.Provider value={{ slug, name: null, setSelectedPlayer }}>
      {children}
    </SelectedPlayerContext.Provider>
  );
}

export function useSelectedPlayer() {
  return useContext(SelectedPlayerContext);
}
