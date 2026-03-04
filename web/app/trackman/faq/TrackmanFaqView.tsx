"use client";

import { Activity, Target } from "lucide-react";
import {
  DictionaryCard,
  DictionaryPageShell,
  DictionarySection,
  DictionaryTableShell,
} from "@/app/components/dictionary/DictionaryChrome";

export default function TrackmanFaqView() {
  return (
    <DictionaryPageShell
      tone="blue"
      icon={Activity}
      title="Trackman Metrics Guide"
      description="This guide defines the core metrics captured by the portable Trackman B1 unit, along with the proprietary Stuff+ models used to evaluate pitch quality and location."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Metrics Dictionary", href: "/dictionary" },
        { label: "Trackman" },
      ]}
      maxWidth="max-w-5xl"
    >
      <DictionarySection
        tone="emerald"
        icon={Activity}
        title="Model Context"
        description="Trackman feeds the pitch-quality side of the stack. Stuff+ lives here directly, and Pitching+ uses those pitch-quality grades as one half of the full blend."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <DictionaryCard>
            <h3 className="text-lg font-bold text-emerald-400">Stuff+</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Grades the physical pitch profile: velocity, movement, spin,
              release point, and extension. It ignores where the pitch crossed
              the plate and answers one question: how nasty is the pitch in a
              vacuum?
            </p>
          </DictionaryCard>

          <DictionaryCard>
            <h3 className="text-lg font-bold text-amber-400">Pitching+</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              The overall live pitcher grade on this site. It blends Trackman
              Stuff+ with live Command+, then rolls only the overlapping pitch
              types into one team-centered number.
            </p>
          </DictionaryCard>

          <DictionaryCard>
            <h3 className="text-lg font-bold text-sky-400">Trackman&apos;s Role</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              This page captures the raw shape and flight traits. It does not
              measure command by itself, but it does provide the entire
              pitch-quality input that powers Stuff+ and the Stuff side of
              Pitching+.
            </p>
          </DictionaryCard>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="blue"
        icon={Target}
        title="Core Flight Metrics"
        description="The raw data captured directly by the Trackman radar array."
      >
        <div className="space-y-6">
          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-zinc-200">
              IVB (Induced Vertical Break)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Measured in inches. Represents how far a pitch deviates vertically
              from its gravity-only path because of Magnus force.
            </p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-zinc-400">
              <li>
                <strong className="text-zinc-300">Fastballs:</strong> Positive
                IVB creates a "rising" look and stays above the barrel.
              </li>
              <li>
                <strong className="text-zinc-300">Breaking Balls:</strong>{" "}
                Negative IVB indicates downward depth or sink.
              </li>
            </ul>
          </DictionaryCard>

          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-zinc-200">
              HB (Horizontal Break)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Measured in inches. Represents how far a pitch deviates
              horizontally.
            </p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-zinc-400">
              <li>
                <strong className="text-zinc-300">Positive HB:</strong> The ball
                tails to the right from the pitcher&apos;s perspective.
              </li>
              <li>
                <strong className="text-zinc-300">Negative HB:</strong> The ball
                sweeps to the left from the pitcher&apos;s perspective.
              </li>
            </ul>
          </DictionaryCard>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DictionaryCard>
              <h3 className="text-lg font-bold text-zinc-200">Extension</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Measured in feet. How far down the mound the pitcher releases
                the ball. More extension makes the pitch play faster.
              </p>
            </DictionaryCard>

            <DictionaryCard>
              <h3 className="text-lg font-bold text-zinc-200">
                Release Height &amp; Side
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                The 3D coordinate where the ball leaves the hand. Consistency
                here matters for tunneling.
              </p>
            </DictionaryCard>

            <DictionaryCard className="sm:col-span-2">
              <h3 className="text-lg font-bold text-zinc-200">Spin Rate</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Measured in RPM. Total spin matters, but active spin and axis
                direction are what actually drive movement.
              </p>
            </DictionaryCard>
          </div>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="blue"
        title="Pitch Classifications"
        description="How we map Trackman auto-tags into our internal pitch labels."
      >
        <DictionaryTableShell>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800/60 bg-zinc-900/85 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              <tr>
                <th className="px-6 py-4">Tag</th>
                <th className="px-6 py-4">Pitch Type</th>
                <th className="hidden px-6 py-4 sm:table-cell">
                  Movement Profile
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-zinc-400">
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-blue-400">FB</td>
                <td className="px-6 py-4 text-zinc-200">Four-Seam Fastball</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  High IVB, moderate arm-side run, highest spin axis.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-teal-400">SI</td>
                <td className="px-6 py-4 text-zinc-200">Sinker / Two-Seam</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Lower IVB, more arm-side run, heavier sink.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-orange-400">SL</td>
                <td className="px-6 py-4 text-zinc-200">Slider</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Higher velocity break with strong glove-side sweep.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-yellow-400">CB</td>
                <td className="px-6 py-4 text-zinc-200">Curveball</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Steeper vertical depth with slower velocity.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-rose-400">CH</td>
                <td className="px-6 py-4 text-zinc-200">Changeup</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Velocity separation with arm-side fade and depth.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-indigo-400">CU</td>
                <td className="px-6 py-4 text-zinc-200">Cutter</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Fastball look with slight glove-side cut.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-violet-400">SP</td>
                <td className="px-6 py-4 text-zinc-200">Splitter</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Reduced spin and sharp tumble.
                </td>
              </tr>
            </tbody>
          </table>
        </DictionaryTableShell>
      </DictionarySection>
    </DictionaryPageShell>
  );
}
