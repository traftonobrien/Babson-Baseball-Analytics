"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    name: "Live AB",
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
  if (isChartingEditorRoute(pathname)) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/70 bg-zinc-900/78 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-zinc-700 hover:bg-zinc-900"
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

        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide">
          <NavBar items={NAV_ITEMS} className="min-w-max" />
        </div>
      </div>
    </header>
  );
}
