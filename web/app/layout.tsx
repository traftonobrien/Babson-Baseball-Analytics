import type { Metadata } from "next";
import "./globals.css";
import DebugInit from "./components/DebugInit";

export const metadata: Metadata = {
  title: "Pitch Tracker",
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
        {children}
      </body>
    </html>
  );
}
