"use client";

import { useEffect } from "react";
import { initDebug } from "@/lib/debug";

/** Initializes window.__PT_DEBUG_HAND and window.__PT_DEBUG on mount. */
export default function DebugInit() {
  useEffect(() => {
    initDebug();
  }, []);
  return null;
}
