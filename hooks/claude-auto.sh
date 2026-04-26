#!/bin/bash
# Kimable Auto-Delegate Hook for Claude Code
# UserPromptSubmit hook - intercepts every prompt before Claude processes it
#
# Install:
#   1. Save to ~/.claude/hooks/kimable-auto.sh
#   2. chmod +x ~/.claude/hooks/kimable-auto.sh
#   3. Add to ~/.claude/settings.json:
#      {
#        "hooks": {
#          "UserPromptSubmit": [
#            {
#              "type": "command",
#              "command": "/Users/YOU/.claude/hooks/kimable-auto.sh"
#            }
#          ]
#        }
#      }
#   4. Restart Claude Code
#
# How it works:
#   Reads the user's prompt from stdin (JSON).
#   If prompt matches implementation keywords (write, add test, refactor, etc),
#   prepends a system reminder to delegate to Kimable.
#   Otherwise passes through unchanged.

set -euo pipefail

stdin=$(cat)
prompt=$(echo "$stdin" | jq -r '.prompt // empty')

# Keywords that trigger delegation
implementation_keywords="write|create|add|implement|generate|refactor|test|document|research|fix|update|migrate|extract|convert|optimize"

# Check if prompt matches implementation work
if echo "$prompt" | grep -qiE "\b($implementation_keywords)\b"; then
    # Don't double-delegate if user already mentioned kimi
    if echo "$prompt" | grep -qiE "\bkimi\b|\bkimable\b"; then
        exit 0
    fi

    cat <<'EOF'
<system-reminder>
This looks like implementation work. Delegate to Kimable automatically.

Run: kimi --agent ~/.kimable/kimable.yaml --prompt "<the task>"

Do NOT write the implementation yourself. Let Kimable's subagents handle it.
Architecture and design decisions stay with you. Execution goes to Kimable.
</system-reminder>
EOF
fi

exit 0
