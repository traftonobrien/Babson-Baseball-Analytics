import { Analytics } from "@vercel/analytics/next";

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import DebugInit from "./components/DebugInit";
import Sidebar from "./components/Sidebar";
import PageTransition from "./components/PageTransition";
import Providers from "./components/Providers";
import { getTeamConfig, TEAM_NAME } from "@/lib/teamConfig";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: `${TEAM_NAME} Baseball Pitching Portal`,
  description: "Pitch tracking film room",
};

const teamConfig = getTeamConfig();
const teamThemeStyle = {
  "--brand-primary": teamConfig.brand.primary,
  "--brand-primary-hover": teamConfig.brand.primaryHover,
  "--brand-primary-rgb": teamConfig.brand.primaryRgb,
  "--brand-primary-soft": teamConfig.brand.soft,
  "--brand-primary-soft-strong": teamConfig.brand.softStrong,
  "--brand-primary-surface": teamConfig.brand.surface,
  "--brand-primary-border": teamConfig.brand.border,
  "--brand-primary-subtle-text": teamConfig.brand.subtleText,
  "--brand-primary-spotlight": teamConfig.brand.spotlight,
  "--brand-primary-deep": teamConfig.brand.deep,
  "--brand-primary-deep-alt": teamConfig.brand.deepAlt,
} as CSSProperties & Record<string, string>;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-site-appearance="light"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${manrope.variable}`}
    >
      <head>
        <script
          id="site-appearance-bootstrap"
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var key="pitch-tracker-site-appearance";var legacy="pitch-tracker-trackman-player-appearance";var cookieKey="pitch-tracker-site-appearance";var getCookie=function(name){var entries=document.cookie?document.cookie.split("; "):[];for(var i=0;i<entries.length;i+=1){var parts=entries[i].split("=");if(parts[0]===name){return parts.slice(1).join("=");}}return null;};var stored=localStorage.getItem(key);if(stored!=="dark"&&stored!=="light"){stored=localStorage.getItem(legacy);if(stored==="dark"||stored==="light"){localStorage.setItem(key,stored);}}if(stored!=="dark"&&stored!=="light"){var cookieValue=getCookie(cookieKey);if(cookieValue==="dark"||cookieValue==="light"){stored=cookieValue;}}var appearance=(stored==="dark"||stored==="light")?stored:"light";var root=document.documentElement;root.setAttribute("data-site-appearance",appearance);root.classList.toggle("dark",appearance==="dark");}catch(e){}})();',
          }}
        />
      </head>
      <body
        className="min-h-screen bg-background text-slate-900 dark:text-zinc-50 antialiased"
        style={teamThemeStyle}
      >
        <Providers>
          <DebugInit />
          <div className="flex min-h-screen w-full flex-col bg-background xl:flex-row xl:items-start">
            <Sidebar />
            <div className="min-w-0 flex-1 bg-background">
              <PageTransition>{children}</PageTransition>
            </div>
          </div>
        </Providers>

        <Analytics />
      </body>
    </html>
  );
}
