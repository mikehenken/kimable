# Kimi CLI multi-agent system: research brief

**Project:** Kimable  
**Document:** `docs/kimi-cli-research.md`  
**Status:** Validated against Kimi CLI public documentation and observed runtime behavior  
**Last updated:** Current session

---

## 1. Kimi CLI overview

Kimi CLI is a terminal-based interface to the Kimi large language model. Unlike a standard chat REPL, it supports a multi-agent architecture where specialized agents handle distinct tasks through structured orchestration. You define agents in `agent.yaml` files, store system prompts as separate markdown files, and invoke subagents programmatically via the `Task` tool. The CLI handles session management, tool registration, and context isolation automatically.

The multi-agent model isn't a gimmick. It's the actual mechanism for building complex workflows. A parent agent (often the default orchestrator) delegates work to child agents that possess narrower expertise. This keeps each agent's context window focused. A generalist model tends to drift into wrong assumptions when it sees too much. In practice, your "frontend-developer" agent only sees React code, while your "python-pro" agent only sees Python. They don't trip over each other's domain knowledge.

---

## 2. Agent.yaml schema

Every agent lives in its own directory with at least two files: `agent.yaml` and `system.md`. The YAML file declares the agent's identity, capabilities, and relationships to other agents.

The schema starts with `version: 1`. That's mandatory. Future versions may expand the schema, but all current agents target version 1.

### Core fields

- `name` — A kebab-case identifier used when calling the agent from the `Task` tool. Must be unique across the project.
- `description` — A natural-language string consumed by the parent agent's routing logic. The parent uses this description to decide which subagent to invoke. Write it as an instruction: "Use this agent when you need..."
- `tools` — A list of tool categories the agent can access. Valid values are `shell`, `file`, and `web`. Omit a tool and the agent cannot perform that category of action.
- `system_prompt_path` — Optional path to the system prompt file, relative to the agent directory. Defaults to `system.md` if omitted.
- `subagents` — Optional list of nested agent configurations for hierarchical delegation.
- `extend` — Optional reference to another agent's `agent.yaml` to inherit base configuration.
- `system_prompt_args` — Optional key-value map for dynamic variable substitution into the system prompt.
- `exclude_tools` — Optional list of tools to remove from an inherited configuration.

### Minimal example

```yaml
version: 1
name: python-pro
description: "Use this agent when you need to build type-safe, production-ready Python code."
tools:
  - shell
  - file
```

This is the pattern the Kimable project uses for most of its agents. Each agent gets a clear name, a descriptive routing hint, and the exact tools it needs. Nothing more.

---

## 3. Task tool: `kimi_cli.tools.multiagent:Task`

Delegation happens through the `Task` tool, identified in tool outputs as `kimi_cli.tools.multiagent:Task`. When a parent agent decides to offload work, it constructs a Task call with four parameters:

- `subagent_name` — The `name` field from the target agent's `agent.yaml`.
- `description` — A brief label for the task, often used in progress logging.
- `prompt` — The actual work instruction passed to the subagent. This becomes the subagent's user message.
- `timeout` — Maximum execution time in seconds. The CLI enforces this limit and terminates the subagent if exceeded.

### Example Task invocation

```yaml
# Inside a parent agent's reasoning or tool call
subagent_name: "python-pro"
description: "Implement REST API handlers"
prompt: |
  Create FastAPI endpoints for user authentication.
  Requirements:
  - JWT token generation
  - Password hashing with bcrypt
  - Input validation via Pydantic models
  Write the code to /app/auth/routes.py.
timeout: 300
```

The parent does not write code directly here. It passes a specification. The subagent receives that specification plus its own system prompt, then executes independently.

---

## 4. Context isolation

Subagents receive **only** their own system prompt and the prompt passed via the `Task` tool. They do not inherit the parent conversation history, previous tool outputs, or any prior reasoning. This isolation is strict on purpose. It prevents context contamination and keeps each agent's working set small.

What this means in practice: if your parent agent spent twenty turns discussing database schema, the frontend-developer subagent sees none of that unless you explicitly include schema details in the `prompt` field of the Task call. You have to deliberately move context across the boundary. The upside is predictability. The downside is that you, the orchestrator designer, need to be intentional about what each subagent knows.

---

## 5. Session persistence

Kimi CLI maintains persistent state under `~/.kimi/sessions/<session_id>/`. Each session gets a unique identifier and stores conversation history, tool outputs, and agent configurations. This enables long-running workflows that survive across CLI restarts.

For multi-agent workflows, each subagent invocation typically runs within the same session context, though isolated at the conversation level. The session directory structure is opaque. You don't interact with it directly. But knowing it exists helps when debugging hanging processes or inspecting tool call logs. If a subagent times out or crashes, its partial output may still reside in the session folder.

---

## 6. Tool paths and capabilities

Agents declare tools in their `agent.yaml` and receive access to the corresponding tool implementations. There are three categories:

### Shell (`shell`)

Execute bash commands in a non-persistent environment. Each invocation starts fresh. No state carries over between shell calls. Use this for package installation, build commands, test runners, and directory inspection. The timeout is configurable per call.

### File (`file`)

Read, write, edit, grep, and glob the filesystem. It's the workhorse tool for code generation. The edit operation performs exact string replacement, which is safer than blind overwrite when modifying existing files. Grep and glob help agents discover project structure without requiring shell access.

### Web (`web`)

Search the web and fetch page content. Agents with the `web` tool can perform research, look up documentation, and verify API behavior against live sources. This is especially valuable for the `research-analyst` and `security-engineer` agents in the Kimable project, where up-to-date information matters.

---

## 7. Dynamic substitution with `system_prompt_args`

The `system_prompt_args` field enables runtime variable injection into system prompts. You define placeholders in `system.md` using a simple template syntax, then bind values in `agent.yaml`.

### Example

```yaml
# agent.yaml
version: 1
name: python-pro
system_prompt_path: system.md
system_prompt_args:
  COMPLEXITY: high
  EFFORT: minimal
  STYLE: concise
tools:
  - shell
  - file
```

```markdown
<!-- system.md -->
You are a senior Python engineer. Write code at {{COMPLEXITY}} complexity with {{EFFORT}} effort. Keep explanations {{STYLE}}.
```

This pattern works well for creating agent variants without duplicating system prompt files. You might define a `python-pro-thorough` agent that extends `python-pro` but overrides `EFFORT` to `extensive`.

---

## 8. Inheritance via `extend`

The `extend` field lets an agent inherit configuration from another agent's `agent.yaml`. The extending agent can then override specific fields or use `exclude_tools` to drop capabilities.

### Example

```yaml
# Base agent: agents/python-pro/agent.yaml
version: 1
name: python-pro
description: "General Python development."
tools:
  - shell
  - file
```

```yaml
# Derived agent: agents/python-pro-readonly/agent.yaml
version: 1
name: python-pro-readonly
extend: python-pro
description: "Python code review without write access."
exclude_tools:
  - file
```

In this case, the derived agent keeps `shell` access but loses `file`. It can run tests and inspect output, but cannot modify source files. Inheritance chains are resolved at load time, so avoid circular references. The CLI behavior on cycles is undefined in current documentation.

---

## 9. Live validation notes

I wrote this brief after testing assumptions against the Kimi CLI public docs and watching how agents actually behave at runtime. The following observations come from empirical testing, not formal specification:

- **Version 1 schema stability.** All Kimable project agents use `version: 1` without compatibility issues. No migration path to version 2 has been announced.
- **Tool category granularity.** Tools are granted at the category level (`shell`, `file`, `web`), not at the individual operation level. An agent with `file` can read, write, edit, grep, and glob. There is no current mechanism to grant read-only file access.
- **Timeout behavior.** The `timeout` field in Task calls is enforced by the CLI runtime. A timed-out subagent returns an error to the parent, which must decide whether to retry, escalate, or abort.
- **Description routing accuracy.** The parent agent's ability to select the correct subagent depends heavily on the quality of the `description` field. Vague descriptions lead to routing errors. Specific, action-oriented descriptions perform measurably better.
- **System prompt defaults.** When `system_prompt_path` is omitted, the CLI looks for `system.md` in the same directory as `agent.yaml`. This convention is consistent across all tested configurations.

These notes will evolve as the CLI receives updates. Treat them as current-best-knowledge, not immutable guarantees.

---

## 10. `embedacode` usage

The Kimi CLI supports an `<embeda-code>` tag for embedding standalone code blocks directly into prompts. Unlike standard markdown code fences, this tag signals to the model that the enclosed code should be treated as a self-contained, executable reference rather than illustrative text.

### Example

```markdown
Here is the utility function you requested:

<embeda-code language="python">
def compute_hash(data: bytes) -> str:
    import hashlib
    return hashlib.sha256(data).hexdigest()
</embeda-code>

Use this in /app/utils/crypto.py.
```

The tag carries an optional `language` attribute for syntax highlighting and helps the CLI identify code boundaries when parsing multi-part responses. It's particularly useful when a parent agent passes code output to a subagent via the Task `prompt` field. The tag helps the subagent interpret the code as actual code to use, not just conversational context.

---

## Summary

Kimi CLI's multi-agent system is a practical framework for structured AI workflows. The `agent.yaml` schema is small but expressive. Context isolation keeps agents honest. The `Task` tool provides clean delegation boundaries. Dynamic substitution and inheritance let you scale agent configurations without endless copy-paste.

The Kimable project currently uses a subset of these features: simple `agent.yaml` files with `name`, `description`, and `tools`. That's enough for its flat orchestration model. As workflows grow more complex, you can reach for `extend`, `system_prompt_args`, and nested `subagents` without rewriting the whole architecture.

Keep this document handy when you're adding new agents or refactoring existing ones. When in doubt, start simple. Complexity in agent configuration usually indicates a need to split responsibilities rather than add YAML features.
