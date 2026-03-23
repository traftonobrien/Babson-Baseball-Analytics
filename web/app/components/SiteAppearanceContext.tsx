"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const SITE_APPEARANCE_STORAGE_KEY = "pitch-tracker-site-appearance";
const LEGACY_TRACKMAN_KEY = "pitch-tracker-trackman-player-appearance";

export type SiteAppearance = "light" | "dark";

type Ctx = {
  appearance: SiteAppearance;
  setAppearance: (a: SiteAppearance) => void;
  toggleAppearance: () => void;
};

const SiteAppearanceContext = createContext<Ctx | null>(null);

function readStoredAppearance(): SiteAppearance {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(SITE_APPEARANCE_STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
    const legacy = window.localStorage.getItem(LEGACY_TRACKMAN_KEY);
    if (legacy === "dark" || legacy === "light") {
      window.localStorage.setItem(SITE_APPEARANCE_STORAGE_KEY, legacy);
      return legacy;
    }
  } catch {
    /* noop */
  }
  return "light";
}

export function SiteAppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<SiteAppearance>("light");

  useEffect(() => {
    setAppearanceState(readStoredAppearance());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-site-appearance", appearance);
    root.classList.toggle("dark", appearance === "dark");
  }, [appearance]);

  const setAppearance = useCallback((a: SiteAppearance) => {
    setAppearanceState(a);
    try {
      localStorage.setItem(SITE_APPEARANCE_STORAGE_KEY, a);
    } catch {
      /* noop */
    }
  }, []);

  const toggleAppearance = useCallback(() => {
    setAppearanceState((prev) => {
      const next: SiteAppearance = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(SITE_APPEARANCE_STORAGE_KEY, next);
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ appearance, setAppearance, toggleAppearance }),
    [appearance, setAppearance, toggleAppearance],
  );

  return (
    <SiteAppearanceContext.Provider value={value}>
      {children}
    </SiteAppearanceContext.Provider>
  );
}

export function useSiteAppearance(): SiteAppearance {
  const ctx = useContext(SiteAppearanceContext);
  return ctx?.appearance ?? "light";
}

export function useSiteAppearanceControls(): Ctx | null {
  return useContext(SiteAppearanceContext);
}
