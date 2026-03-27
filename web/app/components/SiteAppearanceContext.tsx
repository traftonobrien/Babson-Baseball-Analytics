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
const SITE_APPEARANCE_COOKIE_KEY = "pitch-tracker-site-appearance";
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
  try {
    const match = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${SITE_APPEARANCE_COOKIE_KEY}=`))
      ?.split("=")[1];
    if (match === "dark" || match === "light") return match;
  } catch {
    /* noop */
  }
  return "light";
}

function persistAppearance(next: SiteAppearance) {
  try {
    localStorage.setItem(SITE_APPEARANCE_STORAGE_KEY, next);
  } catch {
    /* noop */
  }
  try {
    document.cookie = `${SITE_APPEARANCE_COOKIE_KEY}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* noop */
  }
}

export function SiteAppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<SiteAppearance>(() => readStoredAppearance());

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-site-appearance", appearance);
    root.classList.toggle("dark", appearance === "dark");
  }, [appearance]);

  const setAppearance = useCallback((a: SiteAppearance) => {
    setAppearanceState(a);
    persistAppearance(a);
  }, []);

  const toggleAppearance = useCallback(() => {
    setAppearanceState((prev) => {
      const next: SiteAppearance = prev === "light" ? "dark" : "light";
      persistAppearance(next);
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

export function useHydratedSiteAppearance(): SiteAppearance {
  const appearance = useSiteAppearance();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? appearance : "light";
}
