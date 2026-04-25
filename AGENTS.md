# Agent catalog

Here's the full roster of 14 Kimable subagents. If you're not sure who to call, the orchestrator will figure it out for you.

---

### web-dev

Frontend code, React components, CSS tweaks, DOM manipulation.

**Call them when:** Anything the user actually sees. Buttons, forms, layouts, animations.

- Writes JSX, Vue, Svelte, or plain HTML/CSS
- Handles responsive breakpoints and accessibility attributes
- Reads design tokens from a config file
- Updates routes and navigation

**Tools:** file_read, file_write, browser_visit, shell

---

### api-dev

Backend endpoints, middleware, auth, data flow.

**Call them when:** New routes, changed schemas, auth logic, rate limiting.

- Writes REST and GraphQL handlers
- Validates request bodies and query params
- Handles error responses and status codes
- Generates OpenAPI specs from code

**Tools:** file_read, file_write, shell, data_source

---

### data-science

Notebooks, data cleaning, visualization, model training.

**Call them when:** CSV exploration, training scripts, dashboards, EDA.

- Reads pandas, polars, or SQL result sets
- Generates matplotlib, plotly, or seaborn charts
- Writes training loops and evaluation metrics
- Saves outputs to predictable paths

**Tools:** file_read, file_write, ipython, shell

---

### security

Audits, scanning, dependency checks, threat modeling.

**Call them when:** Before a release, after adding dependencies, or when something feels off.

- Scans `package.json`, `requirements.txt`, `Cargo.toml` for CVEs
- Reviews auth logic for common flaws
- Checks for secrets in code or env files
- Catches unsafe defaults in config files

**Tools:** file_read, shell, web_search

---

### devops

Docker, CI/CD, deploy scripts, infrastructure as code.

**Call them when:** New service setup, broken builds, AWS/GCP/Azure wrangling.

- Writes Dockerfiles and docker-compose files
- Configures GitHub Actions, GitLab CI, or CircleCI
- Manages Terraform or Pulumi stacks
- Debugs failed deployments from logs

**Tools:** file_read, file_write, shell, web_search

---

### docs

READMEs, docstrings, API documentation, changelogs.

**Call them when:** After a feature ships, when onboarding is painful, or the README is three versions behind.

- Updates markdown docs with accurate examples
- Generates docstrings from function signatures
- Keeps API docs in sync with route changes
- Writes migration guides for breaking changes

**Tools:** file_read, file_write, web_search

---

### test

Unit tests, integration tests, fixtures, mocking.

**Call them when:** New feature needs coverage, bug needs a regression test, or CI is red.

- Writes Jest, pytest, vitest, or go test suites
- Creates test data and factory fixtures
- Mocks external APIs and databases
- Targets the files most likely to break

**Tools:** file_read, file_write, shell, ipython

---

### refactor

Dead code removal, renames, structural reorganization.

**Call them when:** Code is hard to read, imports are circular, or something has three names.

- Removes unused functions and imports
- Renames variables and files across the codebase
- Extracts duplicated logic into shared utilities
- Keeps tests passing while moving code around

**Tools:** file_read, file_write, shell

---

### design

UI/UX reviews, accessibility, spacing, color, typography.

**Call them when:** Something looks wrong, contrast is off, or navigation is confusing.

- Audits color contrast and font sizes
- Checks keyboard navigation and screen reader labels
- Suggests layout improvements with specific CSS
- Brings up WCAG guidelines when they matter

**Tools:** file_read, file_write, browser_visit, browser_screenshot

---

### research

Deep dives, RFCs, comparisons, due diligence.

**Call them when:** You don't know which library to pick, or you need to understand a protocol.

- Searches the web for current best practices
- Compares tools with specific criteria (speed, license, maintenance)
- Reads academic papers and technical blogs
- Summarizes everything in a decision table

**Tools:** web_search, web_search_serper, scholar, arxiv, browser_visit

---

### migration

Framework upgrades, database migrations, language rewrites.

**Call them when:** React 17 -> 18, Python 3.10 -> 3.12, or moving off a deprecated library.

- Plans upgrade steps with rollback options
- Runs codemods and automated converters
- Updates dependency files and lockfiles
- Makes sure tests pass after the move

**Tools:** file_read, file_write, shell, browser_visit

---

### debug

Error tracing, log analysis, root cause investigation.

**Call them when:** Something is broken and you don't know why.

- Reads stack traces and error logs
- Traces data flow through multiple files
- Suggests specific breakpoints or print statements
- Reproduces issues with minimal test cases

**Tools:** file_read, shell, ipython, browser_visit

---

### cli

Shell scripts, command-line tools, argument parsing.

**Call them when:** You need a new command, a better script, or piping between tools.

- Writes bash, python, or node CLI scripts
- Handles flags, env vars, and stdin/stdout
- Adds completion scripts for bash/zsh/fish
- Makes scripts idempotent where possible

**Tools:** file_read, file_write, shell

---

### integration

Third-party APIs, webhooks, SDKs, OAuth flows.

**Call them when:** Connecting to Stripe, Slack, GitHub, or any external service.

- Reads API docs and handles auth flows
- Writes webhook handlers with signature verification
- Manages retry logic and rate limit backoff
- Stores and reads API keys from `.env`

**Tools:** file_read, file_write, shell, web_search, browser_visit