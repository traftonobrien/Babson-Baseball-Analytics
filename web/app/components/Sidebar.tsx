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
  Leaf,
  Sparkles,
  Target,
  Trophy,
  Users,
  UserRound,
  type LucideIcon,
  LayoutDashboard,
  Menu,
  X,
  ShieldCheck,
  Settings,
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
  {
    name: "My Portal",
    url: "/account",
    icon: UserRound,
    match: (pathname) => pathname === "/account" || pathname.startsWith("/account/"),
    section: "primary",
  },
  {
    name: "Fall Hub",
    url: "/fall",
    icon: Leaf,
    match: (pathname) => pathname === "/fall" || pathname.startsWith("/fall/"),
    section: "primary",
  },
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

interface AccountInfo {
  email: string;
  playerName: string | null;
  role: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // undefined = loading, null = not logged in
  const [account, setAccount] = useState<AccountInfo | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/account/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { account?: AccountInfo | null } | null) => setAccount(data?.account ?? null))
      .catch(() => setAccount(null));
  }, []);

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

  const isAdmin = account?.role === "admin";

  const navLinkClass = (isActive: boolean) =>
    isActive
      ? "flex items-center gap-3 rounded-full bg-[var(--brand-primary-soft)] px-3 py-2.5 text-[13px] font-bold text-[var(--brand-primary-subtle-text)] transition-colors dark:border dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-[var(--brand-primary-spotlight)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
      : "group flex items-center gap-3 rounded-full px-3 py-2.5 text-[13px] font-semibold text-slate-500 transition-colors hover:bg-background hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900/80 dark:hover:text-zinc-100";

  const navIconClass = (isActive: boolean) =>
    isActive
      ? "h-5 w-5 text-[var(--brand-primary-subtle-text)] dark:text-[var(--brand-primary-spotlight)]"
      : "h-5 w-5 text-slate-400 transition-colors group-hover:text-slate-500 dark:text-zinc-500 dark:group-hover:text-zinc-400";

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
            <Link href={item.url} className={navLinkClass(isActive)}>
              <Icon className={navIconClass(isActive)} />
              {item.name}
            </Link>
          </div>
        );
      })}

      {/* Admin section — coach/admin role only */}
      {isAdmin && (
        <>
          <div className="my-2 h-px w-full bg-slate-100 dark:bg-zinc-800" />
          <div className="px-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500">
            Admin
          </div>
          <Link
            href="/admin/accounts"
            className={navLinkClass(pathname?.startsWith("/admin/") ?? false)}
          >
            <ShieldCheck className={navIconClass(pathname?.startsWith("/admin/") ?? false)} />
            Accounts
          </Link>
        </>
      )}
    </nav>
  );

  // Bottom-left account widget — replaces Start Session button
  const AccountFooterWidget = () => {
    if (account === undefined) {
      return <div className="h-11 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-800" />;
    }
    if (!account) {
      return (
        <Link
          href="/account/login"
          className="flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-surface px-4 py-2.5 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <UserRound className="h-4 w-4" />
          Log In
        </Link>
      );
    }
    const initials = account.playerName
      ? account.playerName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
      : account.email[0]?.toUpperCase() ?? "?";
    return (
      <Link
        href="/account"
        className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] font-black text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-slate-900 dark:text-zinc-100">
            {account.playerName ?? account.email}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">Settings</div>
        </div>
        <Settings className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
      </Link>
    );
  };

  // Profile / login button — shared between desktop + mobile
  const ProfileChip = ({ compact = false }: { compact?: boolean }) => {
    if (account === undefined) {
      // loading skeleton
      return <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100 dark:bg-zinc-800" />;
    }
    if (!account) {
      return (
        <Link
          href="/account/login"
          className={
            compact
              ? "flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-surface px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              : "flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-surface px-3 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          }
        >
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          Log in
        </Link>
      );
    }
    const initials = account.playerName
      ? account.playerName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
      : account.email[0]?.toUpperCase() ?? "?";
    return (
      <Link
        href="/account"
        title={account.playerName ?? account.email}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] font-black text-white shadow-[0_2px_8px_rgba(var(--brand-primary-rgb),0.35)] transition-opacity hover:opacity-80"
      >
        {initials}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile top bar */}
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
        {/* Desktop header */}
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
          <AccountFooterWidget />
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
                <AccountFooterWidget />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
