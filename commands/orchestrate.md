---
description: Hand the current task to Kimable's multi-agent orchestrator (kimable.yaml + 14 subagents).
---

# /orchestrate

Invoke `@kimi-orchestrate` on the current task. Routes through `kimable.yaml`, scores complexity, picks subagents, validates output.

## Usage

```
/orchestrate add OAuth2 login flow with Google and GitHub
/orchestrate @complexity:5 @max-agents:3 refactor the database layer
/orchestrate @plan-file:plans/migrate-auth.yaml
```

## When to use this vs `/delegate`

- `/orchestrate` — multi-step tasks, plan files, anything benefiting from validation and multi-agent routing.
- `/delegate` — fast passthrough, single-file edits.

## Requirements

- `kimi` CLI on PATH
- `kimable.yaml` and `subagents/` available (default: `~/.kimable/`)
