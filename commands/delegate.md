---
description: Hand the current task to the default kimi CLI as a thin passthrough.
---

# /delegate

Invoke `@kimi-delegate` on the current task. Lightweight passthrough — runs `kimi --prompt "..."` without the multi-agent orchestrator.

## Usage

```
/delegate
/delegate write tests for the auth module
/delegate "fix the off-by-one in paginate()"
```

If you don't pass a task, the agent uses your most recent request.

## When to use this vs `/orchestrate`

- `/delegate` — single-file edits, obvious scope, fast turnaround.
- `/orchestrate` — multi-step work, plan files, needs validation, touches multiple modules.

## Requirements

- `kimi` CLI on PATH: `curl -fsSL https://www.kimi.com/code/install.sh | bash`
