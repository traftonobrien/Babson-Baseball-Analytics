import { Analytics } from "@vercel/analytics/react";

import type { Metadata } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import DebugInit from "./components/DebugInit";
import Sidebar from "./components/Sidebar";
import PageTransition from "./components/PageTransition";
import Providers from "./components/Providers";
import { TEAM_NAME } from "@/lib/teamConfig";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${manrope.variable}`}>
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased">
        <Providers>
          <DebugInit />
          <div className="flex min-h-screen w-full flex-col bg-[#F8FAFC] xl:flex-row xl:items-start">
            <Sidebar />
            <div className="min-w-0 flex-1 bg-[#F8FAFC]">
              <PageTransition>{children}</PageTransition>
            </div>
          </div>
        </Providers>

        <Analytics />
      </body>
    </html>
  );
}
