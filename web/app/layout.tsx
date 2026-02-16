import { Analytics } from "@vercel/analytics/react";

import type { Metadata } from "next";
import "./globals.css";
import DebugInit from "./components/DebugInit";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "Babson Baseball Pitching Portal",
  description: "Pitch tracking film room",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <DebugInit />
        <Header />
        {children}

        {/* 👇 THIS is what turns analytics on */}
        <Analytics />
      </body>
    </html>
  );
}