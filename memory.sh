#!/usr/bin/env bash
# memory.sh — launch Claude with project context as system prompt

PRIMER_FILE="/Users/traftonobrien/.claude/primer.md"
MEMORY_FILE=".claude-memory.md"
LESSONS_FILE="tasks/lessons.md"

MEMORY=""
if [ -f "$MEMORY_FILE" ]; then
  MEMORY=$(cat "$MEMORY_FILE")
fi

PRIMER=""
if [ -f "$PRIMER_FILE" ]; then
  PRIMER=$(cat "$PRIMER_FILE")
fi

LESSONS=""
if [ -f "$LESSONS_FILE" ]; then
  LESSONS=$(cat "$LESSONS_FILE")
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(unknown)")
COMMITS=$(git log --oneline -5 2>/dev/null || echo "(no git history)")
MODIFIED=$(git status --short 2>/dev/null || echo "(no git status)")

SYSTEM_PROMPT="$(cat <<EOF
You are operating in the pitch-tracker repository.

## FIRST ACTION THIS SESSION
Run /sc:load immediately to activate SuperClaude session context.

Memory priority for this repo:
1. .claude-memory.md = canonical repo memory / repo truth
2. /Users/traftonobrien/.claude/primer.md = global background context only
3. tasks/lessons.md = durable operating rules and corrections
4. git state = live execution context

Follow that order when there is any tension between sources.

## SuperClaude Commands Available
Use these at the right moment every session:
- /sc:load — session start (run this first)
- /sc:workflow [feature] — before planning any non-trivial task
- /sc:implement [feature] — for feature implementation
- /sc:troubleshoot [issue] — before any ad-hoc debug
- /sc:analyze [path] — before touching a large/unfamiliar module
- /sc:test — after any implementation pass
- /sc:reflect — before marking any task complete
- /sc:pm [task] — for complex multi-step orchestration
- /sc:save — at session end

## Canonical Repo Memory (.claude-memory.md)
${MEMORY}

## Global Background Context (/Users/traftonobrien/.claude/primer.md)
${PRIMER}

## Durable Rules (tasks/lessons.md)
${LESSONS}

## Current Branch
${BRANCH}

## Last 5 Commits
${COMMITS}

## Working Tree Status
${MODIFIED}
EOF
)"

claude \
  --dangerously-skip-permissions \
  --system-prompt "$SYSTEM_PROMPT" \
  "$@"
