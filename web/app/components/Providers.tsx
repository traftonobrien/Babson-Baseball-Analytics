"use client";

import { SelectedPlayerProvider } from "@/lib/selectedPlayer";
import type { ReactNode } from "react";
import { SiteAppearanceProvider } from "./SiteAppearanceContext";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SiteAppearanceProvider>
      <SelectedPlayerProvider>{children}</SelectedPlayerProvider>
    </SiteAppearanceProvider>
  );
}
