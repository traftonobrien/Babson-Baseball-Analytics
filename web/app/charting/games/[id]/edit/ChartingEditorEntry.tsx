"use client";

import dynamic from "next/dynamic";

import type { ChartingEditorProps } from "@/app/charting/_components/ChartingEditor";

const ChartingEditor = dynamic(
  () =>
    import("@/app/charting/_components/ChartingEditor").then(
      (mod) => mod.ChartingEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted dark:text-zinc-400">
        Loading charting editor…
      </div>
    ),
  },
);

/** Loads ChartingEditor only on the client so `live-domain` is not duplicated in the RSC/SSR graph. */
export function ChartingEditorEntry(props: ChartingEditorProps) {
  return <ChartingEditor {...props} />;
}
