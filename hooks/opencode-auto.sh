#!/bin/bash
# Kimable Auto-Delegate Plugin for OpenCode
# Intercepts prompts and routes implementation work to Kimable.
#
# Install:
#   cp ~/.kimable/hooks/opencode-auto.sh ~/.config/opencode/plugins/kimable-auto/plugin.sh
#   chmod +x ~/.config/opencode/plugins/kimable-auto/plugin.sh
#   # Add to ~/.config/opencode/opencode.json:
#   { "plugin": ["kimable-auto"] }
#
# Enable per-session:
#   !delegate-on    (writes ~/.kimable/session-state/opencode-{id}.json)
#   !delegate-off   (deletes the state file)
#
# Or globally:
#   export KIMABLE_USE_HOOK=1

set -euo pipefail

stdin=$(cat)
prompt=$(echo "$stdin" | jq -r '.prompt // empty')
session_id=$(echo "$stdin" | jq -r '.session_id // empty')

SESSION_FILE="$HOME/.kimable/session-state/opencode-${session_id}.json"

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
This is implementation work. Delegate to Kimable immediately.

Run from the project root:
  cd <project-root> && kimi --agent ~/.kimable/kimable.yaml --prompt "<task>"

Do NOT write the code yourself. Let Kimable handle execution.
EOF
fi

exit 0
