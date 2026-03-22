"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
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

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

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
      <div className="mt-4 px-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">
        Main Menu
      </div>
      {NAV_ITEMS.map((item, index) => {
        const isActive = item.match ? item.match(pathname || "") : defaultMatch(pathname || "", item.url);
        const Icon = item.icon;

        const previousItem = index > 0 ? NAV_ITEMS[index - 1] : null;
        const startsNewSection = previousItem != null && item.section !== previousItem.section;

        return (
          <div key={item.name} className="flex flex-col gap-1.5">
            {startsNewSection && <div className="my-2 w-full h-px bg-[#F1F5F9]" />}
            <Link
              href={item.url}
              className={
                isActive
                  ? "flex items-center gap-3 rounded-full bg-[var(--brand-primary-soft)] px-3 py-2.5 text-[13px] font-bold text-[var(--brand-primary-subtle-text)] transition-colors"
                  : "group flex items-center gap-3 rounded-full px-3 py-2.5 text-[13px] font-semibold text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
              }
            >
              <Icon
                className={
                  isActive
                    ? "h-5 w-5 text-[var(--brand-primary-subtle-text)]"
                  : "w-5 h-5 text-[#94A3B8] group-hover:text-[#64748B] transition-colors"
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
      <div className={`sticky top-0 z-40 flex w-full shrink-0 items-center justify-between border-b border-[#F1F5F9] bg-white px-4 py-4 xl:hidden ${plusJakarta.className}`}>
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-primary)]">
            <Image
              src="/babson-logo.svg"
              alt={`${TEAM_NAME} logo`}
              width={20}
              height={20}
              className="h-auto w-auto max-h-full max-w-full filter brightness-0 invert"
              priority
            />
          </div>
          <div>
            <span className="block text-lg font-bold tracking-tight text-[#0F172A]">{TEAM_NAME}</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">Pitch Tracker</span>
          </div>
        </Link>
        <button onClick={() => setIsMobileMenuOpen(true)} className="rounded-xl p-2 text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <aside className={`hidden h-screen w-[240px] shrink-0 border-r border-[#F1F5F9] bg-white xl:sticky xl:top-0 xl:flex xl:flex-col ${plusJakarta.className}`}>
        <div className="px-6 pb-4 pt-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-primary)]">
              <Image
                src="/babson-logo.svg"
                alt={`${TEAM_NAME} logo`}
                width={20}
                height={20}
                className="h-auto w-auto max-h-full max-w-full filter brightness-0 invert"
                priority
              />
            </div>
            <div>
              <h1 className="text-[17px] font-extrabold leading-tight tracking-tight text-[#0F172A]">{TEAM_NAME}</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">Pitch Tracker</p>
            </div>
          </Link>
        </div>

        {renderNavLinks()}

        <div className="border-t border-[#F1F5F9] p-4">
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
              className={`fixed inset-y-0 right-0 z-[70] flex w-[85vw] max-w-sm flex-col border-l border-[#F1F5F9] bg-white shadow-2xl xl:hidden ${plusJakarta.className}`}
            >
              <div className="flex items-center justify-between border-b border-[#F1F5F9] p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
                  Navigation
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8FAFC] border border-[#F1F5F9] text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderNavLinks()}
              </div>
              <div className="border-t border-[#F1F5F9] p-4">
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
