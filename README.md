<p align="center">
  <img src="./assets/kimable-banner.png" alt="Kimable" width="600">
</p>

# Kimable

Route Claude execution work to Kimi. Two hand-off styles: thin passthrough or multi-agent orchestration.

## Why

Opus is great at architecture, expensive at grunt work. Kimi K2.6 / kimi-code is fast and cheap and good enough for execution within established patterns. Kimable wires the two together as Claude subagents so you don't burn Opus tokens on tests, refactors, and boilerplate.

## Install

Recommended — Claude Code plugin:

```bash
claude plugin marketplace add github:mikehenken/kimable
# inside Claude Code:
/plugin install kimable-delegate
```

Or via npx (clones to `~/.kimable` and offers to install the kimi CLI):

```bash
npx github:mikehenken/kimable
```

Requires `git`, `node`, and the [kimi CLI](https://www.kimi.com/code).

## kimi flag note

The kimi CLI's bare `--agent` flag only accepts the builtin names `default` and `okabe`. Custom agent files are loaded with `--agent-file PATH`. The installer drops a `kimable` shim into `~/.local/bin/` so you don't need to type the long path:

```bash
kimable -p "your task"          # equals: kimi --agent-file ~/.kimable/kimable.yaml -p "..."
```

Known issue: `kimi --print` / `--quiet` may hang in non-TTY environments (some CI shells, certain Windows git-bash configurations). Tracked upstream; for now invoke kimi from a real terminal session.

## Two ways to use it

```
@kimi-delegate "fix the off-by-one in paginate()"
```
Lightweight passthrough to the default kimi CLI. The plugin's default. Fast.

```
@kimi-orchestrate "@plan-file:plans/add-oauth.yaml"
```
Multi-agent orchestration via `kimable.yaml` and the 14 subagents below. Use for multi-step work, plan files, or anything that benefits from validation.

Switch the active mode for the session: `/kimable-mode orchestrate` (or `delegate`). Or globally: `export KIMABLE_MODE=orchestrate`.

## The 14 subagents (orchestrate mode)

| Agent | Handles |
|---|---|
| `architect-reviewer` | Architecture review, design critiques |
| `devops-engineer` | Docker, CI configs, deploy scripts |
| `documentation-engineer` | READMEs, docstrings, API docs |
| `error-coordinator` | Error tracing, log analysis, root cause |
| `frontend-developer` | UI components, CSS, DOM work |
| `fullstack-developer` | Cross-stack features, end-to-end flows |
| `market-researcher` | Industry research, competitive analysis |
| `nextjs-developer` | Next.js routing, server components, RSC |
| `python-pro` | Python features, packaging, type-safety |
| `qa-expert` | Test plans, coverage, regression sweeps |
| `research-analyst` | Deep dives, RFCs, comparison tables |
| `security-engineer` | Audits, dependency scanning, threat modeling |
| `ui-designer` | Visual design, layout, design systems |
| `ux-researcher` | User flows, usability, persona work |

## Optional context hook

The plugin ships with a Claude Code hook (`hooks/claude-auto.sh`) that injects a one-line reminder into every prompt that Kimable is available. The model decides whether to delegate — no keyword matching, no auto-routing.

Enable it globally:
```bash
export KIMABLE_USE_HOOK=1
```

Or per session via `/delegate-on` / `/delegate-off`. Switch which agent gets recommended via `/kimable-mode`.

## Observability

`journal.md` (human-readable) and `.kimi/logs/runs.jsonl` (machine-readable). Both append-only. Pipe the JSONL into `jq` to find slow agents or recurring errors.

## License

MIT. See [LICENSE](./LICENSE).
