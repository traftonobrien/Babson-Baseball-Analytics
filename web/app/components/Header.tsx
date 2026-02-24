"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Users,
  Activity,
  Target,
  Film,
  BarChart3,
  ChevronDown,
  UserCircle,
  X,
} from "lucide-react";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { getCanonicalName } from "@/lib/canonicalPlayers";
import playersJson from "@/data/players.json";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/players", label: "Players", icon: Users },
  { href: "/team-stats", label: "Statistics Leaderboard", icon: BarChart3 },
  { href: "/trackman", label: "Trackman", icon: Activity },
  { href: "/command", label: "Command", icon: Target },
  { href: "/mechanics", label: "Mechanics", icon: Film },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

const PLAYER_LIST = (playersJson as { slug: string; name: string }[])
  .map((p) => ({ slug: p.slug, name: getCanonicalName(p.name) }))
  .sort((a, b) => a.name.localeCompare(b.name));

function PlayerPicker() {
  const { slug, name, setSelectedPlayer } = useSelectedPlayer();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filtered = search.trim()
    ? PLAYER_LIST.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      )
    : PLAYER_LIST;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-smooth whitespace-nowrap border ${
          slug
            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
        }`}
      >
        <UserCircle className="w-3.5 h-3.5 shrink-0" />
        {slug ? name ?? "Player" : "I am..."}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-[60] overflow-hidden">
          <div className="p-2 border-b border-zinc-800">
            <input
              type="text"
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {slug && (
              <button
                onClick={() => {
                  setSelectedPlayer(null);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear selection
              </button>
            )}
            {filtered.map((p) => (
              <button
                key={p.slug}
                onClick={() => {
                  setSelectedPlayer(p.slug);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  p.slug === slug
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                {p.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-600">No players found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
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

        <div className="flex items-center gap-2">
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
          <div className="w-px h-5 bg-zinc-700/50 shrink-0" />
          <PlayerPicker />
        </div>
      </div>
    </header>
  );
}
