---
description: Switch the active Kimable mode for this session (delegate or orchestrate). Affects the optional context hook.
---

# /kimable-mode

Set which Kimable agent the optional context hook (`hooks/claude-auto.sh`) reminds the model about for the rest of this session.

## Usage

```
/kimable-mode delegate      # passthrough (default)
/kimable-mode orchestrate   # multi-agent flow
/kimable-mode               # show current mode
```

## How it works

Writes `~/.kimable/session-state/claude-{session_id}.json`:

```json
{ "enabled": true, "mode": "orchestrate" }
```

The hook reads this file (or the `KIMABLE_MODE` env var) when injecting its context reminder. If neither is set, mode defaults to `delegate`.

To enable the hook globally regardless of session state:

```bash
export KIMABLE_USE_HOOK=1
export KIMABLE_MODE=orchestrate    # optional
```

To disable the hook for the session, run `/delegate-off` (clears the session state file).

## Implementation

```bash
SESSION_FILE="$HOME/.kimable/session-state/claude-${CLAUDE_SESSION_ID}.json"
mkdir -p "$(dirname "$SESSION_FILE")"
MODE="${1:-}"

if [[ -z "$MODE" ]]; then
  if [[ -f "$SESSION_FILE" ]]; then
    cat "$SESSION_FILE"
  else
    echo '{"enabled":false,"mode":"delegate"}  (default)'
  fi
  exit 0
fi

if [[ "$MODE" != "delegate" && "$MODE" != "orchestrate" ]]; then
  echo "Error: mode must be 'delegate' or 'orchestrate'"
  exit 1
fi

echo "{\"enabled\":true,\"mode\":\"$MODE\"}" > "$SESSION_FILE"
echo "Kimable mode set to: $MODE"
```
