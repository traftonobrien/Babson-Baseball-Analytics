import Link from "next/link";
import {
  PITCHING_PLUS_COMMAND_WEIGHT,
  PITCHING_PLUS_EQUAL_SHARE_WEIGHT,
  PITCHING_PLUS_STUFF_WEIGHT,
  PITCHING_PLUS_USAGE_WEIGHT,
} from "@/lib/pitchingPlus";

export default function PitchingPlusPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-400">
                Metric Directory
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-zinc-50">
                Pitching+
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                A complete pitcher grade that blends team-centered Stuff+ with live
                Command+.
                {" "}
                In this app, 100 is team average and higher is better.
              </p>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-zinc-500">
                This is the app&apos;s internal coaching composite. It is not a direct
                copy of a public run-value Pitching+ model.
              </p>
            </div>
            <Link
              href="/leaderboards"
              className="inline-flex items-center rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-smooth hover:border-zinc-500 hover:text-zinc-100"
            >
              Back To Leaderboards
            </Link>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                What It Uses
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                Pitching+ combines the current pitch-type Stuff+ grade with the
                current live Command+ grade. It only scores pitch types that have a
                clean match on both sides.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                What 100 Means
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                Both inputs are team-centered in this app, so a Pitching+ of 100
                means the pitcher is exactly team average across the matched live
                arsenal.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                When It Shows
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                The score only appears when live command data exists and at least one
                pitch type has both a qualified Command+ score and a matching Stuff+
                row.
              </p>
            </section>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
              <h2 className="text-lg font-bold text-zinc-100">Formula</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-300">
                <p>
                  For each overlapping pitch type, we first blend Stuff+ and
                  Command+ into a single pitch-type score:
                </p>
                <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-black/30 p-4 text-xs text-cyan-300">
{`Pitching+_p = 100 * (Stuff+_p / 100)^${PITCHING_PLUS_STUFF_WEIGHT.toFixed(2)} * (Command+_p / 100)^${PITCHING_PLUS_COMMAND_WEIGHT.toFixed(2)}`}
                </pre>
                <p>
                  Then we roll those pitch-type scores up with a hybrid weighting
                  model:
                </p>
                <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-black/30 p-4 text-xs text-cyan-300">
{`w_p = ${PITCHING_PLUS_EQUAL_SHARE_WEIGHT.toFixed(2)} * (1 / K) + ${PITCHING_PLUS_USAGE_WEIGHT.toFixed(2)} * usage_p

Overall Pitching+ = Σ (w_p * Pitching+_p)`}
                </pre>
                <p className="text-zinc-400">
                  `K` is the number of matched pitch types. `usage_p` is the live
                  command usage share for that pitch within the matched set.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
              <h2 className="text-lg font-bold text-zinc-100">Why It’s Weighted This Way</h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-300 list-disc pl-5">
                <li>
                  Stuff gets a slight edge because it is the more stable part of the
                  pitcher&apos;s profile over time.
                </li>
                <li>
                  Command still has real pull because the grade should reward live
                  execution, not just pure pitch shape.
                </li>
                <li>
                  Half equal-share weighting keeps a great secondary pitch relevant.
                </li>
                <li>
                  Half usage weighting keeps the pitcher&apos;s primary weapons from being
                  underrepresented.
                </li>
              </ul>
            </section>
          </div>

          <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
            <h2 className="text-lg font-bold text-zinc-100">Not Ready States</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  Missing Live Command
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  No qualified live Command+ means the weighting variable is missing,
                  so no official Pitching+ is shown.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  Missing Stuff
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  If the player has no matching Stuff+ rows yet, the composite stays
                  unavailable instead of falling back to a guessed value.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  No Clean Overlap
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  If the pitch-type crosswalk is ambiguous or unmatched, the metric
                  waits until at least one pitch type cleanly overlaps.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
