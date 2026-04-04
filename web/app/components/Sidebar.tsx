"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardList,
  Eye,
  Film,
  Upload,
  Sparkles,
  Target,
  Trophy,
  Users,
  type LucideIcon,
  LayoutDashboard,
  Menu,
  X
} from "lucide-react";
import { TEAM_NAME } from "@/lib/teamConfig";
import SiteAppearanceToggle from "./SiteAppearanceToggle";

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

interface NavItem {
  name: string;
  url: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", url: "/", icon: LayoutDashboard, match: (pathname) => pathname === "/", section: "primary" },
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
      pathname.startsWith("/charting/games/") ||
      pathname === "/charting/new",
    section: "tracking",
  },
  {
    name: "Player Insights",
    url: "/charting/insights",
    icon: Eye,
    match: (pathname) => pathname === "/charting/insights" || pathname.startsWith("/charting/insights/"),
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

function shouldHideSidebar(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  return (
    pathname === "/login" ||
    pathname === "/mechanics-login" ||
    /^\/charting\/games\/[^/]+\/edit$/.test(pathname)
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  if (shouldHideSidebar(pathname)) {
    return null;
  }

  const renderNavLinks = () => (
    <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-3">
      <div className="mt-4 px-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500">
        Main Menu
      </div>
      {NAV_ITEMS.map((item, index) => {
        const isActive = item.match ? item.match(pathname || "") : defaultMatch(pathname || "", item.url);
        const Icon = item.icon;

        const previousItem = index > 0 ? NAV_ITEMS[index - 1] : null;
        const startsNewSection = previousItem != null && item.section !== previousItem.section;

        return (
          <div key={item.name} className="flex flex-col gap-1.5">
            {startsNewSection && (
              <div className="my-2 h-px w-full bg-slate-100 dark:bg-zinc-800" />
            )}
            <Link
              href={item.url}
              className={
                isActive
                  ? "flex items-center gap-3 rounded-full bg-[var(--brand-primary-soft)] px-3 py-2.5 text-[13px] font-bold text-[var(--brand-primary-subtle-text)] transition-colors dark:border dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-[var(--brand-primary-spotlight)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
                  : "group flex items-center gap-3 rounded-full px-3 py-2.5 text-[13px] font-semibold text-slate-500 transition-colors hover:bg-background hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900/80 dark:hover:text-zinc-100"
              }
            >
              <Icon
                className={
                  isActive
                    ? "h-5 w-5 text-[var(--brand-primary-subtle-text)] dark:text-[var(--brand-primary-spotlight)]"
                    : "h-5 w-5 text-slate-400 transition-colors group-hover:text-slate-500 dark:text-zinc-500 dark:group-hover:text-zinc-400"
                }
              />
              {item.name}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="font-display sticky top-0 z-40 flex w-full shrink-0 items-center justify-between border-b border-slate-100 bg-surface px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950 print:hidden xl:hidden">
        <Link href="/" className="flex items-center gap-3">
          <div>
            <span className="block text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {TEAM_NAME} Baseball
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
              Analytics Portal
            </span>
          </div>
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-background hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <aside className="font-display hidden h-screen w-[240px] shrink-0 border-r border-slate-100 bg-surface dark:border-zinc-800 dark:bg-zinc-950 print:hidden xl:sticky xl:top-0 xl:flex xl:flex-col">
        <div className="px-6 pb-4 pt-6">
          <Link href="/" className="flex items-center gap-3">
            <div>
              <h1 className="text-[17px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-zinc-100">
                {TEAM_NAME} Baseball
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                Analytics Portal
              </p>
            </div>
          </Link>
        </div>

        {renderNavLinks()}

        <div className="border-t border-slate-100 p-4 dark:border-zinc-800">
          <div className="mb-3">
            <SiteAppearanceToggle />
          </div>
          <Link
            href="/charting/new"
            className="flex items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_12px_28px_rgba(var(--brand-primary-rgb),0.18)] transition-all duration-300 hover:bg-[var(--brand-primary-hover)]"
          >
            <Upload className="h-4 w-4" />
            Start Session
          </Link>
        </div>
      </aside>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-[#0F172A]/40 backdrop-blur-sm xl:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="font-display fixed inset-y-0 right-0 z-[70] flex w-[85vw] max-w-sm flex-col border-l border-slate-100 bg-surface shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 xl:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-zinc-800">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                  Navigation
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 bg-background text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderNavLinks()}
              </div>
              <div className="border-t border-slate-100 p-4 dark:border-zinc-800">
                <div className="mb-3">
                  <SiteAppearanceToggle />
                </div>
                <Link
                  href="/charting/new"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_12px_28px_rgba(var(--brand-primary-rgb),0.18)] transition-all duration-300 hover:bg-[var(--brand-primary-hover)]"
                >
                  <Upload className="h-4 w-4" />
                  Start Session
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
