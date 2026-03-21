"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardList,
  Film,
  Sparkles,
  Target,
  Trophy,
  Users,
  Menu,
  X,
} from "lucide-react";
import { NavBar, type TubelightNavItem } from "@/components/ui/tubelight-navbar";

function isDictionaryRoute(pathname: string): boolean {
  return (
    pathname === "/dictionary" ||
    pathname === "/pitching-plus" ||
    pathname === "/command/faq" ||
    pathname === "/trackman/faq" ||
    pathname === "/team-stats/faq" ||
    pathname === "/players/faq" ||
    pathname === "/mechanics/faq"
  );
}

function isLeaderboardRoute(pathname: string): boolean {
  return (
    pathname === "/leaderboards-hub" ||
    pathname === "/leaderboards" ||
    pathname === "/command/leaderboard" ||
    pathname === "/trackman/leaderboard" ||
    pathname === "/trackman/leaderboards" ||
    pathname.startsWith("/trackman/leaderboards/") ||
    pathname === "/team-stats" ||
    pathname === "/team-stats/leaderboard"
  );
}

function defaultMatch(pathname: string, url: string): boolean {
  if (url === "/") return pathname === "/";
  return pathname === url || pathname.startsWith(`${url}/`);
}

const NAV_ITEMS: TubelightNavItem[] = [
  { name: "Home", url: "/", match: (pathname) => pathname === "/", section: "primary" },
  { name: "Players", url: "/players", icon: Users, section: "primary" },
  {
    name: "Statistics",
    url: "/team-stats/leaderboard",
    icon: BarChart3,
    match: (pathname) => pathname === "/team-stats/leaderboard" || pathname === "/team-stats",
    section: "tracking",
  },
  {
    name: "Charting",
    url: "/charting",
    icon: ClipboardList,
    match: (pathname) =>
      pathname === "/charting" ||
      pathname === "/charting/leaderboard" ||
      pathname === "/charting/faq" ||
      pathname.startsWith("/charting/insights") ||
      pathname.startsWith("/charting/games/") ||
      pathname === "/charting/new",
    section: "tracking",
  },
  {
    name: "Pitching+",
    url: "/pitching-plus/leaderboard",
    icon: Sparkles,
    match: (pathname) => pathname === "/pitching-plus/leaderboard",
    section: "tracking",
  },
  {
    name: "Trackman",
    url: "/trackman",
    icon: Activity,
    match: (pathname) =>
      pathname === "/trackman" ||
      pathname.startsWith("/trackman/player/") ||
      pathname.startsWith("/trackman/session/"),
    section: "tracking",
  },
  {
    name: "Command",
    url: "/command",
    icon: Target,
    match: (pathname) => pathname === "/command",
    section: "tracking",
  },
  {
    name: "Mechanics",
    url: "/mechanics",
    icon: Film,
    match: (pathname) =>
      pathname === "/mechanics" ||
      pathname === "/mechanics-login" ||
      pathname.startsWith("/mechanics/player/") ||
      pathname.startsWith("/mechanics/session/"),
    section: "tracking",
  },
  {
    name: "Leaderboards",
    url: "/leaderboards-hub",
    icon: Trophy,
    match: isLeaderboardRoute,
    section: "tools",
  },
  {
    name: "Metrics Dictionary",
    url: "/dictionary",
    icon: BookOpen,
    match: isDictionaryRoute,
    section: "tools",
  },
];

function isChartingEditorRoute(pathname: string | null): boolean {
  return pathname != null && /^\/charting\/games\/[^/]+\/edit$/.test(pathname);
}

export default function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  if (isChartingEditorRoute(pathname)) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-zinc-800/70 bg-zinc-900/78 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-zinc-700 hover:bg-zinc-900"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Image
              src="/babson-logo.svg"
              alt="Babson College"
              width={22}
              height={22}
              className="h-[1.35rem] w-[1.35rem] shrink-0"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden min-w-0 flex-1 justify-center xl:flex">
            <NavBar items={NAV_ITEMS} />
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex xl:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-950/70 text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              aria-label="Open global navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm xl:hidden"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[70] flex w-[85vw] max-w-sm flex-col border-l border-zinc-800/80 bg-[linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,1))] shadow-2xl xl:hidden"
            >
              <div className="flex items-center justify-between border-b border-zinc-800/60 p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Navigation
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-6 scrollbar-hide">
                <nav className="flex flex-col gap-2.5">
                  {NAV_ITEMS.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = item.match
                      ? item.match(pathname)
                      : defaultMatch(pathname, item.url);

                    const previousItem = index > 0 ? NAV_ITEMS[index - 1] : null;
                    const startsNewSection =
                      previousItem != null &&
                      item.section != null &&
                      previousItem.section != null &&
                      item.section !== previousItem.section;

                    return (
                      <div key={item.name}>
                        {startsNewSection ? (
                          <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-zinc-800/70 to-transparent" />
                        ) : null}
                        <Link
                          href={item.url}
                          className={`group flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-300 ${
                            isActive
                              ? "border border-zinc-700/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_14px_28px_rgba(16,185,129,0.08)] bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(24,24,27,0.4)_52%,rgba(9,9,11,0.94))] text-zinc-100"
                              : "border border-transparent bg-transparent text-zinc-400 hover:border-zinc-800/80 hover:bg-zinc-900/50 hover:text-zinc-200"
                          }`}
                        >
                          {Icon && (
                            <Icon
                              className={`h-5 w-5 shrink-0 ${
                                isActive ? "text-zinc-300 drop-shadow-[0_0_10px_rgba(16,185,129,0.18)]" : "text-zinc-500 group-hover:text-zinc-400"
                              }`}
                            />
                          )}
                          <span className="text-[15px] font-semibold tracking-wide">
                            {item.name}
                          </span>
                        </Link>
                      </div>
                    );
                  })}
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
