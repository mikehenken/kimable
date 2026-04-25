# /delegate

Quick-delegate the current task or selection to Kimable's multi-agent orchestrator.

## Usage

```
/delegate
/delegate "write tests for the auth module"
/delegate @complexity:medium @effort:thorough "refactor the database layer"
```

## Description

The `/delegate` command captures your current context (open files, recent conversation, cursor selection) and routes it to Kimable's orchestrator. The orchestrator extracts intent, scores complexity, picks the right subagent, and executes.

Use this when you're in Claude Code and hit work that doesn't need architectural reasoning: implementation, tests, docs, research, refactoring. Keep Claude focused on design. Let Kimable handle execution.

## What happens

1. Captures current file context and conversation history
2. Formats a Kimable prompt with config directives
3. Sends to `kimi --agent kimable.yaml`
4. Waits for execution and validation
5. Returns results with file diffs, summaries, next-step suggestions

## Examples

```
# Simple task - no quotes needed for single words
/delegate add dark mode toggle

# Multi-step task with config overrides
/delegate @complexity:5 @max-agents:3 "Add OAuth2 login flow with Google and GitHub"

# Research task
/delegate @effort:thorough research how CopilotKit handles backend actions and return API surface

# Post-implementation review
/delegate @review:true validate the auth middleware handles all edge cases
```

## Requirements

- Kimi CLI installed: `curl -fsSL https://www.kimi.com/code/install.sh | bash`
- Kimable repo cloned: `git clone https://github.com/mikehenken/kimable-simple-agent.git ~/.kimable`
- `kimi` on your PATH

## See also

- `@kimi-delegate` — the full agent with more control over prompt formatting
- `agents/kimi-delegate.md` — agent definition and system prompt
