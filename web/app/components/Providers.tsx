"use client";

import { SelectedPlayerProvider } from "@/lib/selectedPlayer";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return <SelectedPlayerProvider>{children}</SelectedPlayerProvider>;
}
