#!/bin/bash
# Kimable context hook for Claude Code (UserPromptSubmit).
#
# This hook does NOT auto-detect, route, or filter. It just injects a one-line
# reminder that Kimable is available, so the model can choose to delegate.
#
# Enable globally:    export KIMABLE_USE_HOOK=1
# Enable per-session: /delegate-on   (writes ~/.kimable/session-state/claude-{id}.json)
# Switch mode:        /kimable-mode delegate | orchestrate
# Override mode:      export KIMABLE_MODE=orchestrate

set -euo pipefail

stdin=$(cat)
session_id=$(echo "$stdin" | jq -r '.session_id // empty')

SESSION_FILE="$HOME/.kimable/session-state/claude-${session_id}.json"

# Enabled?
enabled=0
if [[ "${KIMABLE_USE_HOOK:-0}" == "1" ]]; then
    enabled=1
elif [[ -f "$SESSION_FILE" ]] && grep -q '"enabled":[[:space:]]*true' "$SESSION_FILE" 2>/dev/null; then
    enabled=1
fi

[[ $enabled -eq 1 ]] || exit 0

# Mode resolution: env > session-state > default
mode="${KIMABLE_MODE:-}"
if [[ -z "$mode" && -f "$SESSION_FILE" ]]; then
    mode=$(jq -r '.mode // empty' "$SESSION_FILE" 2>/dev/null || echo "")
fi
mode="${mode:-delegate}"

if [[ "$mode" == "orchestrate" ]]; then
    primary="@kimi-orchestrate"
    primary_desc="multi-agent orchestrator (kimable.yaml + 14 subagents)"
    secondary="@kimi-delegate"
    secondary_desc="thin passthrough"
else
    primary="@kimi-delegate"
    primary_desc="thin passthrough to default kimi CLI"
    secondary="@kimi-orchestrate"
    secondary_desc="multi-agent orchestrator"
fi

cat <<EOF
<system>
Kimable is available for execution work this session. Active mode: ${mode}.
- Primary: ${primary} (${primary_desc})
- Alternate: ${secondary} (${secondary_desc})
You decide whether to delegate. No auto-routing.
</system>
EOF

exit 0
