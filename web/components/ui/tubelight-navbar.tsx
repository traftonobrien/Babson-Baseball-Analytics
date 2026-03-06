"use client";

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TubelightNavItem {
  name: string;
  url: string;
  icon?: LucideIcon;
  match?: (pathname: string) => boolean;
  section?: string;
}

interface NavBarProps {
  items: TubelightNavItem[];
  className?: string;
  variant?: "inline" | "floating";
}

const SECTION_DIVIDER_STYLE: CSSProperties = {
  background:
    "linear-gradient(to bottom, transparent, rgba(var(--babson-grey-rgb), 0.52), transparent)",
};

const ACTIVE_TAB_LINK_STYLE: CSSProperties = {
  borderColor: "rgba(var(--babson-grey-rgb), 0.34)",
  color: "rgba(248, 250, 252, 0.98)",
  boxShadow: "0 1px 0 rgba(255, 255, 255, 0.04)",
};

const ACTIVE_TAB_SURFACE_STYLE: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(var(--babson-green-rgb), 0.3), rgba(var(--babson-grey-rgb), 0.15) 52%, rgba(9, 9, 11, 0.94) 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px rgba(var(--babson-grey-rgb), 0.08), 0 14px 28px rgba(var(--babson-green-rgb), 0.18), 0 0 18px rgba(var(--babson-green-rgb), 0.12)",
};

const ACTIVE_ICON_STYLE: CSSProperties = {
  color: "rgba(var(--babson-grey-rgb), 0.96)",
  filter: "drop-shadow(0 0 10px rgba(var(--babson-green-rgb), 0.18))",
};

const ACTIVE_BEACON_STYLE: CSSProperties = {
  backgroundColor: "var(--babson-green)",
  boxShadow:
    "0 0 16px rgba(var(--babson-green-rgb), 0.34), 0 0 30px rgba(var(--babson-grey-rgb), 0.12)",
};

function defaultMatch(pathname: string, url: string): boolean {
  if (url === "/") return pathname === "/";
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function NavBar({
  items,
  className,
  variant = "inline",
}: NavBarProps) {
  const pathname = usePathname();
  const resolvedActive = useMemo(() => {
    const current = items.find((item) =>
      item.match ? item.match(pathname) : defaultMatch(pathname, item.url),
    );
    return current?.name ?? items[0]?.name ?? "";
  }, [items, pathname]);
  const [activeTab, setActiveTab] = useState(resolvedActive);

  useEffect(() => {
    setActiveTab(resolvedActive);
  }, [resolvedActive]);

  return (
    <div
      className={cn(
        variant === "floating"
          ? "fixed bottom-0 left-1/2 z-50 mb-6 -translate-x-1/2 sm:top-0 sm:mb-0 sm:pt-6"
          : "relative",
        className,
      )}
    >
      <div className="inline-flex min-w-max items-center gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/72 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-lg">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeTab === item.name;
          const previousItem = index > 0 ? items[index - 1] : null;
          const startsNewSection =
            previousItem != null &&
            item.section != null &&
            previousItem.section != null &&
            item.section !== previousItem.section;

          return (
            <Fragment key={item.name}>
              {startsNewSection ? (
                <span
                  aria-hidden="true"
                  className="mx-2 h-6 w-px shrink-0 rounded-full"
                  style={SECTION_DIVIDER_STYLE}
                />
              ) : null}
              <Link
                href={item.url}
                aria-label={item.name}
                onClick={() => setActiveTab(item.name)}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                  "text-zinc-400 hover:text-zinc-100",
                  isActive ? "border-zinc-700/80 text-zinc-100" : "border-transparent",
                )}
                style={isActive ? ACTIVE_TAB_LINK_STYLE : undefined}
              >
                {Icon ? (
                  <Icon
                    size={14}
                    strokeWidth={2.2}
                    className="relative z-10 shrink-0"
                    style={isActive ? ACTIVE_ICON_STYLE : undefined}
                  />
                ) : null}
                <span className="relative z-10">{item.name}</span>
                {isActive ? (
                  <motion.div
                    layoutId="tubelight-lamp"
                    className="absolute inset-0 -z-10 rounded-xl ring-1 ring-white/4"
                    initial={false}
                    style={ACTIVE_TAB_SURFACE_STYLE}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 28,
                    }}
                  >
                    <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />
                    <div className="absolute inset-y-2 left-2 w-10 rounded-lg opacity-80 blur-xl" style={ACTIVE_BEACON_STYLE} />
                    <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full" style={ACTIVE_BEACON_STYLE}>
                      <div
                        className="absolute -left-2 -top-2 h-6 w-12 rounded-full blur-md"
                        style={{ backgroundColor: "rgba(var(--babson-green-rgb), 0.2)" }}
                      />
                      <div
                        className="absolute -top-1 h-6 w-8 rounded-full blur-md"
                        style={{ backgroundColor: "rgba(var(--babson-grey-rgb), 0.16)" }}
                      />
                      <div
                        className="absolute left-2 top-0 h-4 w-4 rounded-full blur-sm"
                        style={{ backgroundColor: "rgba(var(--babson-grey-rgb), 0.18)" }}
                      />
                    </div>
                  </motion.div>
                ) : null}
              </Link>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
