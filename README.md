# Kimable

An orchestrator for the Kimi CLI multi-agent system. Kimable reads your prompt, figures out how hard the task is, then spins up one or more specialized agents to actually do the work. Each agent gets a specific slice of the problem, runs in its own session, and writes results to a shared journal.

## Why this exists

Kimi's default agent is K2.5 (a.k.a. Moonshot or the big model). It's great. It's also expensive to leave running for two hours on tasks that don't need that kind of firepower. Some things just need a quick script. Others need cross-referencing three specs and a test suite. Kimable exists to stop burning Opus tokens on grep-and-replace jobs.

The other reason: agents are better when they stay focused. A web-dev agent that also has to read your database schema is going to get distracted. Kimable splits the work so each agent only sees what it needs.

## Quick start

```bash
# 1. Install Kimi CLI if you haven't
npm install -g kimi-cli

# 2. Grab this repo
git clone https://github.com/yourname/kimable.git
cd kimable

# 3. Run a task through the orchestrator
kimi --agent kimable.yaml --prompt "Add a dark mode toggle to the settings page"
```

That's it. Kimable will read the prompt, decide it's a web-dev task with medium complexity, and hand it off to the web-dev agent. The agent works, writes to the journal, and you're done.

## The 14 subagents

Here's the lineup. Each one is a YAML config in `agents/` that tells Kimi how to behave.

| Agent | Handles |
|---|---|
| `web-dev` | Frontend changes, React, CSS, DOM stuff |
| `api-dev` | Backend endpoints, REST, GraphQL, middleware |
| `data-science` | Notebooks, pandas, plots, model training |
| `security` | Audits, dependency scanning, threat modeling |
| `devops` | Docker, CI configs, deploy scripts, Terraform |
| `docs` | README updates, docstrings, API docs |
| `test` | Unit tests, integration tests, test data |
| `refactor` | Dead code removal, renames, structural cleanup |
| `design` | UI/UX reviews, accessibility checks, spacing |
| `research` | Deep dives, RFCs, comparison tables, due diligence |
| `migration` | Framework upgrades, database migrations, rewrites |
| `debug` | Error tracing, log analysis, root cause investigation |
| `cli` | Shell scripts, CLI tools, argument parsing, piping |
| `integration` | Third-party APIs, webhooks, SDK wrangling |

Most tasks only need one. Big refactors might loop in `refactor`, `test`, and `docs`. Research-heavy features might start with `research`, then pass to `api-dev`. You don't pick them by hand -- the orchestrator does that from your prompt.

## Configuration

Kimable looks for a block like this at the top of your prompt or in a plan file:

```yaml
@kimable
complexity: medium    # low / medium / high
effort: 2h            # rough time estimate
max-agents: 3         # hard cap on parallel agents
```

The orchestrator uses `complexity` to decide whether a task is a quick one-agent job or something that needs multiple specialists. `effort` is just a hint -- the agent may ignore it if the work turns out to be bigger or smaller. `max-agents` keeps things from spiraling; even if your prompt mentions six different systems, Kimable won't spin up more than the cap.

If you don't specify anything, the defaults are `medium`, `1h`, and `2` agents. Fine for most PR-sized tasks.

## Plan files

Sometimes you already know the steps. Write a plan file and Kimable will follow it instead of improvising.

```yaml
# plans/add-oauth.yaml
@kimable
complexity: high
max-agents: 3

steps:
  - agent: research
    prompt: "Compare OAuth2 providers: Google, GitHub, Discord. Pick one."
  - agent: api-dev
    prompt: "Implement the auth callback and JWT session handling"
  - agent: web-dev
    prompt: "Add the login button and callback route"
  - agent: test
    prompt: "Write tests for the auth flow"
```

Run it with:

```bash
kimi --agent kimable.yaml --plan plans/add-oauth.yaml
```

Each step runs in order. The orchestrator waits for one to finish and journal its output before starting the next. You can still override with `--prompt` if you want to add context on the fly.

## Claude Code integration

If you're already using Claude Code, Kimable can hand off to it for tasks that benefit from a different model's take. The `claude.yaml` agent config is basically a bridge: it receives the same prompt and journal context, but runs through Claude Code instead of Kimi.

This is useful when Kimi gets stuck on something that needs reasoning about edge cases, or when you just want a second opinion. The output still lands in the same journal, so nothing gets lost.

Enable it by adding `claude: true` to your `@kimable` block, or by running:

```bash
kimi --agent kimable.yaml --prompt "Debug this race condition" --claude
```

You'll need Claude Code installed separately. Kimable doesn't bundle it.

## Observability

Kimable keeps two logs so you can figure out what happened without re-running everything.

**The journal** (`journal.md`) is a human-readable markdown file. Every agent appends a section with its name, what it did, what files it touched, and any gotchas it ran into. It's meant for quick skimming. The first version wrote timestamps, but they made diffs noisy. Now they're optional -- add `--timestamps` if you want them.

**The JSONL log** (`.kimi/logs/runs.jsonl`) is the machine-readable version. One line per event: prompt received, agent spawned, step completed, error hit, retry attempted. Feed it to `jq` or a spreadsheet if you're trying to optimize token burn or find patterns in where agents fail.

```bash
# See which agent took the longest
jq 'select(.type == "agent_complete") | {agent, duration_ms}' .kimi/logs/runs.jsonl

# Find errors
jq 'select(.type == "error")' .kimi/logs/runs.jsonl
```

Both files append, never overwrite. If you run Kimable twenty times today, you'll have twenty entries.

## Install and setup

1. Make sure Kimi CLI is on your path: `kimi --version`
2. Clone this repo somewhere handy
3. Optionally add `kimable.yaml` to your shell alias:

```bash
alias kb="kimi --agent /path/to/kimable/kimable.yaml"
```

4. Create a `.env` if you need API keys for specific agents (the `integration` agent often needs these):

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
```

The orchestrator itself doesn't need keys -- it just routes. Individual agents read `.env` if their tools require it.

## License

MIT. See [LICENSE](./LICENSE). Do whatever you want, just don't blame me if an agent deletes your `node_modules` by accident.
