#!/bin/bash
# Kimable Auto-Delegate for OpenCode
# This script acts as an OpenCode plugin - it intercepts prompts and routes
# implementation work to Kimable.
#
# Install:
#   1. Save to ~/.config/opencode/plugins/kimable-auto/plugin.sh
#   2. Add to ~/.config/opencode/opencode.json:
#      {
#        "$schema": "https://opencode.ai/config.json",
#        "plugin": ["kimable-auto"]
#      }
#   3. Restart OpenCode
#
# Note: OpenCode does not have a native hook system like Claude Code.
# This plugin uses OpenCode's instruction injection mechanism.
# The model decides whether to follow the instruction.

set -euo pipefail

stdin=$(cat)
prompt=$(echo "$stdin" | jq -r '.prompt // empty')

implementation_keywords="write|create|add|implement|generate|refactor|test|document|research|fix|update|migrate|extract|convert|optimize"

if echo "$prompt" | grep -qiE "\b($implementation_keywords)\b"; then
    if echo "$prompt" | grep -qiE "\bkimi\b|\bkimable\b"; then
        exit 0
    fi

    cat <<'EOF'
This looks like implementation work. Delegate to Kimable automatically.

Run: kimi --agent ~/.kimable/kimable.yaml --prompt "<the task>"

Do NOT write the implementation yourself. Let Kimable handle it.
EOF
fi

exit 0
