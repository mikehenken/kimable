---
name: kimi-orchestrate
description: Multi-agent Kimi orchestration. Routes work through kimable.yaml, scores complexity, picks subagents, validates output. Use for multi-step tasks, plan files, or anything that benefits from coordinated subagents.
---

# Kimi orchestrate

You delegate to Kimable's multi-agent orchestrator. Unlike `@kimi-delegate` (which is a thin passthrough), this hands work to `kimable.yaml`, which extracts intent, scores complexity, picks one or more of the 14 subagents, runs them, and validates the result.

Use this when the work is bigger than one file, needs planning, or you want the orchestrator's validation pass.

## CLI invocation

Run from the project root. kimi requires the explicit `--agent-file` flag — the bare `--agent` flag only accepts builtin names (`default`, `okabe`).

```bash
cd <project-root> && kimi --agent-file ~/.kimable/kimable.yaml --prompt "<task>"
```

If a `kimable` shim is on PATH (installed by `scripts/install.js`), this collapses to:

```bash
kimable --prompt "<task>"
```

If the project has a local `kimable.yaml`, point `--agent-file` at it instead.

## Inline directives

Prefix the prompt with `@key:value` directives. They stack.

- `@complexity:1-10` — overrides auto-scoring. 1 is "rename a variable"; 10 is "design a distributed system".
- `@effort:minimal|balanced|thorough` — how much time to spend.
- `@max-agents:N` — cap on concurrent subagents.
- `@review:true|false` — run a self-check pass before returning.
- `@style:minimal|verbose` — output detail level.

```bash
kimi --agent-file ~/.kimable/kimable.yaml --prompt "@complexity:5 @effort:thorough add retry logic to the HTTP client"
```

## Plan files

For multi-step work, point at a YAML plan instead of stuffing it into the prompt:

```bash
kimi --agent-file ~/.kimable/kimable.yaml --prompt "@plan-file:plans/add-oauth.yaml"
```

```yaml
goal: "Add OAuth2 login"
tasks:
  - file: "src/auth/oauth.ts"
    action: "implement Google + GitHub providers"
  - file: "tests/auth/oauth.test.ts"
    action: "cover happy path + token expiry"
constraints:
  - "no new dependencies beyond passport"
```

## Sessions

Long runs can be paused and resumed:

```bash
kimi --agent-file ~/.kimable/kimable.yaml --prompt "..." --session my-refactor
kimi --session my-refactor --continue
```

Session state lives in `~/.kimable/sessions/`.

## Response handling

Orchestrator output ends with one of:

- `STATUS: completed` + file list — integrate or commit.
- `STATUS: escalation` + reason — take it back to the user or to Opus. Don't re-prompt with the same request.
- `STATUS: error` + detail — retry once if transient (path typo, rename); otherwise stop.

## When NOT to use this

- Single-file edits with obvious scope → use `@kimi-delegate`.
- Architectural decisions, secrets handling, or anything requiring human judgment → keep it under your own control.

For the full orchestrator contract, see `docs/orchestrator-spec.md`.
