#!/usr/bin/env bash

set -euo pipefail

REMOTE="origin"
BASE="main"
BRANCH="codex/charting-app"
MODE="rebase"
PUSH_AFTER=1
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: sync_charting_branch.sh [options]

Options:
  --merge        Merge origin/main into codex/charting-app instead of rebasing
  --no-push      Update the branch locally but do not push
  --dry-run      Print commands without executing them
  --branch NAME  Override the target branch (default: codex/charting-app)
  --base NAME    Override the base branch on the remote (default: main)
  --remote NAME  Override the remote (default: origin)
  --help         Show this help text
EOF
}

run_cmd() {
  printf '+'
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
  printf '\n'

  if [[ "$DRY_RUN" -eq 0 ]]; then
    "$@"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --merge)
      MODE="merge"
      ;;
    --no-push)
      PUSH_AFTER=0
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --branch)
      BRANCH="${2:?missing branch name}"
      shift
      ;;
    --base)
      BASE="${2:?missing base branch name}"
      shift
      ;;
    --remote)
      REMOTE="${2:?missing remote name}"
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

git rev-parse --show-toplevel >/dev/null

if [[ -n "$(git status --short)" ]]; then
  echo "Refusing to sync with a dirty worktree. Commit, stash, or clean changes first." >&2
  exit 1
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "Remote '$REMOTE' does not exist." >&2
  exit 1
fi

current_branch="$(git branch --show-current)"

run_cmd git fetch "$REMOTE"

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  run_cmd git switch "$BRANCH"
elif git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
  run_cmd git switch -c "$BRANCH" --track "$REMOTE/$BRANCH"
else
  echo "Target branch '$BRANCH' does not exist locally or on $REMOTE." >&2
  exit 1
fi

if [[ "$MODE" == "rebase" ]]; then
  run_cmd git rebase "$REMOTE/$BASE"
else
  run_cmd git merge --no-edit "$REMOTE/$BASE"
fi

if [[ "$PUSH_AFTER" -eq 1 ]]; then
  if [[ "$MODE" == "rebase" ]]; then
    run_cmd git push --force-with-lease "$REMOTE" "$BRANCH"
  else
    run_cmd git push "$REMOTE" "$BRANCH"
  fi
fi

printf 'Branch synced: %s\n' "$BRANCH"
printf 'Mode: %s\n' "$MODE"
printf 'Pushed: %s\n' "$( [[ "$PUSH_AFTER" -eq 1 ]] && echo yes || echo no )"
printf 'Current HEAD: %s\n' "$(git rev-parse --short HEAD)"
printf 'Previous branch: %s\n' "$current_branch"
