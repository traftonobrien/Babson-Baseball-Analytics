#!/bin/bash
# Install git hooks from .githooks to .git/hooks

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
GITHOOKS_DIR="$REPO_ROOT/.githooks"
GIT_HOOKS_DIR="$REPO_ROOT/.git/hooks"

if [ ! -d "$GITHOOKS_DIR" ]; then
    echo "Error: .githooks directory not found"
    exit 1
fi

if [ ! -d "$GIT_HOOKS_DIR" ]; then
    echo "Error: .git/hooks directory not found. Are you in a git repository?"
    exit 1
fi

echo "Installing git hooks..."

for hook in "$GITHOOKS_DIR"/*; do
    if [ -f "$hook" ]; then
        hook_name=$(basename "$hook")
        dest="$GIT_HOOKS_DIR/$hook_name"
        
        # Copy hook and make it executable
        cp "$hook" "$dest"
        chmod +x "$dest"
        echo "  Installed: $hook_name"
    fi
done

echo "Done! Git hooks installed."
