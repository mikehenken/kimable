# The Kimable Orchestrator Spec

Version 1.0 | Status: Draft

## 1. Intent extraction

Every request that hits the orchestrator gets shredded into six discrete fields before any agent claims it. This happens once, upstream of planning, and the result becomes the contract every downstream component references.

**OBJECTIVE.** The single thing the user wants built, fixed, answered, or shipped. Write it like you're explaining to a teammate who missed the standup. Not a summary. A translation. If the user says "make the dashboard faster," the objective might be "reduce the analytics dashboard's initial paint time from 4.2s to under 1.5s without removing any existing widgets."

**SUCCESS_CRITERIA.** Measurable or observable conditions that tell us we're done. At least one, ideally three. "Tests pass" is weak. "All 47 existing Cypress tests pass, plus 3 new ones covering the pagination edge case" is strong. Success criteria are the answer to the question "how would we demo this?"

**CONSTRAINTS.** Hard boundaries. Budget, time, technology stack, compliance requirements, visible UI elements that must not change. Constraints are negotiable only by the user, never by the orchestrator. If a constraint says "no new dependencies," that blocks npm install just as surely as a firewall would.

**IMPLICIT_NEEDS.** What the user didn't say but will definitely complain about if missed. Security review for auth changes. Documentation for public API changes. Backwards compatibility for schema migrations. These are inferred from domain patterns, not guessed. The extraction engine maintains a mapping: when the domain is "payment processing," implicit needs include "PCI compliance check" and "audit log entry."

**DOMAINS.** The technical areas touched by this request. Backend, frontend, infrastructure, data science, legal, design. Domain count feeds directly into complexity scoring. A request touching "frontend + backend" scores differently than one touching "frontend + backend + ML pipeline + compliance."

**NEGATIVE_RULES.** The most dangerous field. These are things that must not happen, must not be produced, must not be attempted. They are not "preferences." They are hard constraints written in the negative. Examples: "Do not modify production database schemas," "Do not expose internal API keys in client-side code," "Do not generate synthetic data that resembles real user PII." The validation protocol (section 6) explicitly checks every deliverable against NEGATIVE_RULES. A violation is an automatic escalation, not a warning. The orchestrator treats a NEGATIVE_RULES breach the same way a compiler treats a syntax error: stop, surface, do not proceed.

Intent extraction is a single pass. No recursion, no refinement loops. If the input is ambiguous, the extraction notes the ambiguity in the OBJECTIVE field and flags it for the gap analysis protocol. The output of this phase is a structured intent object that every subsequent stage reads but never mutates.

## 2. Configuration system

Kimable accepts configuration through three channels, merged with explicit precedence:

```
inline directives > YAML file > environment variables > built-in defaults
```

**Inline directives** appear inside the user's prompt, prefixed with `@`. They look like this:

```
@complexity:5 @effort:thorough @max_agents:3
Build me a thing that does stuff...
```

Only one directive per `@` prefix. Unknown directives are logged and ignored, not errored. The parser is greedy: `@complexity:5` is valid, `@complexity: 5` (space after colon) is invalid and treated as plain text.

**Environment variables** use the prefix `KIMABLE_`. `KIMABLE_COMPLEXITY=5`, `KIMABLE_EFFORT=minimal`, `KIMABLE_MAX_AGENTS=1`. These are read at startup and cached for the session.

**YAML defaults** live in `.kimable/defaults.yaml` or a path specified by `KIMABLE_CONFIG_PATH`. This file defines baseline values for the workspace.

**Built-in defaults** are the final fallback. They favor safety over speed.

Configuration keys:

**COMPLEXITY.** Integer 1-10. Overrides the computed complexity score if provided. Use this when the user knows something the scoring heuristic does not. A PR that touches twelve files but is pure boilerplate might warrant `@complexity:3` even though step count suggests higher.

**EFFORT.** One of `minimal`, `balanced`, `thorough`. See section 4 for definitions.

**MAX_ITERATIONS.** Hard ceiling on how many times the orchestrator can re-plan or self-correct. Default: 3. This is a guardrail, not a suggestion. Once hit, the orchestrator must produce an escalation JSON (section 8) rather than looping indefinitely.

**MAX_AGENTS.** Upper bound on concurrent subagents. Default: 5. The orchestrator may allocate fewer based on complexity and effort, never more.

**SUBAGENTS.** Boolean, default true. When false, the orchestrator handles the request itself without spawning subagents. Useful for simple tasks where handoff overhead exceeds execution time.

**PLAN_FILE.** Path to a plan file (section 9). If set, the orchestrator skips its own planning phase and uses the provided plan directly. Still validates against intent.

**DO_D.** Path to a definition-of-done file, or inline text. Supports run-level DoD injection. See section 7.

**OUTPUT_FORMAT.** One of `json`, `markdown`, `silent`. Default: `json`. `silent` suppresses all non-error output, used in CI pipelines where only exit codes matter.

**YOLO.** Boolean, default false. When true, the orchestrator skips non-critical validation steps and does not pause for human confirmation on escalations. Named honestly. Use it when you're iterating fast and accept the risk of garbage output.

Precedence is evaluated left-to-right at request time. An inline `@complexity:8` beats a `KIMABLE_COMPLEXITY=5` env var, which beats a `complexity: 3` in YAML, which beats the default of `auto`.

## 3. Complexity scoring

When the user does not override COMPLEXITY, the orchestrator computes a score from 1 to 10 across five dimensions. Each dimension contributes 0-2 points. The sum is the score.

**Domain count (0-2).** How many distinct technical domains the request touches.
- 1 domain: 0 points
- 2 domains: 1 point
- 3+ domains: 2 points

A request that stays entirely within the React frontend is 0. One that needs a backend API change and a database migration is 1. One that adds a new ML model, exposes it via API, updates the web UI, and requires a DevOps deployment pipeline change is 2.

**Step count (0-2).** Estimated sequential steps required.
- 1-2 steps: 0 points
- 3-5 steps: 1 point
- 6+ steps: 2 points

Steps are the sequential checkpoints in a plan, not parallel tasks. If three subagents can work simultaneously, that counts as one step.

**Novelty (0-2).** How much of this is new versus familiar.
- Entirely within established patterns: 0 points
- Mix of familiar and new: 1 point
- Pioneering, no prior art in the codebase: 2 points

Novelty is judged against the workspace's own history, not against the internet. Adding a Redis cache to a project that already uses Redis is 0. Adding Redis to a project that has never used caching is 1. Inventing a new consensus algorithm is 2.

**Risk (0-2).** Blast radius if something goes wrong.
- Local impact, easily reverted: 0 points
- Multi-user or data-affecting, requires rollback plan: 1 point
- Production-critical, legal/compliance exposure, irreversible: 2 points

**Coordination (0-2).** How tightly coupled the work is.
- Single contributor, no dependencies: 0 points
- Requires sequencing across 2-3 contributors: 1 point
- Tight coordination, shared state, synchronous handoffs: 2 points

The final score interpretation:

- **1-3 Simple:** The orchestrator handles this itself. Subagents only if explicitly requested. One-shot execution, no checkpointing beyond the final validation.
- **4-7 Medium:** Subagents engaged. Planning phase runs. Checkpoint at each step. Validation runs after each subagent returns.
- **8-10 Escalates:** Human review required before execution. The orchestrator produces a plan and an escalation JSON, then stops. Execution proceeds only after explicit human signal. At 10, even planning assistance is limited: the orchestrator suggests structure but refuses to generate implementation details until cleared.

Complexity is computed once, after intent extraction and before planning. It does not mutate during execution. If a task turns out harder than expected, that's an escalation event, not a score update.

## 4. Effort levels

Effort controls depth, not speed. A `minimal` effort on a complex task still takes longer than `minimal` on a simple task. The levels define what "done" looks like at each layer.

**minimal.** Do the thing. Make it work. No polish, no edge-case gardening, no documentation beyond inline comments that explain why non-obvious choices were made. Tests: only the one that proves the happy path. Review: self only. This is the "skateboard" in the skateboard-to-car metaphor. It rolls. It does not have brakes.

Use minimal for: spikes, proofs of concept, internal tooling that three people use, fixes where the bug is embarrassing and the fix is obvious.

**balanced.** The default. Do the thing well. Cover the 80% use case robustly. Handle expected edge cases. Write enough documentation that someone else could maintain it without calling you. Tests cover the contract surface: inputs, outputs, error paths. Review by one other agent or human. Refactor if the code is genuinely confusing, not if it merely offends your aesthetic sensibilities.

Use balanced for: feature work, user-facing changes, anything that lives in production but is not on the critical path.

**thorough.** Do the thing completely. Exhaustive edge-case analysis. Fuzzing if inputs are untrusted. Load testing if performance matters. Documentation that answers "why" and "what if." Cross-team review. Audit trails. Rollback procedures verified in a staging environment. The code you write when you know someone will read it in a post-mortem.

Use thorough for: financial transactions, auth systems, data migrations, anything legally regulated, anything that cannot fail in production.

Effort applies recursively. A `thorough` task with three subagents means each subagent operates at `thorough` depth. The orchestrator does not mix levels within a single request.

## 5. Gap analysis protocol

Before any agent writes code, the orchestrator checks for gaps between what the user asked for and what the system understands. This is the gap analysis protocol. It has three phases.

**Phase 1: handoff.md read.** If the workspace contains a `handoff.md` file, the orchestrator reads it. This file contains context the user wants injected into every request: architecture decisions, conventions, current blockers, tribal knowledge. It is not a replacement for documentation. It is the stuff that never made it into documentation. If `handoff.md` does not exist, the protocol continues without error.

**Phase 2: Contract extraction.** The orchestrator produces a contract document from the extracted intent: OBJECTIVE, SUCCESS_CRITERIA, CONSTRAINTS, IMPLICIT_NEEDS, DOMAINS, NEGATIVE_RULES. This is the "understood requirements" snapshot.

**Phase 3: Mismatch checking.** The orchestrator compares the contract against:
- The handoff.md context (would this request violate anything in handoff?)
- Historical plan files in the workspace (has something similar been attempted before? Did it fail?)
- The actual codebase state (are the files the user references the files that exist?)

Mismatches are classified:
- **BLOCKING:** The request cannot proceed without clarification. Example: user references `src/auth.js`, which was deleted two weeks ago. The orchestrator stops and produces an escalation JSON.
- **WARNING:** The request can proceed but carries risk. Example: user asks for a feature that handoff.md says is "pilot-only until Q3." The orchestrator proceeds but adds a WARNING annotation to the plan.
- **INFO:** Interesting but non-actionable. Example: a similar feature was built six months ago in a different module. The orchestrator notes it for potential reuse.

Gap analysis runs in under two seconds. If it cannot complete in that window, it times out and the orchestrator treats the result as "no blocking mismatches found, one WARNING for incomplete analysis."

## 6. Validation protocol

Every deliverable — whether from a subagent or the orchestrator itself — passes through an 8-point checklist before it is considered complete.

**1. Objective alignment.** Does the output do what the OBJECTIVE field says? Not "sort of." Not "it's a start." The exact thing.

**2. Success criteria met.** Every item in SUCCESS_CRITERIA is verified. If a criterion says "response time under 200ms," there is a measurement or a benchmark proving it.

**3. Constraints respected.** No constraint in CONSTRAINTS was violated. If the constraint was "no new dependencies," the checklist verifies package.json or equivalent is unchanged.

**4. Implicit needs addressed.** Every inferred implicit need was either handled or explicitly deferred with a documented reason. "Didn't have time" is not a reason. "Not applicable because this endpoint is internal-only and the audit requirement applies only to public endpoints" is a reason.

**5. Negative rules check.** The critical one. Every NEGATIVE_RULE is checked against the output. This is a text search, a semantic check, and where possible, a static analysis pass. "Do not log PII" triggers a scan for patterns that look like email addresses, phone numbers, or names in log statements. A failure here is an automatic rejection. The deliverable does not move forward. It gets returned to the producing agent with the violated rule quoted verbatim.

**6. Output format compliance.** The deliverable matches the requested OUTPUT_FORMAT. If JSON was requested, the output parses as JSON and contains the expected schema fields.

**7. Effort level adequacy.** The depth of the output matches the EFFORT configuration. A `thorough` request with no tests fails here. A `minimal` request with a fifty-page design document also fails here — over-delivering can be as disruptive as under-delivering.

**8. Plan file consistency.** If a PLAN_FILE was provided, the deliverable follows it. No steps skipped, no steps reordered, no phantom steps invented.

The checklist is run by the orchestrator, not delegated to subagents. Subagents are responsible for producing good work; the orchestrator is responsible for verifying it. Each check produces a pass/fail/uncertain result. Two or more failures means the deliverable is rejected and returned for rework. One failure means it is accepted with a WARNING annotation. "Uncertain" is treated as "needs human review" unless YOLO mode is on.

## 7. DoD system

Definition of Done in Kimable operates at two levels: run-level and task-level. Both are injected, not inferred.

**Run-level DoD** applies to the entire execution. It is loaded from:
1. The `DO_D` configuration value, if set
2. `.kimable/dod.yaml` in the workspace, if it exists
3. A built-in default that covers basic hygiene: "code compiles, tests pass, no lint errors, negative rules clean"

Run-level DoD is checked after all subagents complete and before final output generation.

**Task-level DoD** applies to individual subagent tasks. It is specified in the plan file or generated by the orchestrator during planning. Task-level DoD is checked when a subagent returns its deliverable, before the orchestrator marks that task complete.

DoD items are simple strings, interpreted as assertions. The orchestrator checks them literally when possible, semantically when not. "All new functions have docstrings" can be checked with a regex. "Code is idiomatic" requires the orchestrator's judgment or a human reviewer.

If a DoD item cannot be verified automatically, it is marked as "manual check required" and surfaced in the output. The orchestrator does not guess. A DoD item that says "security review completed" with no evidence of a review in the workspace is a failure, not a "probably fine."

DoD injection happens at planning time. The orchestrator takes the loaded run-level DoD, appends any task-specific items, and presents the merged list to each subagent as part of its task brief. Subagents agree to the DoD by accepting the task. This is the contract.

## 8. Output formats

Kimable produces three structured output formats, all JSON. The orchestrator never streams partial JSON. It buffers, validates, and emits complete documents.

**Completed JSON.** The happy path. Emitted when all validation passes.

```json
{
  "status": "completed",
  "request_id": "uuid-v4-here",
  "intent": {
    "objective": "string",
    "success_criteria": ["string"],
    "constraints": ["string"],
    "implicit_needs": ["string"],
    "domains": ["string"],
    "negative_rules": ["string"]
  },
  "complexity": 5,
  "effort": "balanced",
  "plan_summary": "One-sentence description of what was done",
  "deliverables": [
    {
      "type": "file|command|url|text",
      "path": "relative/path/or/command/string",
      "description": "What this deliverable is"
    }
  ],
  "validation_results": {
    "objective_alignment": "pass",
    "success_criteria_met": "pass",
    "constraints_respected": "pass",
    "implicit_needs_addressed": "pass",
    "negative_rules_clean": "pass",
    "output_format_compliant": "pass",
    "effort_adequacy": "pass",
    "plan_consistency": "pass"
  },
  "dod_check": {
    "run_level": "pass",
    "task_level": "pass"
  },
  "warnings": [],
  "execution_time_seconds": 42
}
```

**Escalation JSON.** Emitted when complexity is 8+, when the user explicitly requests human review, or when validation finds blocking issues.

```json
{
  "status": "escalated",
  "request_id": "uuid-v4-here",
  "escalation_reason": "One of: complexity_threshold, human_requested, validation_failure, negative_rules_violation, ambiguity_detected, max_iterations_reached",
  "intent": { ...same as completed... },
  "proposed_plan": {
    "steps": [
      {
        "step_number": 1,
        "description": "What this step does",
        "agent_type": "orchestrator|specialist|human_required",
        "estimated_complexity": 5
      }
    ],
    "estimated_total_time": "4 hours",
    "risks": ["What could go wrong"]
  },
  "blockers": [
    {
      "type": "missing_info|technical_debt|permission|ambiguity",
      "description": "What's in the way",
      "resolution_path": "What would unblock this"
    }
  ],
  "human_action_required": true,
  "safe_to_proceed_after": "description of what the human needs to provide"
}
```

The `proposed_plan` in an escalation JSON is a suggestion, not a commitment. The human approves, modifies, or rejects it.

**Error JSON.** Emitted when something breaks in the orchestrator itself, not when a subagent fails. Subagent failures are retried or escalated. Orchestrator failures are errors.

```json
{
  "status": "error",
  "request_id": "uuid-v4-here",
  "error_code": "ORCHESTRATOR_INIT_FAILED|INTENT_EXTRACTION_FAILED|PLAN_GENERATION_FAILED|VALIDATION_TIMEOUT|CONFIG_PARSE_ERROR|NEGATIVE_RULES_ENFORCED|UNKNOWN",
  "error_message": "Human-readable description",
  "recoverable": true,
  "suggested_action": "What the user can try",
  "partial_output": null
}
```

When `recoverable` is true, the user can retry with adjusted parameters. When false, it is a bug in the orchestrator or an environment issue.

All three schemas include `request_id` for tracing. The orchestrator generates this at intent extraction time and includes it in every log line.

## 9. Plan file support

The orchestrator can ingest external plans instead of generating its own. Three formats are supported, detected automatically by content inspection.

**Format 1: Kimable YAML**

```yaml
kimable_plan:
  version: 1
  objective: "refactor auth middleware"
  steps:
    - id: 1
      description: "Extract JWT validation into standalone module"
      agent: backend
      inputs: ["src/middleware/auth.js"]
      outputs: ["src/lib/jwt-validator.js"]
      dod: ["100% test coverage on new module", "no regression in existing auth tests"]
    - id: 2
      description: "Update all middleware imports"
      agent: backend
      depends_on: [1]
      inputs: ["src/middleware/auth.js"]
      outputs: ["src/middleware/auth.js"]
      dod: ["all existing tests pass"]
  negative_rules:
    - "Do not change the JWT secret configuration format"
```

Detection: file contains `kimable_plan:` at the root level.

**Format 2: Freeform Markdown**

Any markdown file with a structure the orchestrator can interpret. It looks for headers, numbered lists, and code blocks. The parser is permissive.

```markdown
# Plan: Add Dark Mode

## Step 1: CSS Variables
Add CSS custom properties to `styles/main.css`.
- Input: `styles/main.css`
- Output: `styles/main.css`

## Step 2: Theme Toggle Component
Build a React toggle in `components/ThemeToggle.jsx`.
```

Detection: markdown file with two or more level-2 headers containing words like "step," "task," or "phase."

**Format 3: Claude Plans**

The XML-ish format that Claude Code sometimes generates:

```xml
<plan>
  <step id="1">
    <description>Audit current dependencies</description>
    <file>package.json</file>
  </step>
</plan>
```

Detection: file starts with `<plan>` or contains `<step>` tags.

**Detection logic**

The orchestrator attempts detection in order: Kimable YAML, Claude Plans, Freeform Markdown. The first match wins. If no format matches, the file is treated as plain text and the orchestrator extracts what it can, logging a WARNING.

When a plan file is loaded, the orchestrator:
1. Parses the steps
2. Extracts negative rules if present
3. Merges file-level negative rules with intent-extracted negative rules (union, not override)
4. Validates that all inputs referenced in the plan exist (gap analysis)
5. Assigns each step to an agent type based on file paths or explicit agent tags
6. Checks for circular dependencies between steps
7. Produces an internal plan object identical in structure to an orchestrator-generated plan

From this point, execution proceeds normally. The orchestrator does not care whether a plan was authored by a human, another AI, or itself.

## 10. Self-correction loop

Before the orchestrator returns any output — completed, escalated, or error — it performs one final action: it re-reads the original user request verbatim.

The self-correction loop works like this:

1. The orchestrator retrieves the original request text as received, before any parsing or extraction.
2. It compares its planned or executed work against this raw text.
3. It asks: "Did I actually do what the user asked, or did I do something adjacent?"
4. It checks for scope creep (did I add a feature that was not requested?) and scope shrink (did I skip a requirement that was implicit in the wording?).

This is not a full re-execution. It is a final sanity check that takes the orchestrator's own output and asks whether it answers the user's original question.

If the loop detects a mismatch, the orchestrator:
- Scores the severity: minor drift (fixable in output framing), moderate drift (requires additional work), major drift (the whole plan was wrong).
- Minor drift: adjust the output text or add a clarification note.
- Moderate drift: if MAX_ITERATIONS has not been reached, spawn a correction task. If MAX_ITERATIONS has been reached, escalate.
- Major drift: escalate immediately with the mismatch described in the escalation JSON.

The self-correction loop is the last thing that runs. It runs even when YOLO mode is on. YOLO skips human confirmations, not internal verification.

---

This specification is the contract. Implementations may optimize, cache, or parallelize, but they must produce observably identical behavior for every scenario described above. If an implementation finds an ambiguity in this document, it escalates rather than guessing.
