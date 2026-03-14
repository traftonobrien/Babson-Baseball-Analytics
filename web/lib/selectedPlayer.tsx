"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
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
  useEffect(() => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* SSR or localStorage unavailable */
    }
  }, []);

  const setSelectedPlayer = useCallback((_newSlug: string | null) => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* noop */
    }
  }, []);

  return (
    <SelectedPlayerContext.Provider value={{ slug: null, name: null, setSelectedPlayer }}>
      {children}
    </SelectedPlayerContext.Provider>
  );
}

export function useSelectedPlayer() {
  return useContext(SelectedPlayerContext);
}
