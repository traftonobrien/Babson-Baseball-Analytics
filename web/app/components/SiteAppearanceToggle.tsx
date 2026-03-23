"use client";

import { Moon, Sun } from "lucide-react";
import { useSiteAppearanceControls } from "./SiteAppearanceContext";

export default function SiteAppearanceToggle() {
  const ctx = useSiteAppearanceControls();
  if (!ctx) return null;

  const { appearance, setAppearance } = ctx;
  const isLight = appearance === "light";

  return (
    <div
      className={
        isLight
          ? "inline-flex w-full items-center justify-center gap-1 rounded-full border border-border bg-surface p-1 shadow-sm"
          : "inline-flex w-full items-center justify-center gap-1 rounded-full border border-zinc-700/80 bg-zinc-900/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      }
      role="group"
      aria-label="Site appearance"
    >
      <button
        type="button"
        onClick={() => setAppearance("light")}
        className={
          isLight
            ? "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-900 dark:text-zinc-50"
            : "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition-smooth hover:text-zinc-300"
        }
        aria-pressed={isLight}
      >
        <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Light
      </button>
      <button
        type="button"
        onClick={() => setAppearance("dark")}
        className={
          !isLight
            ? "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-zinc-800/90 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-100"
            : "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400 transition-smooth hover:text-slate-900 dark:hover:text-zinc-50"
        }
        aria-pressed={!isLight}
      >
        <Moon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Dark
      </button>
    </div>
  );
}
