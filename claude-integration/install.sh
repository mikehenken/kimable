#!/usr/bin/env bash
# install.sh - drops the Kimi delegate agent into Claude Code's agent directory
# Usage: ./install.sh (run from the claude-integration folder, or repo root)

set -euo pipefail

# figure out where this script lives so we can find the markdown file next to it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_FILE="${SCRIPT_DIR}/kimi-delegate.md"
TARGET_DIR="${HOME}/.claude/agents"
TARGET_FILE="${TARGET_DIR}/kimi-delegate.md"

# check the markdown file actually exists (would be awkward otherwise)
if [[ ! -f "$AGENT_FILE" ]]; then
    echo "oops: can't find ${AGENT_FILE}"
    echo "make sure you're running this from the right directory, yeah?"
    exit 1
fi

# make sure claude's agent folder exists — mkdir -p is harmless if it already does
echo "making sure ${TARGET_DIR} exists..."
mkdir -p "$TARGET_DIR"

# copy the agent definition into place
echo "copying kimi-delegate.md to ${TARGET_DIR}..."
cp "$AGENT_FILE" "$TARGET_FILE"

# set readable permissions (not that it really matters, but tidy is tidy)
chmod 644 "$TARGET_FILE"

# quick sanity check: is 'kimi' actually usable?
echo ""
echo "checking if 'kimi' is on your PATH..."
if command -v kimi &> /dev/null; then
    KIMI_PATH=$(command -v kimi)
    echo "found it: ${KIMI_PATH}"
else
    echo "warning: 'kimi' not found on PATH"
    echo "you'll need to install it before Claude can actually delegate anything"
    echo "see: https://github.com/your-org/kimable#installation"
fi

# done
echo ""
echo "all set. kimi-delegate.md is now at ${TARGET_FILE}"
echo ""
echo "validation command:"
echo "  kimi --agent kimable.yaml --prompt \"test\""
echo ""
echo "if you want claude to pick it up immediately, restart Claude Code."
echo "(or just wait — it checks the agents dir on startup anyway.)"
