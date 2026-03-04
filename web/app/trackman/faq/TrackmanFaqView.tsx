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
      title="Trackman Guide"
      description="This guide covers the core Trackman flight metrics and how they feed the site&apos;s pitch-quality models."
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
        description="Trackman supplies the pitch-quality side of the stack. Stuff+ lives here directly, and Pitching+ uses that data as one half of the full blend."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <DictionaryCard>
            <h3 className="text-lg font-bold text-emerald-400">Stuff+</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Grades the physical pitch profile: velocity, movement, spin,
              release point, and extension. It ignores location and answers one
              question: how good is the pitch on its own?
            </p>
          </DictionaryCard>

          <DictionaryCard>
            <h3 className="text-lg font-bold text-amber-400">Pitching+</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              The headline live pitcher grade on the site. It blends Trackman
              Stuff+ with live Command+, then rolls only the overlapping pitch
              types into one team-centered score.
            </p>
          </DictionaryCard>

          <DictionaryCard>
            <h3 className="text-lg font-bold text-sky-400">Trackman&apos;s Role</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Trackman captures the raw shape and flight traits. It does not
              measure command, but it supplies the full pitch-quality input for
              Stuff+ and the Stuff side of Pitching+.
            </p>
          </DictionaryCard>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="blue"
        icon={Target}
        title="Core Flight Metrics"
        description="The core raw readings captured directly by the Trackman unit."
      >
        <div className="space-y-6">
          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-zinc-200">
              IVB (Induced Vertical Break)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Measured in inches. It shows how far a pitch moves vertically away
              from a gravity-only path.
            </p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-zinc-400">
              <li>
                <strong className="text-zinc-300">Fastballs:</strong> Positive
                IVB creates ride and keeps the ball above the barrel.
              </li>
              <li>
                <strong className="text-zinc-300">Breaking Balls:</strong>{" "}
                Negative IVB indicates depth or sink.
              </li>
            </ul>
          </DictionaryCard>

          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-zinc-200">
              HB (Horizontal Break)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Measured in inches. It shows how far a pitch moves horizontally.
            </p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-zinc-400">
              <li>
                <strong className="text-zinc-300">Positive HB:</strong> The ball
                moves to the right from the pitcher&apos;s perspective.
              </li>
              <li>
                <strong className="text-zinc-300">Negative HB:</strong> The ball
                moves to the left from the pitcher&apos;s perspective.
              </li>
            </ul>
          </DictionaryCard>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DictionaryCard>
              <h3 className="text-lg font-bold text-zinc-200">Extension</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Measured in feet. It shows how far down the mound the ball is
                released. More extension makes the pitch play faster.
              </p>
            </DictionaryCard>

            <DictionaryCard>
              <h3 className="text-lg font-bold text-zinc-200">
                Release Height &amp; Side
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                The 3D release point. Consistency here matters for tunneling and
                disguise.
              </p>
            </DictionaryCard>

            <DictionaryCard className="sm:col-span-2">
              <h3 className="text-lg font-bold text-zinc-200">Spin Rate</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Measured in RPM. Total spin matters, but active spin and axis
                direction are what actually create movement.
              </p>
            </DictionaryCard>
          </div>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="blue"
        title="Pitch Classifications"
        description="How Trackman auto-tags are mapped into the site&apos;s pitch labels."
      >
        <DictionaryTableShell>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800/60 bg-zinc-900/85 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              <tr>
                <th className="px-6 py-4">Tag</th>
                <th className="px-6 py-4">Pitch Type</th>
                <th className="hidden px-6 py-4 sm:table-cell">
                  Typical Shape
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-zinc-400">
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-blue-400">FB</td>
                <td className="px-6 py-4 text-zinc-200">Four-Seam Fastball</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Ride with moderate arm-side run.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-teal-400">SI</td>
                <td className="px-6 py-4 text-zinc-200">Sinker / Two-Seam</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Lower ride with more arm-side sink.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-orange-400">SL</td>
                <td className="px-6 py-4 text-zinc-200">Slider</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Firm break with strong glove-side sweep.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-yellow-400">CB</td>
                <td className="px-6 py-4 text-zinc-200">Curveball</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  More depth with lower velocity.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-rose-400">CH</td>
                <td className="px-6 py-4 text-zinc-200">Changeup</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Velocity separation with fade and depth.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-indigo-400">CU</td>
                <td className="px-6 py-4 text-zinc-200">Cutter</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Fastball look with slight cut.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-violet-400">SP</td>
                <td className="px-6 py-4 text-zinc-200">Splitter</td>
                <td className="hidden px-6 py-4 sm:table-cell">
                  Lower spin with late tumble.
                </td>
              </tr>
            </tbody>
          </table>
        </DictionaryTableShell>
      </DictionarySection>
    </DictionaryPageShell>
  );
}
