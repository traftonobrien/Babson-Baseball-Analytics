# TODO

<!-- Update as you work. Format: [ ] pending, [x] done, [-] dropped -->

## Active

- [x] 2026-03-22 — Render `roster.json` player photos on roster pages (`PlayersHubView`, `players/[slug]/page.tsx`) with initials fallback

## Backlog

### Session Start Ritual (run at the top of every new session)
- [ ] `/sc:load` — load project context, lessons, git state
- [ ] `/sc:recommend` — if direction is unclear, get prioritized next-action suggestion

### One-Time SuperClaude Setup
- [ ] `/sc:index-repo` — generate 94% token-reduced codebase map for pitch-tracker
- [ ] `/sc:analyze web/app/charting` — quality/architecture report on charting module before next feature pass
- [ ] `/sc:analyze web/lib/charting` — analyze charting lib for quality and coverage gaps

### Next Feature Work
- [ ] UAT pass on game charting — top-box fit, lineup modal, top/bottom inning, baserunner entry, history edits
- [ ] Decision: add sacrifice-fly tracking or defer to next charting follow-up

## Done
- [x] 2026-03-22 — **Players hub + profile backgrounds**: `PlayersHubView` + `players/[slug]/page.tsx` — `dark:` zinc page gradient (match home), softer brand radial / blur in dark; `npm run build` OK
- [x] 2026-03-22 — **Home dashboard `/` (`HomeContent.tsx`) site dark**: page gradient + hero dual overlay (light vs zinc), brand borders via `color-mix`, pulse cards/skeletons/sparklines, quick-launch tiles (`brandSoftPillClasses`), games list borders/session pills/status chips; `npm run build` OK
- [x] 2026-03-22 — **Player command dashboard (site dark)**: `web/lib/brandSurfaces.ts` (`brandSoftPillClasses`, `brandHighlightCardClasses`, `brandSoftEyebrowTextClasses`, `brandSoftActiveRingClasses`) for body-injected light brand hexes; `PlayerDashboard` (hero chip, emphasis quick links, edited-pitch notice), `CommandPlusSection` season badge, `TeamAveragesBar` refactor, `LaneReport` selected lane, `LeaderboardPill` brand on dark site (`LeaderboardChrome`); `plusMetricSurfaceClassesLight` darker tier fills/borders; `npm run build` OK
- [x] 2026-03-22 — **TeamAveragesBar “This outing” card (dark)**: body inline `--brand-primary-soft` can’t be fixed by `dark:` shadow alone; card now uses `color-mix` + `rgb(var(--brand-primary-rgb))` gradient/border on `var(--surface)` / `var(--border-subtle)`, spotlight eyebrow text; `npm run build` OK
- [x] 2026-03-22 — **Command outing dark polish** (`PitchTypeChip` soft variant: `useSiteAppearance`, zinc text + pitch-tinted border/bg/shadow; `TeamAveragesBar` “This outing” card `dark:` inset highlight; `PitchTypeSummaryCards` `Stat` dark gradient + `statStyle` shadows); `npm run build` OK
- [x] 2026-03-22 — **Leaderboard dark parity (non–Pitching+)**: `command/leaderboard`, `trackman/leaderboard`, `team-stats/leaderboard`, charting (`LeaderboardClientState`, `PitcherLeaderboardTable`, `HitterLeaderboardTable`, stat wrappers), `leaderboards-hub` — `dark:` on shells, toolbars, tables (sticky `thead`, rows, links, empty/loading), accent-aligned hovers (orange/command, sky/trackman, emerald/charting); `npm run build` OK
- [x] 2026-03-22 — **All pages dark mode pass**: semantic tokens (`text-muted`, `text-foreground`, `bg-background`, `border-border`, `bg-surface`) across 50+ files; `LeaderboardChrome` light variant + site dark (`LIGHT_PILL_ON_DARK_SITE`, hero/panel/toolbar zinc surfaces); `Breadcrumbs` light-on-dark; `HubHeader` client + stat/action cards; `zone-display` empty cells use CSS vars; `app-shell-surface` dark rule; `npm --prefix web run build` OK
- [x] 2026-03-22 — **Site-wide light/dark**: `SiteAppearanceProvider` + `localStorage` key `pitch-tracker-site-appearance` (migrates legacy `pitch-tracker-trackman-player-appearance`); `html[data-site-appearance="dark"]` CSS vars in `globals.css`; `layout` uses `bg-background`/`text-foreground`; `Sidebar` dark styling + `SiteAppearanceToggle`; Trackman player page uses `useSiteAppearance()` + dark-aware panels; removed Trackman-only appearance files; `npm --prefix web run build` OK
- [x] 2026-03-22 — Trackman player `/trackman/player/[slug]`: `#F8FAFC` `LeaderboardPageFrame` + brand wash, light `LeaderboardHero`/`Breadcrumbs`/pills/side cards; session chips + panels + overview trends; `PitchTypeTable`/`MovementScatterByType`/`PitchArsenalCards` `variant`/`surface` light; `StuffPlusSummaryCard`, `ArmActionPanel`, `MLBCompsPanel` light; `npm --prefix web run build` OK
- [x] 2026-03-22 — Command compare `/player/[playerId]/compare`: `LeaderboardPageFrame` + toolbar + panels `variant="light"`, light `LeaderboardHero` + pills + back link, brand radial wash, light `Breadcrumbs`; `CompareControls` / `CompareKpiRow` / `ComparePitchTypeTable` / `CompareLaneTable` slate borders + readable delta colors; loading/errors/suspense aligned; `npm --prefix web run build` OK
- [x] 2026-03-22 — Printable command report `/player/[playerId]/report`: light shell (`#F8FAFC` gradient, brand radial wash), `LeaderboardHero` `variant="light"` + emerald eyebrow, light `LeaderboardPill`s, hub-style actions + brand Export PDF, white rounded card; inner report KPIs/tables/lanes use slate/`#64748B` on screen with `print:` preserved; loading/error/Suspense aligned; `npm --prefix web run build` OK
- [x] 2026-03-22 — `PlayerDashboard` header: hub card (`rounded-[28px]`, shadow), top row (back + “Command outing” blurb + pitch count), indigo “Pitch command” eyebrow, `Plus_Jakarta_Sans` title, meta pills; optional “Session” block in tinted panel; “Quick links” row; main grid `lg:px-8`; `npm --prefix web run build` OK
- [x] 2026-03-22 — Command outing `/player/[playerId]` (`PlayerDashboard`) light UI: `#F8FAFC` shell, white header, `LeaderboardPill` light, slate/orange controls; `FilterPanel`, `PitchTable`, `OutingSelect`, `VideoPlayer`, `StrikeZoneScatter`, `MissHeatmap`, `GameStatsSection`, `CommandPlusSection` (+ `TeamAveragesBar`), `PitchTypeSummaryCards`, `LaneReport` aligned to hub tokens; `plusMetricSurfaceClassesLight` in `stuffPlusUtils`; `npm --prefix web run build` OK
- [x] 2026-03-22 — `PlayersHubView` filter panel aligned to `LiveAbInsightsExplorer`: `section` card (`border-[#E5E7EB]`, `p-4 sm:p-5`, `shadow-[0_16px_40px_...]`), labeled rows (roster view / search / reset), Hand + Class in two columns; table wrapper + featured pin card shadows updated; `npm --prefix web run build` OK
- [x] 2026-03-22 — Hub header parity: `team-stats/leaderboard` + `PlayersHubView` use shared `HubHeader` (indigo eyebrow, `HubActionCard` ×2, `HubStatCard` ×3, `rounded-[28px]`, `max-w-[1440px]`); `npm --prefix web run build` OK
- [x] 2026-03-22 — Clear build/devtools noise: split `web/lib/auth` into Edge-safe `auth-gates` + Node `auth-login`; fix Next `Image` aspect-ratio warning on Babson logos (`PlayersHubView`, `HomeContent`, `Sidebar`)
