---
name: charting-branch-sync
description: Safely sync the repo's `codex/charting-app` staging branch with `origin/main`, and promote validated charting work back into `main` when it is ready to ship. Use when the user asks to keep the charting branch current with main, check branch drift, or merge staged charting work into `main`.
---

# Charting Branch Sync

Use this skill to keep `codex/charting-app` aligned with `origin/main`, or to promote validated charting work from `codex/charting-app` back into `main`.

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

## Current Branch Roles

- `main` is the production branch for the web app and the branch Vercel deploys.
- `codex/charting-app` is a staging/reference branch for charting work, including legacy iOS context and any isolated charting experiments.
- If a charting change is web-facing and ready to ship, merge it into `main` instead of leaving it to live indefinitely on `codex/charting-app`.

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
- Do not move `main` unless the task is explicitly to promote validated charting work into `main`.
- Refuse to run if the worktree is dirty unless the user explicitly asks to handle those changes first.
- Stop on rebase or merge conflicts and report the conflicting files instead of improvising.
- Prefer the script over manually rewriting the same Git sequence.

## Deployment Topology
Current expected flow:

- **Web changes** (`web/`, charting APIs, schema, shared logic): ship from `main`.
- **Staged charting work**: can be developed on `codex/charting-app`, but it should be merged back into `main` once validated.
- **Legacy iOS code** (`ios/`): may remain on `codex/charting-app` as reference material, but it is no longer the deployment target for the charting product.

When a charting branch commit is ready for production:

1. Fetch `origin`.
2. Check out `main`.
3. Prefer `git merge --ff-only codex/charting-app` if `main` is simply behind the staging branch.
4. If a true merge is required, use a normal non-interactive merge and resolve charting-related conflicts deliberately.
5. Push `origin/main`.
6. Fast-forward `codex/charting-app` back to `main` so the staging branch stays aligned after promotion.

## Resource

Use [sync_charting_branch.sh](scripts/sync_charting_branch.sh) for the actual branch sync.
