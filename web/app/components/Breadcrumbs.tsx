"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <nav
      className={cn(
        "mb-4 hidden items-center gap-1.5 text-sm md:flex",
        isLight ? "text-slate-500 dark:text-zinc-400" : "text-zinc-500",
        className,
      )}
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5",
                isLight ? "text-slate-400 dark:text-zinc-600" : "text-zinc-600",
              )}
            />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className={cn(
                "transition-smooth",
                isLight ? "hover:text-slate-900 dark:hover:text-zinc-50" : "hover:text-zinc-300",
              )}
            >
              {item.label}
            </Link>
          ) : (
            <span className={isLight ? "text-slate-700 dark:text-zinc-50" : "text-zinc-300"}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
