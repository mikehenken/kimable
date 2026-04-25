# Kimable Integration Test Results

**Run date:** 2025-06-24  
**Test suite:** `integration/`  
**Runner:** `pytest tests/integration/ -x --tb=short`  
**Total tests:** 10 core + 4 error injection  
**Outcome:** 13 PASS, 1 ESCALATION (by design)

---

## Notes before you read this

These tests were run against the `v0.3.1` tag. A couple things up front:

- Test 4 (the architecture one) is *supposed* to escalate. If it hadn't, that would be a failure.
- We had a flaky first run on Test 9 because the `max-iterations` counter was off by one. Fixed in `src/runner.py` line 212 before the second run.
- The garbage-output test (Test 10) actually surfaced a real bug where the retry counter didn't reset after a successful swap. Patched that too.

Okay, on to the details.

---

## Core Integration Tests

### Test 1: Simple Script — CSV to JSON

| Field | Value |
|---|---|
| **Prompt** | "Write a Python script that reads CSV and outputs JSON" |
| **Score** | 2 |
| **Subagent** | `python-coder` |
| **Config** | Default (`complexity: auto`, `effort: standard`, `max-agents: 2`) |
| **Result** | **PASS** |

Straightforward. The scorer gave it a 2, the router handed it to `python-coder`, and we got back a clean `csv_to_json.py` with `argparse`, `csv.DictReader`, and `json.dump`. No issues.

**Notes:** None. First run, clean output.

---

### Test 2: Medium — Codebase Exploration (CopilotKit)

| Field | Value |
|---|---|
| **Prompt** | "Explore the CopilotKit example in `/examples/copilotkit/` and explain how the frontend hooks into the backend" |
| **Score** | 5 |
| **Subagent** | `code-explorer` |
| **Config** | Default |
| **Result** | **PASS** |

The scorer correctly identified this as a 5 — not hard to execute, but requires reading multiple files and understanding the relationship between `useCopilotAction` and the runtime endpoint. `code-explorer` walked the tree, read 7 files, and returned a coherent summary with file references.

**Notes:** One minor thing — the agent initially tried to read a file that had been deleted in a recent refactor (`examples/copilotkit/old-backend.ts`). It got a 404 from the read tool, logged it, and moved on. We should probably clean up that ghost file, but the test itself passed.

---

### Test 3: Medium — Feature Implementation (Next.js Profile Page)

| Field | Value |
|---|---|
| **Prompt** | "Add a user profile page to the Next.js app in `/apps/web/`. It should show avatar, name, bio, and an edit form. Use the existing design system." |
| **Score** | 6 |
| **Subagent** | `react-dev` (primary), `css-stylist` (secondary) |
| **Config** | Default, 2 agents allowed |
| **Result** | **PASS** |

Scored a 6 because it touches routing, UI components, and form state. `react-dev` handled the page structure and data fetching, then called in `css-stylist` for the Tailwind classes to match the existing card components. Both agents committed to the same branch cleanly.

**Notes:** The two agents stepped on each other once — both tried to add a route to `apps/web/src/app/routes.ts`. The merge tool caught the conflict and replayed the second edit with the combined routes. We should make the route-append operation atomic, but the recovery worked.

---

### Test 4: Complex — Architectural (Microservices Design)

| Field | Value |
|---|---|
| **Prompt** | "Design a new microservices architecture for our billing platform. Include service boundaries, data ownership, event schema, and deployment topology." |
| **Score** | 9 |
| **Subagent** | N/A — escalated to human |
| **Config** | Default |
| **Result** | **ESCALATION** (correct behavior) |

Scored a 9 because of the scope, ambiguity, and business risk. The system triggered an escalation instead of assigning a subagent. Human got a structured briefing with the prompt, complexity breakdown, and suggested architects to pull in.

**Notes:** The escalation email template was missing the `estimated_hours` field. Fixed the Jinja template in `templates/escalation.md.j2` before re-running. Second run looked good.

---

### Test 5: Medium — DevOps (GitHub Actions CI)

| Field | Value |
|---|---|
| **Prompt** | "Set up GitHub Actions CI for the repo. Needs lint, test, and build jobs. Use Node 20. Cache dependencies." |
| **Score** | 5 |
| **Subagent** | `devops-engineer` |
| **Config** | Default |
| **Result** | **PASS** |

Scored a 5. It's not a hard task, but it requires knowing the repo's package manager, test runner, and build command. `devops-engineer` read `package.json`, found `pnpm`, and emitted a `.github/workflows/ci.yml` with matrix builds for ubuntu-latest and a cache key based on `pnpm-lock.yaml`.

**Notes:** The agent defaulted to `npm ci` at first, then self-corrected after reading the lockfile. Good sign that the exploration loop is working.

---

### Test 6: Simple — Research (React Server Components)

| Field | Value |
|---|---|
| **Prompt** | "Best practices for React Server Components 2026" |
| **Score** | 2 |
| **Subagent** | `researcher` |
| **Config** | Default |
| **Result** | **PASS** |

Scored a 2 — pure information gathering, no code changes. `researcher` returned a concise markdown doc with 8 practices, source links, and a "deprecated" note on one 2024 pattern that changed in the latest React docs.

**Notes:** The output was well-structured but the links section used bare URLs instead of markdown link syntax. We don't enforce formatting on research tasks, so this is just an observation, not a failure.

---

### Test 7: Config Override — `@complexity:simple @effort:minimal @max-agents:1`

| Field | Value |
|---|---|
| **Prompt** | "Write a Python script that reads CSV and outputs JSON" (same as Test 1, but with override tags in the prompt) |
| **Score** | 2 (override forced simple) |
| **Subagent** | `python-coder` |
| **Config** | `complexity: simple`, `effort: minimal`, `max-agents: 1` |
| **Result** | **PASS** |

The scorer would have given this a 2 anyway, but the override tags forced `effort: minimal` and capped agents at 1. Output was slightly less commented than Test 1, and no secondary review agent was summoned. The script still worked.

**Notes:** Confirmed that `max-agents: 1` actually prevents any secondary agent calls. The `effort: minimal` flag correctly skips the self-review step.

---

### Test 8: Plan File — `@plan-file:docs/example-plan.yaml`

| Field | Value |
|---|---|
| **Prompt** | "Implement the feature described in the plan file" |
| **Score** | 4 (from plan metadata) |
| **Subagent** | `react-dev` |
| **Config** | Plan file overrides some defaults; `plan: docs/example-plan.yaml` |
| **Result** | **PASS** |

The plan file (`docs/example-plan.yaml`) specified 3 steps: add API route, add UI component, add tests. The runner parsed the YAML, validated steps against available subagents, and handed each step to `react-dev` in sequence. All three completed.

**Notes:** The plan file had a typo in step 2 — `compoent` instead of `component`. The YAML loader didn't care, but it looked sloppy. Fixed the example file for future runs. Also, the runner doesn't currently validate that plan step outputs chain correctly; it just runs them in order. That seems fine for now.

---

### Test 9: Thorough Effort — `@effort:thorough @max-iterations:5`

| Field | Value |
|---|---|
| **Prompt** | "Refactor the auth middleware in `/apps/api/src/middleware/auth.ts` to use RBAC. Add tests." |
| **Score** | 6 |
| **Subagent** | `typescript-dev` |
| **Config** | `effort: thorough`, `max-iterations: 5` |
| **Result** | **PASS** |

This one needed the fix mentioned up top. First run: the agent hit the 5th iteration, made a small fix, and the runner declared "max iterations exceeded" anyway. The counter was initialized to 0 but checked as `> max_iterations` instead of `>= max_iterations` at the validation stage.

Fixed `src/runner.py` line 212. Second run: agent used all 5 iterations, did a self-review on iteration 4, applied a final polish on 5, and finished clean.

**Notes:** With `effort: thorough`, the agent writes tests *before* the refactor. That added about 40 seconds to the run, but the output was solid.

---

### Test 10: Error Recovery — Garbage Output

| Field | Value |
|---|---|
| **Prompt** | "Fix the typo in `README.md`" (deliberately engineered to trigger a hallucinated response from the mock subagent) |
| **Score** | 1 |
| **Subagent** | `mock-garbage` (injected for this test), then `generic-editor` |
| **Config** | Default |
| **Result** | **PASS** |

We injected a mock subagent that returns base64 garbage on the first two calls. The runner:

1. Try 1: Garbage detected (invalid JSON, non-UTF8). Logged error. Retry.
2. Try 2: More garbage. Logged error. Retry.
3. Try 3: Swapped to `generic-editor` fallback. Clean output.

**Notes:** This surfaced the retry-counter bug. After the successful swap, if a *later* task in the same session also failed, it started at try 3 instead of try 1. Fixed by resetting the retry counter on agent swap in `src/runner.py` line 178. Also added a test to cover that specifically — see `tests/unit/test_retry_reset.py`.

---

## Error Injection Tests

These tests don't go through the normal prompt → score → route flow. We inject failures at specific layers and check recovery.

### E1: Subagent Returns Garbage

**Injection:** Override `subagent.call()` to return random bytes for 2 attempts, then normal output on the 3rd.  
**Expected:** Retry twice, then succeed or swap.  
**Result:** **PASS**

Observed exactly the behavior from Test 10. Logs show clear retry markers. The `retry_context` struct now includes a `failure_reason` field (added after this test) to make debugging easier.

---

### E2: Tool Execution Fails

**Injection:** Force the `write_file` tool to raise `PermissionError` on the first call, then succeed.  
**Expected:** Log the error, replan the tool call, continue.  
**Result:** **PASS**

The agent caught the exception, emitted an error log entry, and re-issued the tool call. The replan step took about 200ms. One note: the error log didn't include the tool name, just the exception string. Fixed in `src/tools/wrapper.py` to include `tool_name` in the structured log.

---

### E3: Context Overflow

**Injection:** Feed the agent a 200k-token prompt (synthetic repeated text).  
**Expected:** Summarize context to file, reference in new prompt, continue without crash.  
**Result:** **PASS**

The runner detected the oversized prompt (using a fast tokenizer count), wrote a summary to `.kimable/context-summaries/summary-20250624-001.md`, and replaced the bulk input with a reference: "See `.kimable/context-summaries/summary-20250624-001.md` for full context." The agent read the summary file and continued normally.

**Notes:** The summary file wasn't being cleaned up after the run. Added a `finally` block in `src/context/manager.py` to delete summaries older than 24 hours. We should probably make the retention configurable.

---

### E4: Max Iterations Exceeded

**Injection:** Set `max-iterations: 2` on a task that needs at least 4 (multi-step refactor).  
**Expected:** Return a structured error JSON and stop gracefully.  
**Result:** **PASS**

Runner returned:

```json
{
  "status": "error",
  "error_type": "max_iterations_exceeded",
  "message": "Agent did not complete within 2 iterations.",
  "partial_output": "<base64-encoded partial result>",
  "suggestion": "Increase max-iterations or break task into smaller steps."
}
```

The caller got a clean error object. No dangling processes, no half-written files. Good.

---

## Minor Issues Found and Fixed During This Run

1. **Off-by-one iteration check** (`src/runner.py:212`) — `>` vs `>=`. Fixed.
2. **Retry counter not reset on swap** (`src/runner.py:178`) — Fixed.
3. **Escalation template missing `estimated_hours`** (`templates/escalation.md.j2`) — Fixed.
4. **Tool error log missing tool name** (`src/tools/wrapper.py`) — Fixed.
5. **Context summary cleanup** (`src/context/manager.py`) — Added 24h retention. Needs config hook later.
6. **Typo in example plan file** (`docs/example-plan.yaml`) — Fixed.

---

## Summary

| Test | Result |
|---|---|
| 1 — Simple CSV→JSON | PASS |
| 2 — CopilotKit exploration | PASS |
| 3 — Next.js profile page | PASS |
| 4 — Microservices architecture | ESCALATION (by design) |
| 5 — GitHub Actions CI | PASS |
| 6 — React Server Components research | PASS |
| 7 — Config override | PASS |
| 8 — Plan file | PASS |
| 9 — Thorough effort / max iterations | PASS |
| 10 — Garbage output recovery | PASS |
| E1 — Garbage injection | PASS |
| E2 — Tool failure injection | PASS |
| E3 — Context overflow | PASS |
| E4 — Max iterations exceeded | PASS |

**All tests passed or escalated as expected.**

The only real code changes came from the error-injection tests surfacing real bugs, which is exactly what that suite is for. We'll re-run the full suite after the `v0.3.2` release to make sure nothing regressed.

— QA, Kimable team
