"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Users, Activity, Target, Film, BarChart3 } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/players", label: "Players", icon: Users },
  { href: "/team-stats", label: "Statistics Leaderboard", icon: BarChart3 },
  { href: "/trackman", label: "Trackman Hub", icon: Activity },
  { href: "/command", label: "Command", icon: Target },
  { href: "/mechanics", label: "Mechanics", icon: Film },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-3 py-2.5 w-fit group transition-opacity hover:opacity-80 shrink-0"
        >
          <Image
            src="/babson-logo.svg"
            alt="Babson College"
            width={36}
            height={36}
            className="shrink-0"
            priority
          />
          <span className="text-sm sm:text-base font-semibold tracking-tight text-zinc-100 hidden sm:inline">
            Babson Baseball Pitching Portal
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-smooth whitespace-nowrap ${
                  active
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
