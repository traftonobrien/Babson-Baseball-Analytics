"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

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
  const setSelectedPlayer = (_newSlug: string | null) => {};

  return (
    <SelectedPlayerContext.Provider value={{ slug: null, name: null, setSelectedPlayer }}>
      {children}
    </SelectedPlayerContext.Provider>
  );
}

export function useSelectedPlayer() {
  return useContext(SelectedPlayerContext);
}
