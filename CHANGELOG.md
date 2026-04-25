# Changelog

## 1.0.0 -- 2024-12-15

Initial release. Spent way too long migrating these from Cursor configs, but here they are.

### What's in this release

- **14 subagents migrated from Cursor** -- web-dev, api-dev, data-science, security, devops, docs, test, refactor, design, research, migration, debug, cli, and integration. Each one has its own YAML config, tool assignments, and prompt template. They were originally tuned for Cursor's agent mode and have been rewritten for Kimi CLI's tool-calling format.

- **Orchestrator with intent extraction + complexity scoring** -- Kimable reads your prompt, pulls out what you're actually asking for, and scores it low/medium/high. A "add padding to this div" doesn't need three agents. A "migrate our auth to OAuth2" probably does. The scoring is heuristic-based, not ML, so it's fast and doesn't need a model call of its own.

- **Configuration system** -- `@complexity`, `@effort`, and `@max-agents` are parsed from the top of your prompt or from a plan file. You can also set defaults in `kimable.yaml` if you always want medium complexity and a 2-hour budget. Overrides per-task work as you'd expect.

- **Claude Code integration** -- Sometimes Kimi hallucinates a regex or misses an edge case. The `claude` agent config hands off to Claude Code with the same context, so you can get a second opinion without copying and pasting. Output lands in the same journal either way.

- **Observability: journal + JSONL logging** -- `journal.md` is the human-readable summary. `.kimi/logs/runs.jsonl` is the machine-readable audit trail. Both append, never overwrite. You can grep the journal or `jq` the JSONL to find slow agents, common errors, or tasks that always need retries.

- **URL shortener tutorial example** -- Under `examples/url-shortener/`, a complete walkthrough that starts with `research` (pick a hash algorithm), moves to `api-dev` (write the endpoint), then `test` (coverage), and finally `docs` (API reference). Good for seeing how plan files work in practice.

### Known rough edges

- Complexity scoring is pretty naive. It looks for keywords like "migrate," "refactor," "compare," and "implement" but can miss context. A "migrate this one CSS class" might still score high if the word "migrate" is there. Override with `@complexity low` when that happens.

- Claude Code handoff requires both CLIs to be installed and on your PATH. There's no graceful fallback yet if Claude Code isn't found.

- The JSONL log can get big if you run Kimable dozens of times a day. No rotation yet -- `> runs.jsonl` when it bothers you.
