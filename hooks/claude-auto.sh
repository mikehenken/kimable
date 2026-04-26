#!/bin/bash
# Kimable Auto-Delegate Hook for Claude Code
# UserPromptSubmit hook — intercepts every prompt before Claude processes it
#
# Install:
#   cp ~/.kimable/hooks/claude-auto.sh ~/.claude/hooks/kimable-auto.sh
#   chmod +x ~/.claude/hooks/kimable-auto.sh
#   # Add to ~/.claude/settings.json:
#   { "hooks": { "UserPromptSubmit": [
#     { "type": "command", "command": "~/.claude/hooks/kimable-auto.sh" }
#   ]}}
#
# Enable per-session:
#   /delegate-on    (writes ~/.kimable/session-state/claude-{id}.json)
#   /delegate-off   (deletes the state file)
#
# Or globally:
#   export KIMABLE_USE_HOOK=1

set -euo pipefail

stdin=$(cat)
prompt=$(echo "$stdin" | jq -r '.prompt // empty')
session_id=$(echo "$stdin" | jq -r '.session_id // empty')

SESSION_FILE="$HOME/.kimable/session-state/claude-${session_id}.json"

# Single check: enabled?
is_enabled() {
    [[ "${KIMABLE_USE_HOOK:-0}" == "1" ]] && return 0
    [[ -f "$SESSION_FILE" ]] && grep -q '"enabled": true' "$SESSION_FILE" 2>/dev/null && return 0
    return 1
}

# Single check: implementation work?
is_delegate_work() {
    echo "$prompt" | grep -qiE '\b(write|create|add|implement|generate|refactor|test|document|research|fix|update|migrate|extract|convert|optimize)\b' || return 1
    echo "$prompt" | grep -qiE '\bkimi\b|\bkimable\b' && return 1
    return 0
}

# Decision
if is_enabled && is_delegate_work; then
    cat <<'EOF'
<system>
This is implementation work. Delegate to Kimable immediately.

Run from the project root:
  cd <project-root> && kimi --agent ~/.kimable/kimable.yaml --prompt "<task>"

Do NOT write the code yourself. Let Kimable handle execution.
</system>
EOF
fi

exit 0
