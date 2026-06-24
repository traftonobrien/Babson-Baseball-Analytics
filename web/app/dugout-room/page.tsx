import type { Metadata } from "next";
import { TEAM_NAME } from "@/lib/teamConfig";

export const metadata: Metadata = {
  title: `Dugout Room — ${TEAM_NAME} Baseball`,
  description: "Private unlisted page.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DugoutRoomPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-[32px] border border-border bg-surface p-8 shadow-sm sm:p-10">
        <div
          className="h-1.5 w-28 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, rgb(var(--brand-primary-rgb)) 0%, color-mix(in srgb, rgb(var(--brand-primary-rgb)) 45%, white) 100%)",
          }}
        />
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted">
            Unlisted Page
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Dugout Room
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
            This page is intentionally not linked anywhere in the {TEAM_NAME.toLowerCase()} site
            navigation. Anyone with the direct URL can open it, but visitors will not reach it
            through buttons or menu items.
          </p>
        </div>
      </div>
    </main>
  );
}
