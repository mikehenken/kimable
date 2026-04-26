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
Kimable is available this session (mode: ${mode}). Purpose: cut Opus token spend by handing concrete execution work to kimi. If the briefing to kimi is bigger than just doing the work yourself, the system loses — don't delegate.

PRIMARY: ${primary} — ${primary_desc}
ALTERNATE: ${secondary} — ${secondary_desc}

DELEGATE WHEN
- Task is concrete: edit/refactor/test/rename/document, with paths or symbols nameable in one line.
- Scope is bounded: a file, a function, a small batch of similar changes.
- Pattern already exists in the codebase — kimi follows it, doesn't invent it.
- "Done" is verifiable (tests pass, lint clean, file matches the described shape).

DO NOT DELEGATE
- Architecture, API design, library/framework choice, migration strategy.
- Anything where the user is still deciding what they want.
- Anything that needs THIS conversation's context to make sense ("the bug we just discussed", "fix what you tried before").
- Security-sensitive code paths, secrets, auth logic. Keep these under direct review.
- Anything you'd brief in more than ~15 lines — at that point Opus is cheaper than the round-trip.

HOW TO BRIEF KIMI
Treat the prompt like briefing a sharp colleague who never saw this conversation. Self-contained. Includes only what kimi can't read or infer itself.

Include:
- Imperative task in one sentence ("Add a slugify(text: string) function to src/utils/string.ts").
- Exact file paths and symbol names. Kimi will open the files itself.
- Constraints decided in THIS conversation that aren't visible in the code ("Don't change the public API", "Use the existing logger from src/log.ts, not console.log", "Keep test coverage above 90%").
- Success criteria ("Tests in tests/utils/string.test.ts pass", "Type-check is clean").
- For kimi-orchestrate: preserve any \`@directive:value\` tokens the user typed (\`@complexity:5\`, \`@plan-file:...\`).

Exclude:
- File contents you just read. Pass the path; kimi reads it.
- The conversation history. Kimi has none and doesn't need it.
- Your plan, reasoning, or step-by-step breakdown — that's Opus's job, not part of the brief.
- Tangential context ("by the way, we're also considering…").
- The user's exploratory questions. Wait until the task is decided, then brief.

ANTICIPATE FAILURE
- "fix the bug" with no path → ask which file before delegating, or write the fix yourself.
- "improve performance" / "make it cleaner" → ambiguous; do not delegate.
- "and also update the docs / write tests / refactor X" → split into separate, sequential delegations or hand the bundle to kimi-orchestrate with a plan file.
- The user's words drop a constraint you've already established → re-state the constraint explicitly in the brief.
- Kimi returns "STATUS: escalation" or "STATUS: error" → take it back, don't re-prompt with creative reframing.

If the task isn't yet specific enough to brief in 1–10 lines, ASK the user. Do not guess. Do not pad with conversation history to compensate. The system exists to save tokens — wasting them on a bad delegation defeats the point.

You decide whether to delegate. No auto-routing.
</system>
EOF

exit 0
