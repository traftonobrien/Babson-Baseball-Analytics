"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Users,
  Activity,
  Target,
  Film,
  BarChart3,
  Sparkles,
  BookOpen,
  Trophy,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon?: typeof Users;
};

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/players", label: "Players", icon: Users },
];

const TRACKING_NAV_ITEMS: NavItem[] = [
  { href: "/pitching-plus/leaderboard", label: "Pitching+", icon: Sparkles },
  { href: "/team-stats/leaderboard", label: "Statistics", icon: BarChart3 },
  { href: "/trackman", label: "Trackman", icon: Activity },
  { href: "/command", label: "Command", icon: Target },
  { href: "/mechanics", label: "Mechanics", icon: Film },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function isDictionaryRoute(pathname: string): boolean {
  return (
    pathname === "/dictionary" ||
    pathname === "/command/faq" ||
    pathname === "/trackman/faq" ||
    pathname === "/team-stats/faq"
  );
}

function isLeaderboardRoute(pathname: string): boolean {
  return (
    pathname === "/leaderboards-hub" ||
    pathname === "/leaderboards" ||
    pathname === "/command/leaderboard" ||
    pathname === "/pitching-plus/leaderboard" ||
    pathname === "/trackman/leaderboard" ||
    pathname === "/trackman/leaderboards" ||
    pathname.startsWith("/trackman/leaderboards/") ||
    pathname === "/team-stats" ||
    pathname === "/team-stats/leaderboard"
  );
}

function NavCluster({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <span className="hidden 2xl:inline px-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </span>
      {items.map(({ href, label: itemLabel, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-smooth whitespace-nowrap shrink-0 ${
              active
                ? "border-zinc-700 bg-zinc-900 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                : "border-transparent bg-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
            }`}
          >
            {Icon ? <Icon className="w-3.5 h-3.5 shrink-0" /> : null}
            {itemLabel}
          </Link>
        );
      })}
    </div>
  );
}

export default function Header() {
  const pathname = usePathname();
  const dictionaryActive = isDictionaryRoute(pathname);
  const leaderboardActive = isLeaderboardRoute(pathname);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 sm:px-6">
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

        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden py-2 scrollbar-hide">
          <div className="flex min-w-max items-center gap-2.5">
            <NavCluster label="Navigate" items={PRIMARY_NAV_ITEMS} pathname={pathname} />
            <NavCluster label="Tracking" items={TRACKING_NAV_ITEMS} pathname={pathname} />
            <div className="flex items-center gap-1 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <span className="hidden 2xl:inline px-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Tools
              </span>
              <Link
                href="/leaderboards-hub"
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-smooth whitespace-nowrap shrink-0 ${
                  leaderboardActive
                    ? "border-orange-500/45 bg-orange-500/12 text-orange-300"
                    : "border-transparent bg-transparent text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                Leaderboards
              </Link>
              <Link
                href="/dictionary"
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-smooth whitespace-nowrap shrink-0 ${
                  dictionaryActive
                    ? "border-blue-500/45 bg-blue-500/12 text-blue-300"
                    : "border-transparent bg-transparent text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                Dictionary
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
