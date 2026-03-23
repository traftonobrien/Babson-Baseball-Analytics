"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  PITCHING_PLUS_COMMAND_WEIGHT,
  PITCHING_PLUS_EQUAL_SHARE_WEIGHT,
  PITCHING_PLUS_STUFF_WEIGHT,
  PITCHING_PLUS_USAGE_WEIGHT,
} from "@/lib/pitchingPlus";
import { DictionaryPageShell } from "@/app/components/dictionary/DictionaryChrome";

export default function PitchingPlusPage() {
  return (
    <DictionaryPageShell
      tone="amber"
      icon={Sparkles}
      title="Plus Statistics Guide"
      description="One reference for the site&apos;s 100-centered plus models. Pitching+ is the headline grade, with Command+ and Stuff+ as the two supporting layers."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Metrics Dictionary", href: "/dictionary" },
        { label: "Plus Statistics" },
      ]}
      maxWidth="max-w-6xl"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="#pitching-plus-formula"
          className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition-smooth hover:border-amber-300 hover:bg-amber-100"
        >
          Jump to Formula
        </Link>
        <Link
          href="/pitching-plus/leaderboard"
          className="inline-flex items-center rounded-full border border-slate-200 bg-surface px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-smooth hover:border-slate-300 hover:text-slate-900"
        >
          Open Leaderboard
        </Link>
      </div>

      <section
        id="pitching-plus-formula"
        className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50/90 via-white to-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-800/90">
              Primary Composite
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50">Pitching+</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Pitching+ is the complete-pitcher grade. It blends team-centered
              Stuff+ with live Command+, then rolls the matched pitch types up
              with a hybrid weighting model. On this site, 100 is team average.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-3 text-right shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-800/80">Blend</p>
            <p className="mt-1 font-mono text-3xl font-black text-amber-950">
              {Math.round(PITCHING_PLUS_STUFF_WEIGHT * 100)}/{Math.round(PITCHING_PLUS_COMMAND_WEIGHT * 100)}
            </p>
            <p className="text-[11px] text-amber-800/70">Stuff / Command</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Pitch-Type Formula</h3>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-teal-900">
              {`Pitching+_p = 100 * (Stuff+_p / 100)^${PITCHING_PLUS_STUFF_WEIGHT.toFixed(2)} * (Command+_p / 100)^${PITCHING_PLUS_COMMAND_WEIGHT.toFixed(2)}`}
            </pre>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Each overlapping pitch type gets its own blended grade first. That
              keeps the Stuff and Command pieces attached to the same pitch
              before the model rolls everything up.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">How It Rolls Up</h3>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-teal-900">
              {`K        = number of overlapping pitch types
usage_p  = share of tracked pitches thrown of type p

w_p = ${PITCHING_PLUS_EQUAL_SHARE_WEIGHT.toFixed(2)} * (1 / K) + ${PITCHING_PLUS_USAGE_WEIGHT.toFixed(2)} * usage_p

Overall Pitching+ = Σ (w_p * Pitching+_p)`}
            </pre>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Half pure mix keeps strong secondaries relevant. Half live usage
              keeps primary pitches from being underweighted.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">What 100 Means</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Team-average complete-pitcher grade across the matched live
              arsenal.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">When It Shows</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Only when live command exists and at least one pitch type overlaps
              cleanly with Stuff+.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Why It Can Differ</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Pitching+ only uses the overlap set, so its internal cores can
              differ from the standalone Command+ and Stuff+ tiles.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-900/80">Example</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            A pitcher with a{" "}
            <span className="font-semibold text-amber-900">Pitching+ of 108</span> is
            performing 8% above team average on the combined stuff-and-command
            grade across the overlapping pitch types.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50/90 to-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-800/90">
            Supporting Model
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50">Command+</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Command+ is the full live execution grade. It compares a
            pitcher&apos;s miss distance to the live team miss baseline and uses
            every qualified command pitch, even if that pitch does not make it
            into Pitching+.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-teal-900">
            {`Command+_pitchType = (team baseline miss / pitcher miss) * 100

Overall Command+ = pitch-count weighted average across all qualified live pitch types`}
          </pre>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Standalone Command+ can read higher or lower than the Pitching+
            Command Core because the standalone model keeps all qualified
            command pitches, while the core only keeps the Stuff-overlap subset.
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-800/90">
            Supporting Model
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50">Stuff+</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Stuff+ is the standalone pitch-quality grade. On the player profile,
            the visible Stuff+ tile is a simple average across valid pitch-type
            rows in the tracked arsenal.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-teal-900">
            {`Profile Stuff+ = simple average of valid pitch-type Stuff+ rows

Pitching+ Stuff Core = overlap-only subset, then re-weighted inside Pitching+`}
          </pre>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Standalone Stuff+ can differ from the Pitching+ Stuff Core because
            Pitching+ removes non-overlap pitches and changes the weighting.
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Reading the Stack</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Pitching+</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The complete-pitcher number. This is the headline grade.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Command+</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The full live execution grade across every qualified command pitch.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Stuff+</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The standalone pitch-quality view of the tracked arsenal.
            </p>
          </div>
        </div>
      </section>
    </DictionaryPageShell>
  );
}
