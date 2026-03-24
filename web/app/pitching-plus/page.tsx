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
  const shellCardClass =
    "rounded-2xl border border-slate-200 bg-surface shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)]";
  const codeBlockClass =
    "mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-teal-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-teal-100";
  const mutedTextClass = "text-sm leading-7 text-slate-600 dark:text-zinc-300";
  const infoCardClass =
    "rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)]";

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
          className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition-smooth hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-100 dark:hover:border-amber-400/40 dark:hover:bg-amber-500/18"
        >
          Jump to Formula
        </Link>
        <Link
          href="/pitching-plus/leaderboard"
          className="inline-flex items-center rounded-full border border-slate-200 bg-surface px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-smooth hover:border-slate-300 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-200 dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)] dark:hover:border-zinc-700 dark:hover:text-zinc-50"
        >
          Open Leaderboard
        </Link>
      </div>

      <section
        id="pitching-plus-formula"
        className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50/90 via-white to-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:border-amber-500/25 dark:bg-gradient-to-br dark:from-amber-500/10 dark:via-zinc-950 dark:to-zinc-950 dark:shadow-[0_22px_56px_rgba(0,0,0,0.35)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-800/90 dark:text-amber-200/80">
              Primary Composite
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50">Pitching+</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-zinc-300">
              Pitching+ is the complete-pitcher grade. It blends team-centered
              Stuff+ with live Command+, then rolls the matched pitch types up
              with a hybrid weighting model. On this site, 100 is team average.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-3 text-right shadow-sm dark:border-amber-500/25 dark:bg-amber-500/12 dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-800/80 dark:text-amber-200/75">Blend</p>
            <p className="mt-1 font-mono text-3xl font-black text-amber-950 dark:text-amber-100">
              {Math.round(PITCHING_PLUS_STUFF_WEIGHT * 100)}/{Math.round(PITCHING_PLUS_COMMAND_WEIGHT * 100)}
            </p>
            <p className="text-[11px] text-amber-800/70 dark:text-amber-200/70">Stuff / Command</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className={`${shellCardClass} p-5`}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Pitch-Type Formula</h3>
            <pre className={codeBlockClass}>
              {`Pitching+_p = 100 * (Stuff+_p / 100)^${PITCHING_PLUS_STUFF_WEIGHT.toFixed(2)} * (Command+_p / 100)^${PITCHING_PLUS_COMMAND_WEIGHT.toFixed(2)}`}
            </pre>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-zinc-300">
              Each overlapping pitch type gets its own blended grade first. That
              keeps the Stuff and Command pieces attached to the same pitch
              before the model rolls everything up.
            </p>
          </div>

          <div className={`${shellCardClass} p-5`}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50">How It Rolls Up</h3>
            <pre className={codeBlockClass}>
              {`K        = number of overlapping pitch types
usage_p  = share of tracked pitches thrown of type p

w_p = ${PITCHING_PLUS_EQUAL_SHARE_WEIGHT.toFixed(2)} * (1 / K) + ${PITCHING_PLUS_USAGE_WEIGHT.toFixed(2)} * usage_p

Overall Pitching+ = Σ (w_p * Pitching+_p)`}
            </pre>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-zinc-300">
              Half pure mix keeps strong secondaries relevant. Half live usage
              keeps primary pitches from being underweighted.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className={infoCardClass}>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">What 100 Means</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              Team-average complete-pitcher grade across the matched live
              arsenal.
            </p>
          </div>
          <div className={infoCardClass}>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">When It Shows</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              Only when live command exists and at least one pitch type overlaps
              cleanly with Stuff+.
            </p>
          </div>
          <div className={infoCardClass}>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Why It Can Differ</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              Pitching+ only uses the overlap set, so its internal cores can
              differ from the standalone Command+ and Stuff+ tiles.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-500/25 dark:bg-amber-500/10">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-900/80 dark:text-amber-200/70">Example</p>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-zinc-200">
            A pitcher with a{" "}
            <span className="font-semibold text-amber-900 dark:text-amber-100">Pitching+ of 108</span> is
            performing 8% above team average on the combined stuff-and-command
            grade across the overlapping pitch types.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50/90 to-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:border-orange-500/20 dark:bg-gradient-to-br dark:from-orange-500/10 dark:to-zinc-950 dark:shadow-[0_22px_56px_rgba(0,0,0,0.35)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-800/90 dark:text-orange-200/80">
            Supporting Model
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50">Command+</h2>
          <p className={mutedTextClass}>
            Command+ is the full live execution grade. It compares a
            pitcher&apos;s miss distance to the live team miss baseline and uses
            every qualified command pitch, even if that pitch does not make it
            into Pitching+.
          </p>
          <pre className={codeBlockClass}>
            {`Command+_pitchType = (team baseline miss / pitcher miss) * 100

Overall Command+ = pitch-count weighted average across all qualified live pitch types`}
          </pre>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            Standalone Command+ can read higher or lower than the Pitching+
            Command Core because the standalone model keeps all qualified
            command pitches, while the core only keeps the Stuff-overlap subset.
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:border-blue-500/20 dark:bg-gradient-to-br dark:from-blue-500/10 dark:to-zinc-950 dark:shadow-[0_22px_56px_rgba(0,0,0,0.35)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-800/90 dark:text-blue-200/80">
            Supporting Model
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50">Stuff+</h2>
          <p className={mutedTextClass}>
            Stuff+ is the standalone pitch-quality grade. On the player profile,
            the visible Stuff+ tile is a simple average across valid pitch-type
            rows in the tracked arsenal.
          </p>
          <pre className={codeBlockClass}>
            {`Profile Stuff+ = simple average of valid pitch-type Stuff+ rows

Pitching+ Stuff Core = overlap-only subset, then re-weighted inside Pitching+`}
          </pre>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            Standalone Stuff+ can differ from the Pitching+ Stuff Core because
            Pitching+ removes non-overlap pitches and changes the weighting.
          </div>
        </section>
      </div>

      <section className={`${shellCardClass} p-6`}>
        <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Reading the Stack</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Pitching+</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              The complete-pitcher number. This is the headline grade.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Command+</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              The full live execution grade across every qualified command pitch.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Stuff+</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              The standalone pitch-quality view of the tracked arsenal.
            </p>
          </div>
        </div>
      </section>
    </DictionaryPageShell>
  );
}
