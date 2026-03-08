---
name: charting-branch-sync
description: Safely sync the repo's `codex/charting-app` branch with `origin/main` and push the result without moving `main`. Use when the user asks to keep the charting app branch current with main, rebase or merge main into the app branch, check branch drift, or push charting app updates while leaving main untouched.
---

# Charting Branch Sync

Use this skill to update `codex/charting-app` from `origin/main` without changing `main`.

## Default Workflow

1. Confirm the worktree is clean with `git status --short`.
2. Prefer the sync script:

```bash
.agents/skills/charting-branch-sync/scripts/sync_charting_branch.sh
```

3. Report the result:
   - active branch
   - whether the script rebased or merged
   - whether the push happened
   - the new `HEAD` commit

## Modes

- Default: rebase `codex/charting-app` onto `origin/main`, then `git push --force-with-lease`.
- Merge mode: use only if the user explicitly wants to avoid force-pushes.

```bash
.agents/skills/charting-branch-sync/scripts/sync_charting_branch.sh --merge
```

- Inspect only:

```bash
.agents/skills/charting-branch-sync/scripts/sync_charting_branch.sh --dry-run
```

- Update locally without pushing:

```bash
.agents/skills/charting-branch-sync/scripts/sync_charting_branch.sh --no-push
```

## Rules

- Treat `origin/main` as the source of truth, not local `main`.
- Do not move `main`.
- Refuse to run if the worktree is dirty unless the user explicitly asks to handle those changes first.
- Stop on rebase or merge conflicts and report the conflicting files instead of improvising.
- Prefer the script over manually rewriting the same Git sequence.

## Deployment Topology
When working on both the Next.js backend and the iOS App:

- **Web Changes** (`web/` directory): API routes, schema changes, and logic need to be accessible by the iPad in production. **These must be merged into `main`** so Vercel can deploy them.
- **iOS Changes** (`ios/` directory): Features and native app code live only on the `codex/charting-app` branch. Vercel doesn't build these, so compiling/deploying happens through Xcode natively.

If you make web API changes on the charting branch, you should check out `main` and manually merge `codex/charting-app` (resolving conflicts by taking the charting version for tracking-related files) and push to `origin/main` to trigger a Vercel deploy.

## Resource

Use [sync_charting_branch.sh](scripts/sync_charting_branch.sh) for the actual branch sync.
