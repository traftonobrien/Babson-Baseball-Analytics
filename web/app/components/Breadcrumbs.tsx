"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteAppearance } from "@/app/components/SiteAppearanceContext";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
  className?: string;
  /** Light surfaces (metrics dictionaries, hubs) use slate; dark uses zinc. */
  variant?: "dark" | "light";
}

export default function Breadcrumbs({ items, className, variant = "dark" }: Props) {
  if (items.length === 0) return null;

  const isLight = variant === "light";
  const siteDark = useSiteAppearance() === "dark";
  const lightOnDark = isLight && siteDark;

  return (
    <nav
      className={cn(
        "mb-4 hidden items-center gap-1.5 text-sm md:flex",
        lightOnDark ? "text-slate-500 dark:text-zinc-400" : isLight ? "text-slate-500" : "text-zinc-500",
        className,
      )}
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5",
                lightOnDark ? "text-zinc-600" : isLight ? "text-slate-400" : "text-zinc-600",
              )}
            />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className={cn(
                "transition-smooth",
                lightOnDark ? "hover:text-slate-900 dark:hover:text-zinc-50" : isLight ? "hover:text-slate-900" : "hover:text-zinc-300",
              )}
            >
              {item.label}
            </Link>
          ) : (
            <span className={lightOnDark ? "text-slate-900 dark:text-zinc-50" : isLight ? "text-slate-700" : "text-zinc-300"}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
