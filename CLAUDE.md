# CLAUDE.md

## Project Overview

Generic GA4 staging pipeline application built in Dataform (BigQuery toolset). This is the **upstream core application** — it ingests raw GA4 BigQuery export data, cleans and normalizes event-level data, and produces staging tables for downstream consumption. Designed to be deployed across multiple client projects, with client-specific customization handled in separate downstream repos.

## Architecture: Forking Strategy

This repo is the **upstream core**. It manages all upstream models and shared logic. Client-specific work lives in **downstream repos** that fork from this one.

- **Upstream (this repo):** source declarations, staging transformations, assertions, shared JS includes, and output tables. Changes here propagate to all deployments.
- **Downstream (client repos):** custom models, client-specific business logic, and reporting definitions. These repos consume upstream outputs as sources and should never modify upstream files.

When working in this repo, always consider that changes affect all downstream deployments. Avoid client-specific logic here.

## Local Environment
All repos are cloned at:
/Users/brian.phillips/Library/CloudStorage/OneDrive-Bounteous/Documents/code/bounteous_internal/bitbucket/

Never use ~/code/, ~/Documents/, or any other path shortcut when referencing
local repos. Always use the full absolute path above.

## Tech Stack

- **SQL engine:** BigQuery (Standard SQL only — never Legacy SQL)
- **Orchestration:** Dataform (part of the BigQuery / Google Cloud toolset)
- **File types:** SQLX for data transformations, JavaScript for Dataform configuration and reusable functions
- **Reporting layer:** Looker Studio (downstream)
- **Version control:** Bitbucket (hs2studio workspace)
- **IDE:** VS Code with Claude Code extension

## Project Structure

```
project-root/
├── definitions/
│   ├── assertions/       -- data quality checks and validation rules
│   ├── outputs/          -- final staging tables produced by the core pipeline
│   └── custom/           -- reserved for downstream custom models (empty in upstream)
├── includes/             -- reusable JavaScript functions, constants, and shared config
├── dataform.json         -- Dataform project config (references workflow settings)
└── CLAUDE.md
```

Downstream repos extend this structure by populating `definitions/custom/` with client-specific models that reference upstream outputs via `ref()`.

## Configuration

- **Project ID and dataset names** are managed through Dataform **workflow settings variables** — never hardcode these values
- Dataform supports multiple datasets within a project (not yet multiple projects)
- Use `ref()` to reference all upstream tables — never hardcode table names

## Source Data

- **GA4 export tables** typically follow the pattern `[project].[dataset].events_*` (sharded daily tables), but not all GA4 datasets use this pattern. Treat it as a default, not a fixed assumption.
- Always include `_TABLE_SUFFIX` filters to control scan costs
- GA4 exports use nested/repeated fields — UNNEST event_params, user_properties, and items arrays as needed

## Coding Conventions

### SQL Style

- **Keywords:** ALL CAPS for SQL operations (SELECT, FROM, WHERE, JOIN, GROUP BY, SUM, COUNT, etc.)
- **Identifiers:** snake_case for all column names, aliases, table references, and variable names
- **Structure:** prefer CTEs over subqueries for readability
- **Aliases:** always alias tables in JOINs, use meaningful short names (e.g., `e` for events, `s` for sessions)
- **Formatting:** one column per line in SELECT, one condition per line in WHERE/ON clauses
- **Comments:** use `--` inline comments to explain non-obvious logic

### JavaScript Style

- snake_case for variable and function names (consistent with SQL conventions)
- Use JavaScript in Dataform for reusable config, constants, and dynamic SQL generation
- Keep JS logic minimal — the SQL should be readable on its own
- Dataform compilation variables are always strings; use `!== 'true'` in config blocks, never truthy/falsy checks.

### URL Cleaning

Standard URL normalization pattern used across the pipeline:

- Strip query parameters (everything after `?`)
- Strip hash fragments (everything after `#`)
- Remove domain, keep path only
- Normalize trailing characters to a single `/`

Reference implementation:

```sql
REGEXP_REPLACE(
  COALESCE(
    REGEXP_EXTRACT(
      SPLIT(SPLIT(page_location, '?')[SAFE_OFFSET(0)], '#')[SAFE_OFFSET(0)],
      r'(?:https?://)?(?:[^/]+)(/.*)'
    ),
    '/'
  ),
  r'[./]*$',
  '/'
) AS page_path_clean
```

## Git & Repository

- **Platform:** Bitbucket (hs2studio workspace). GitHub is deprecated and should not be used.
- **Upstream framework:** bitbucket.org/hs2studio/ga4-pipeline-framework
- **Client fork pattern:** bitbucket.org/hs2studio/ga4-pipeline-{client-name}
- **Never push to or reference GitHub remotes.**

### Branching

- Always commit to feature branches (`feature/{description}`)
- Push feature branches to Bitbucket
- Do NOT merge to main — leave that to the developer

### One-Time Clone Setup (required for .gitattributes merge protection)

After cloning any client fork, run this once to enable the `merge=ours` driver used by `.gitattributes`:

```bash
git config merge.ours.driver true
```

Without this, upstream merges will not automatically preserve client-owned files.

## Git Workflow

- Work in **feature branches** — never commit directly to main
- **Commit frequently** with descriptive messages after each logical unit of work
- Run light testing after each commit (null checks, row counts)
- Perform a **thorough audit** before merging feature branches
- PRs require human review before merge

### Claude Code Permissions

- **Code changes:** Always show proposed changes and wait for approval before writing to files
- **Git operations:** Once given approval to commit, execute the full cycle (add, commit, push) without pausing for permission at each step
- **Branch creation:** Create feature branches without asking, following the naming convention `feature/description`

## Testing & QA

### After Each Commit (Light Testing)

- Check for columns with all NULLs or unreadable values
- Validate row counts against expectations
- Spot check key metrics for obvious anomalies

### Before Merge (Thorough Audit)

- Run first in **local Dataform workspace** to validate compilation and preview results
- Then execute through **releaseConfig** to validate in the full pipeline context
- Compare aggregate metrics against GA4 UI as a sanity check (expect 2-5% variance at the overall level)

## Working Philosophy

**Good working code is better than perfect code in progress.** Prioritize shipping functional, tested transformations over exhaustive optimization. Specifically:

### Stay Focused on the Primary Output

- When building or modifying a transformation, complete it, test it, and commit it before moving to the next one
- Do not refactor adjacent code unless it is broken or directly blocking the current task
- If you notice an improvement opportunity outside the current scope, leave a `-- TODO:` comment and move on

### Do Not Over-Investigate Variance

- GA4 UI vs BigQuery modeled data will always have inherent variance (session attribution differences, Google's proprietary data, sampling in the UI)
- Small discrepancies compound in highly filtered segments — a large percentage variance on a segment representing a small share of traffic is expected behavior, not a bug
- **Do not spend time tracing variance unless there is a specific hypothesis about a pipeline defect** (e.g., data being inadvertently filtered out, logic not matching expected business rules)
- If asked to investigate variance, start with the simplest check (overall aggregates) before going deeper

### Keep Scope Tight

- Each feature branch should address one logical change or addition
- Resist the urge to "fix everything" in a single branch
- When generating code, produce the minimal working implementation first. Optimization is a separate step.
- If a task is ambiguous, ask for clarification rather than making broad assumptions

### Efficiency Over Elegance

- A readable CTE chain that works is better than a clever one-liner that's hard to debug
- When there are multiple valid approaches, choose the one that is easiest to test and review
- Default to the simpler solution unless there is a concrete performance reason to add complexity

## Cost Awareness

- Always filter `_TABLE_SUFFIX` between start and end dates to control billable bytes
- Use dry runs or table previews before executing expensive queries
- Never use `SELECT *` on raw GA4 export tables
- Be mindful of client budget when scoping investigations or exploratory work

## Things to Avoid

- **Never push code to production without human review**
- Never use Legacy SQL syntax
- Never hardcode project IDs, dataset names, or table names — use Dataform workflow settings and `ref()`
- Never use `SELECT *` on raw GA4 export tables
- Don't skip the local workspace test before running through releaseConfig
- Don't add client-specific logic to this upstream repo
- Don't spend significant effort investigating data variance without a specific defect hypothesis
- Don't refactor working code outside the scope of the current task

## Retro Process

After each deployment or significant feature completion, review and update this CLAUDE.md to capture new patterns, lessons learned, and refined guidelines.

## Assertion & Data Quality Rules

- All data quality assertions must use percentage-based thresholds, not zero-tolerance checks, unless explicitly instructed otherwise
- Follow the existing threshold patterns in the assertion files (currently 5% for null rates, 1% for duplicate rates)
- Do not change assertion thresholds or add new assertions without explicit instructions specifying the threshold
- When creating new assertions, match the FORMAT string style used by existing checks in the same file

## General Guardrails

- Do not make behavioral or architectural decisions beyond what is explicitly described in the prompt
- If a prompt is ambiguous about a design choice (e.g., threshold values, naming conventions, grain definitions), ask for clarification rather than assuming
- When modifying existing patterns, follow the conventions already established in the file unless the prompt explicitly says otherwise
