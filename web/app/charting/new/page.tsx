import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { ChartingCreateForm } from "@/app/charting/_components/ChartingCreateForm";

export const revalidate = 0;

export default function ChartingNewGamePage() {
  return (
    <LeaderboardPageFrame maxWidth="max-w-7xl">
      <div className="mb-6">
        <Link
          href="/charting"
          className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Back To Charting Hub
        </Link>
      </div>
      <ChartingCreateForm />
    </LeaderboardPageFrame>
  );
}
