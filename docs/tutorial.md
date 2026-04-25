From /mnt/agents/output/kimable-simple-agent/docs/tutorial.md

# Kimable Tutorial — From First Prompt to Full Orchestration

You've got Kimable installed and you're staring at the prompt. Maybe you're wondering: *"How much do I need to learn before this thing actually helps me?"* The answer is — almost nothing. The whole point of Kimable is that you describe what you want, and the orchestrator figures out who should do the work. Let's walk through six steps that take you from "hello world" to "orchestrate a complex multi-agent plan."

---

## Step 1 — Just ask for something simple

Type exactly this into your terminal:

```bash
kimable "Write a Python script that reads CSV and outputs JSON"
```

That's it. No flags, no plan files, no configuration.

### What the orchestrator decides

Kimable's orchestrator (`orchestrator.py`) reads your prompt, runs it through a lightweight classifier, and decides this is a **single-domain, low-complexity** task. Here's the decision log (you'll see this if you run with `--verbose`):

```
[orchestrator] Prompt received (47 tokens)
[orchestrator] Classification: domain=python, complexity=simple, effort=standard
[orchestrator] No inline directives detected
[orchestrator] Plan: single-agent, subagent=python-pro
[orchestrator] Dispatching to python-pro...
```

No escalation. No plan file needed. The orchestrator just hands it to the `python-pro` subagent and gets out of the way.

### What the subagent returns

The `python-pro` subagent is a senior Python specialist. Here's the actual output you'd see:

```python
#!/usr/bin/env python3
"""csv_to_json.py — Convert a CSV file to a JSON array with type inference."""

import csv
import json
import sys
from pathlib import Path


def csv_to_json(csv_path: Path, json_path: Path | None = None) -> str:
    """Read CSV, infer types, return JSON string."""
    rows = []
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            typed_row = {}
            for key, raw in row.items():
                typed_row[key] = _infer_type(raw.strip())
            rows.append(typed_row)

    json_str = json.dumps(rows, indent=2, ensure_ascii=False)

    if json_path:
        json_path.write_text(json_str, encoding="utf-8")
        print(f"Wrote {len(rows)} rows to {json_path}")

    return json_str


def _infer_type(value: str):
    """Coerce strings into int, float, bool, or None where possible."""
    if value == "":
        return None
    lowered = value.lower()
    if lowered in ("true", "yes", "1"):
        return True
    if lowered in ("false", "no", "0"):
        return False
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: csv_to_json.py <input.csv> [output.json]")
        sys.exit(1)

    out = csv_to_json(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) > 2 else None)
    if len(sys.argv) == 2:
        print(out)
```

Look at the details: type inference, `utf-8-sig` to handle Excel-exported CSVs, a `__main__` block with CLI usage, clean docstrings. That's what happens when the orchestrator routes to a domain expert instead of a generalist.

### Validation

Kimable runs a quick sanity check — in this case, it lints with `ruff` and checks that `csv` and `json` are in the stdlib (no dependency audit needed). You see:

```
[validator] Syntax OK — parsed with ast
[validator] ruff check passed (0 errors)
[validator] No external dependencies required
```

### Journal entry

A new entry lands in `.kimi/journals/JOURNAL.md`:

```markdown
## 2024-06-12 14:33:01 — csv_to_json.py
- **Prompt**: "Write a Python script that reads CSV and outputs JSON"
- **Agents**: python-pro (1)
- **Status**: completed
- **Files**: `csv_to_json.py`
- **Time**: 2.4s
```

Clean. Traceable. One sentence says it all.

---

## Step 2 — Nudge the orchestrator with inline directives

Sometimes you want more than the default. Say you're building a data pipeline and this CSV-to-JSON script is just the first piece — you want it documented, tested, and you want the orchestrator to know it might need help. You can override the orchestrator's defaults right in the prompt.

Run this:

```bash
kimable "@complexity:medium @effort:thorough @max-agents:3 Write a Python CLI that reads CSV, validates schemas with Pydantic, and outputs JSON or Parquet"
```

### What changed in the orchestrator's head

The orchestrator detects directives with a simple regex (`@(\w+):(\S+)`). Before classification, it overrides its internal defaults:

```
[orchestrator] Prompt received (89 tokens)
[orchestrator] Inline directives detected:
  - complexity: medium (override from simple)
  - effort: thorough (override from standard)
  - max-agents: 3 (override from 1)
[orchestrator] Classification: domain=python, complexity=medium, effort=thorough
[orchestrator] Plan: multi-agent, subagents=[python-pro, python-pro-reviewer]
[orchestrator] Phase 1: python-pro — implement CLI + Pydantic models
[orchestrator] Phase 2: python-pro-reviewer — review + add tests
[orchestrator] Dispatching phase 1...
```

Because you set `max-agents:3`, the orchestrator now has budget to bring in a reviewer. It still only needed two agents for this prompt, but it *could* have used a third if you'd asked for packaging or CI setup too.

### Subagent outputs

**Phase 1 — python-pro** returns a full CLI with `argparse`, `pydantic` models, and `pyarrow` for Parquet:

```python
import argparse
import csv
import json
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq
from pydantic import BaseModel, Field, ValidationError, create_model


def build_model_from_headers(headers: list[str]) -> type[BaseModel]:
    """Dynamically create a Pydantic model from CSV headers."""
    fields = {h: (str, Field(default="")) for h in headers}
    return create_model("CsvRow", **fields)


def read_csv(path: Path) -> tuple[list[str], list[dict[str, Any]]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames is not None
        return list(reader.fieldnames), list(reader)


def to_parquet(rows: list[dict], headers: list[str], out: Path) -> None:
    arrays = {h: pa.array([r.get(h) for r in rows]) for h in headers}
    table = pa.table(arrays)
    pq.write_table(table, out)


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert CSV to JSON or Parquet")
    parser.add_argument("input", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    parser.add_argument("-f", "--format", choices=["json", "parquet"], default="json")
    args = parser.parse_args()

    headers, rows = read_csv(args.input)
    model_cls = build_model_from_headers(headers)
    validated = [model_cls(**row).model_dump() for row in rows]

    if args.format == "json":
        args.output.write_text(json.dumps(validated, indent=2), encoding="utf-8")
    else:
        to_parquet(validated, headers, args.output)
    print(f"Wrote {len(validated)} rows to {args.output}")


if __name__ == "__main__":
    main()
```

**Phase 2 — python-pro-reviewer** adds a `tests/` directory with `pytest` cases and a `requirements.txt`:

```python
# tests/test_cli.py
import json
from pathlib import Path

import pytest

from csv_converter import read_csv, build_model_from_headers, main


def test_read_csv(tmp_path: Path):
    csv_file = tmp_path / "data.csv"
    csv_file.write_text("name,age\nAlice,30\nBob,25\n")
    headers, rows = read_csv(csv_file)
    assert headers == ["name", "age"]
    assert len(rows) == 2
```

### Validation

Now validation is stricter:

```
[validator] Syntax OK
[validator] ruff check passed
[validator] pytest tests/ — 4 passed, 0 failed
[validator] mypy — 0 errors
[validator] Dependencies: pydantic, pyarrow, pytest
```

### Journal entry

```markdown
## 2024-06-12 14:41:18 — csv_converter
- **Prompt**: "@complexity:medium @effort:thorough @max-agents:3 ..."
- **Agents**: python-pro, python-pro-reviewer (2 of 3 max)
- **Status**: completed
- **Files**: `csv_converter.py`, `tests/test_cli.py`, `requirements.txt`
- **Time**: 8.7s
```

Fun fact: I almost never use inline directives for truly simple stuff — but when I need tests, I reach for `@effort:thorough` like a reflex.

---

## Step 3 — Hand the orchestrator a plan file

For bigger projects, you don't want the orchestrator guessing the order of operations. You want phases, dependencies, and explicit agent assignments. That's what plan files are for.

Create `docs/example-plan.yaml`:

```yaml
project: "Next.js SaaS Starter"
phases:
  - id: 1
    name: "Scaffold Next.js 14 App Router project"
    agent: nextjs-developer
    outputs:
      - "app/layout.tsx"
      - "app/page.tsx"
      - "next.config.js"
      - "tsconfig.json"

  - id: 2
    name: "Set up Prisma schema and seed script"
    agent: backend-developer
    depends_on: [1]
    outputs:
      - "prisma/schema.prisma"
      - "prisma/seed.ts"

  - id: 3
    name: "Build auth pages with NextAuth.js"
    agent: nextjs-developer
    depends_on: [2]
    outputs:
      - "app/api/auth/[...nextauth]/route.ts"
      - "app/login/page.tsx"
      - "app/register/page.tsx"

  - id: 4
    name: "Review and unify TypeScript types"
    agent: typescript-reviewer
    depends_on: [1, 2, 3]
    outputs:
      - "types/index.ts"
```

Now run:

```bash
kimable "@plan-file:docs/example-plan.yaml Build the SaaS starter from the plan"
```

### Orchestrator behavior

The orchestrator switches into **plan execution mode**. Instead of classifying the prompt, it parses the YAML and topologically sorts the phases:

```
[orchestrator] Plan file detected: docs/example-plan.yaml
[orchestrator] Parsed 4 phases, 3 dependencies
[orchestrator] Execution order: 1 → 2 → 3 → 4
[orchestrator] Phase 1/4: nextjs-developer — "Scaffold Next.js 14 App Router project"
[orchestrator] Phase 1 outputs: [app/layout.tsx, app/page.tsx, next.config.js, tsconfig.json]
```

It waits for each phase to complete and validates the declared outputs before starting the next one.

### Realistic subagent output — nextjs-developer

Here's what the `nextjs-developer` subagent returns for Phase 1. This is a senior Next.js engineer speaking:

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SaaS Starter",
  description: "Generated by Kimable",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

And the `next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;
```

Note the `typedRoutes: true` — that's a senior-level detail you don't get from a generalist. The `nextjs-developer` knows App Router, knows TypeScript, and bakes in best practices without being asked.

### Validation per phase

```
[validator] Phase 1: All 4 outputs present
[validator] Phase 1: tsc --noEmit passed
[validator] Phase 2: prisma validate passed
[validator] Phase 3: next build passed (2 warnings, 0 errors)
[validator] Phase 4: No type regressions introduced
```

### Journal entry

```markdown
## 2024-06-12 15:02:44 — Next.js SaaS Starter
- **Prompt**: "@plan-file:docs/example-plan.yaml Build the SaaS starter from the plan"
- **Agents**: nextjs-developer, backend-developer, typescript-reviewer (3)
- **Status**: completed
- **Plan**: docs/example-plan.yaml (4 phases)
- **Files**: 8 files across app/, prisma/, types/
- **Time**: 31.2s
```

---

## Step 4 — Read the journal and logs

After a few runs, you'll want to know *what actually happened*. Kimable keeps two sources of truth.

### The journal — `.kimi/journals/JOURNAL.md`

This is the human-readable summary. Open it:

```bash
cat .kimi/journals/JOURNAL.md
```

You'll see a chronological log of every Kimable invocation in the project. Entries include the prompt, agents used, files touched, and timing. It's designed for quick scanning — `grep` it, `tail` it, whatever works for you.

Want just the last three entries?

```bash
tail -n 20 .kimi/journals/JOURNAL.md
```

### The logs — `.kimi/logs/`

Each run gets a timestamped subdirectory with the raw orchestrator decision log, subagent outputs, and validation results. Here's what a run directory looks like:

```
.kimi/logs/
  2024-06-12_14-33-01__csv_to_json/
    orchestrator.log
    python-pro__output.py
    validator.log
  2024-06-12_14-41-18__csv_converter/
    orchestrator.log
    python-pro__output.py
    python-pro-reviewer__output.py
    validator.log
  2024-06-12_15-02-44__saas_starter/
    orchestrator.log
    nextjs-developer__phase_1/
      output.tsx
      output.js
    backend-developer__phase_2/
      schema.prisma
      seed.ts
    ...
```

When something goes wrong, the `orchestrator.log` is where you look first. It has the full classification reasoning, directive parsing, and any errors the orchestrator caught before dispatch.

```bash
cat .kimi/logs/2024-06-12_15-02-44__saas_starter/orchestrator.log | grep "ERROR\|WARN"
```

---

## Step 5 — When the orchestrator says "I need help"

Some prompts are too big, too vague, or cross too many domains for the orchestrator to handle safely. In these cases, it **escalates** instead of guessing.

Try this prompt and see what happens:

```bash
kimable "Build a distributed event-sourcing platform with CQRS, a React dashboard, Kubernetes deployment, and a compliance audit trail"
```

### Orchestrator decision

The classifier flags this immediately:

```
[orchestrator] Prompt received (156 tokens)
[orchestrator] Classification: domains=[backend, frontend, devops, security], complexity=architectural
[orchestrator] Complexity score: 9.2/10 (threshold for auto-execution: 7.0)
[orchestrator] !! escalation_recommended !!
[orchestrator] Reason: Multi-domain architectural prompt with no plan file or constraints
[orchestrator] Action: HALT — prompt requires human review before dispatch
```

Kimable stops. It does **not** spin up 12 agents and hope for the best. Instead, it tells you exactly what's wrong and what to do next.

### What you see

```
╔══════════════════════════════════════════════════════════════╗
║  ESCALATION RECOMMENDED                                       ║
╠══════════════════════════════════════════════════════════════╣
║  This prompt spans 4 domains and has architectural scope.    ║
║                                                              ║
║  Suggested next steps:                                       ║
║  1. Break into smaller prompts with plan files               ║
║  2. Use @max-agents:N to constrain scope                   ║
║  3. Provide a plan file with explicit phases                 ║
║  4. Run with --draft to see agent assignments without execution║
╚══════════════════════════════════════════════════════════════╝

[orchestrator] Run halted. Use --force to override (not recommended).
```

### What you should do

Don't `--force` it. Seriously. I've seen people do that and end up with five different subagents all implementing their own event bus in incompatible ways.

Instead, pick one of the suggestions. The `--draft` flag is particularly useful:

```bash
kimable --draft "Build a distributed event-sourcing platform..."
```

This runs the classifier and shows you what agents it *would* dispatch, without actually doing it. Use that output to write a plan file.

---

## Step 6 — Paste a Claude todo list, let Kimable parse it

Maybe you've already sketched out work with Claude, Cursor, or just a text file. Kimable can ingest those loose todo lists and turn them into an actual plan.

Create a file `claude-todo.txt`:

```
- [ ] Set up Next.js project with App Router
- [ ] Configure Tailwind and shadcn/ui
- [ ] Build login page with OAuth
- [ ] Create dashboard with data table
- [ ] Add API route for /api/users
- [ ] Write tests for API routes
```

Run:

```bash
kimable "@claude-plan:claude-todo.txt Turn this todo list into a working app"
```

### Detection and parsing

The orchestrator has a dedicated parser for Claude-style todo lists. It recognizes markdown todo syntax (`- [ ]`, `- [x]`), numbered lists, and even bullet points without checkboxes. Here's the log:

```
[orchestrator] Claude plan file detected: claude-todo.txt
[orchestrator] Parser: claude-todo v1
[orchestrator] Extracted 6 tasks:
  1. "Set up Next.js project with App Router" → nextjs-developer
  2. "Configure Tailwind and shadcn/ui" → nextjs-developer
  3. "Build login page with OAuth" → nextjs-developer
  4. "Create dashboard with data table" → nextjs-developer
  5. "Add API route for /api/users" → backend-developer
  6. "Write tests for API routes" → python-pro-reviewer (fallback: typescript-reviewer)
[orchestrator] Inferred dependencies: 1 → 2 → 3, 1 → 4, 5 → 6
[orchestrator] Execution order: 1, 2, 5 → 3, 4, 6
```

The inferred dependencies here are worth a look: task 6 depends on task 5 because it references "API routes." The parser isn't just ordering by list position — it actually reads what you wrote.

### Execution

Kimable treats the parsed todo list like a plan file. It runs the tasks in dependency order, dispatching the right agent for each. If a task is too vague (like "Create dashboard with data table"), the agent asks for clarification inline instead of guessing wildly.

### Journal entry

```markdown
## 2024-06-12 15:28:09 — Claude Todo App Build
- **Prompt**: "@claude-plan:claude-todo.txt Turn this todo list into a working app"
- **Source plan**: claude-todo.txt (6 tasks)
- **Agents**: nextjs-developer, backend-developer, typescript-reviewer (3)
- **Status**: completed
- **Files**: 14 files
- **Time**: 42.1s
```

---

## Common pitfalls and how to avoid them

**Pitfall 1: Forgetting output validation**

You ran Kimable, got a file, and committed it without looking. Then CI failed because a missing import.

*Fix*: Always glance at the validator output. If Kimable says "ruff found 3 errors," open `.kimi/logs/` and check. The validator isn't just decorative — it's your first line of defense.

**Pitfall 2: Using `@max-agents:10` because "more is better"**

It isn't. Ten agents on a single prompt creates coordination overhead, conflicting styles, and merge conflicts in the output. Kimable's orchestrator is smart, but it can't read minds across ten parallel threads.

*Fix*: Start with the default. Use `@max-agents:3` only when the task clearly has distinct phases (e.g., "write code, then write tests, then review"). Reserve higher numbers for explicit plan files.

**Pitfall 3: Ignoring escalation warnings**

`--force` is there for a reason, but "I just want it to run" isn't that reason. Escalation exists because some prompts genuinely need human decomposition.

*Fix*: When you see `escalation_recommended`, run `--draft` first. It takes five seconds and shows you exactly what the orchestrator is worried about. Then write a plan file.

**Pitfall 4: Not naming files in prompts**

"Write a Python script" works for simple stuff. But if you have preferences — `src/main.py` vs `app.py`, or a specific naming convention — say so. The orchestrator passes your prompt verbatim to the subagent, and the subagent uses it as context.

*Fix*: Be specific: "Write `src/ingestor.py` that..." The file will land where you asked.

**Pitfall 5: Expecting the orchestrator to remember across runs**

Kimable doesn't have persistent cross-run memory. Each `kimable` invocation is independent. The journal tracks history, but the orchestrator doesn't "know" what you asked for yesterday unless you paste it into today's prompt.

*Fix*: Use plan files for multi-session work, or paste relevant context into each prompt. Keep a `PROJECT_CONTEXT.md` in your repo and reference it: `kimable "@context:PROJECT_CONTEXT.md Add pagination to the users table."`

---

And that's really it. Simple prompts, inline nudges, plan files, digging through logs, knowing when to back off — you've seen the whole toolkit. My own habit? I start loose and only tighten up when Kimable does something weird. Nine times out of ten, the default behavior is fine. Now go break something. (Use a test repo. I learned that the hard way.)
