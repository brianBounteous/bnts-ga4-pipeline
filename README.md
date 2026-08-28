# GA4 Pipeline Framework

Dataform-based GA4 analytics pipeline designed for agency deployment across multiple clients. Bounteous maintains the upstream framework; each client gets a fork with customized configuration. The framework ingests raw GA4 BigQuery export data, cleans and normalizes event-level data, and produces staging tables for downstream consumption.

---

## Architecture Overview

### Upstream / Fork Model

Bounteous maintains this framework repo. Each client deployment is a Bitbucket fork of this repo (`ga4-pipeline-{client-name}`). Framework changes merge downstream; client-owned configuration files are protected from being overwritten.

| Remote | Points to |
|--------|-----------|
| `origin` | Client fork (`bitbucket.org/hs2studio/ga4-pipeline-{client-name}`) |
| `upstream` | Framework repo (`bitbucket.org/hs2studio/ga4-pipeline-framework`) |

### Pipeline Flow

```
GA4 Export (events_*, events_fresh_*)
           ↓
    [base_events] ─── Event-level data, 3-day rolling refresh (CORE_DATASET)
           ↓
    ┌────────────────┬──────────────────┬─────────────────────┐
    ↓                ↓                  ↓                     ↓
[sessions_core]  [dim_pages_core]  [transactions]      [user_identity_map]
                 [fct_page_views]  [ecommerce_items]   [users]
                                    (if HAS_ECOMMERCE)
           ↓
    [model_execution_log] ─── Audit log (runs last)

    ┌──────────────────────────────────────────┐
    ↓                                          ↓
[sessions]                              [dim_pages]
(REPORTING_DATASET — client-owned view,  (REPORTING_DATASET — client-owned view,
 definitions/custom/sessions.sqlx)        definitions/custom/dim_pages.sqlx)
```

### Core / Reporting Dataset Split

Framework-owned tables (`base_events`, `sessions_core`, `dim_pages_core`, `users`, etc.) compile into `CORE_DATASET` and are rebuilt however the framework defines them — never edit them in a client fork. `sessions` and `dim_pages` additionally get a client-owned reporting view in `REPORTING_DATASET` (`definitions/custom/sessions.sqlx` / `dim_pages.sqlx`), which starts as a plain passthrough (`SELECT * FROM sessions_core`) and is where any client-specific columns (e.g. `page_category`, `sales_region`) get added. BI tools and analysts should query the reporting dataset, not the core one.

This keeps client customization entirely inside `definitions/custom/**` (protected from upstream merges via `.gitattributes`) instead of inside the framework's own output files, so pulling framework updates never produces a merge conflict. Apply the same pattern — a `<table>_core` build plus a passthrough view in `definitions/custom/<table>.sqlx` — to any other output table a client needs to extend (`users`, `fct_page_views`, etc.); it isn't pre-built for tables nobody's customizing yet.

### Key Design Decisions

- **Consolidated over fragmented** — wide tables instead of many narrow joins
- **Type 1 SCD for dimensions** — current-state only, no history tracking
- **Page-session grain for facts** — `fct_page_views` is keyed on page × session
- **Rolling reconciliation refresh** — `base_events` deletes and reloads the trailing `RECONCILIATION_LOOKBACK_DAYS` window (`core_config.js`, default 3 days) on each run, capturing late-arriving GA4 events. This is a delete-then-insert, not a `MERGE`. Dataform supports `uniqueKey` + `updatePartitionFilter` to generate a merge natively, so the reason to avoid it here is cost, not implementation complexity: a merge at event grain has to match every incoming row against every existing row in the window, which is materially more expensive at GA4 event volume than an unconditional delete + insert. See "Reconciliation: known tradeoffs" below for what this choice costs.
- **Today's intraday data is never loaded** — the rolling window only ever loads a GA4 date once it has fully closed (starting at `RECONCILIATION_LOOKBACK_DAYS` ago), then keeps revising it until it passes out of the window. This is a deliberate freshness/stability tradeoff, not an oversight: GA4's intraday export is the least reliable slice of the data (fields like session attribution and engagement aren't final), and mixing it into `base_events` would make session-level numbers shift under stakeholders. If same-day visibility becomes a requirement, prefer a separate `base_events_intraday` model unioned at the reporting layer over merging unreconciled rows into `base_events` itself.
- **Config-driven** — parameter extraction, stream types, and traffic source logic are controlled through two files (`workflow_settings.yaml` and `client_config.js`) rather than code changes

---

## Quick Start: New Client Deployment

### 1. Fork the Framework Repo

Fork `bitbucket.org/hs2studio/ga4-pipeline-framework` in Bitbucket as `ga4-pipeline-{client-name}`.

Clone the fork locally:

```bash
git clone git@bitbucket.org:hs2studio/ga4-pipeline-{client-name}.git
cd ga4-pipeline-{client-name}
git remote add upstream git@bitbucket.org:hs2studio/ga4-pipeline-framework.git
```

### 2. Enable Merge Protection (one-time)

```bash
git config merge.ours.driver true
```

This activates the `.gitattributes` merge driver that preserves client-owned files when pulling upstream updates.

### 3. Configure `workflow_settings.yaml`

```yaml
vars:
  SOURCE_PROJECT: "your-gcp-project"
  SOURCE_DATASET: "analytics_123456789"
  CORE_DATASET: "ga4_core"        # framework-owned tables
  REPORTING_DATASET: "ga4_reporting"  # client-owned views (definitions/custom/**)
  HAS_ECOMMERCE: "false"          # "true" to enable ecommerce models
  ENVIRONMENT: "production"       # "development" for dev runs
```

### 4. Configure `includes/client_config.js`

Set the data stream type and parameter arrays. Key fields:

- `DATA_STREAM_TYPE` — `'web'`, `'app'`, or `'both'`
- `PROPERTIES_CONFIG` — `null` for single-property; define array for multi-property
- `CORE_PARAMS_ARRAY`, `WEB_PARAMS_ARRAY`, `APP_PARAMS_ARRAY`, `CUSTOM_PARAMS_ARRAY` — GA4 event parameters to extract
- `TRANSACTION_EVENTS`, `ECOMMERCE_ITEM_EVENTS` — ecommerce event names (if `HAS_ECOMMERCE: "true"`)

### 5. SSH Authentication for Dataform

Dataform must authenticate to Bitbucket to pull source code. **RSA keys in PEM format only** — see SSH Setup section below.

1. Generate key and store in Secret Manager (grant Dataform service agent `secretmanager.secretAccessor`)
2. Add public key to Bitbucket repository access keys

### 6. Create Release and Workflow Configurations in Dataform

**Both are required for scheduled execution** — a release config alone is not enough.

- **Release config:** points to `main`, no compilation variable overrides for standard runs
- **Workflow config:** references the release config, sets the execution schedule (run after GA4 data finalizes, typically 12pm+ PT)

### 7. Initial Execution

The first run must be **non-incremental** (the pre-ops script safely handles missing tables). After tables are created, daily incremental runs handle the 3-day rolling refresh automatically.

---

## Configuration Reference

### `workflow_settings.yaml` — Compilation Variables

Controls what gets compiled into the Dataform execution graph. Variables here act as feature flags — changing them changes which models are included in the compiled output.

| Variable | Values | Description |
|----------|--------|-------------|
| `SOURCE_PROJECT` | GCP project ID | Source GA4 export project |
| `SOURCE_DATASET` | dataset name | GA4 export dataset |
| `CORE_DATASET` | dataset name | Framework-owned output tables (e.g. `base_events`, `sessions_core`, `dim_pages_core`) |
| `REPORTING_DATASET` | dataset name | Client-owned reporting views (`definitions/custom/**`) — query this, not `CORE_DATASET`, for BI/analysis |
| `HAS_ECOMMERCE` | `"true"` / `"false"` | Enables ecommerce models |
| `ENVIRONMENT` | `"production"` / `"development"` | Controls dev vs prod behavior |

**Client fork owned.** Do not modify in the framework repo.

### `includes/client_config.js` — Data Processing Configuration

Controls how compiled models process data. Does not affect what gets compiled — it affects runtime behavior within compiled models.

| Setting | Description |
|---------|-------------|
| `DATA_STREAM_TYPE` | Web, app, or both |
| `PROPERTIES_CONFIG` | Multi-property configuration (null = single property) |
| `USE_FRESH_DAILY` | Use `events_fresh_*` for days 1–2 of the rolling window |
| `CONSOLIDATE_WEB_APP_PARAMS` | Merge `page_location`/`firebase_screen` into unified fields when stream type is `'both'` |
| `CORE_PARAMS_ARRAY` | GA4 event parameters to extract for all streams |
| `WEB_PARAMS_ARRAY` | Web-only parameters |
| `APP_PARAMS_ARRAY` | App-only parameters |
| `CUSTOM_PARAMS_ARRAY` | Client-specific parameters |
| `CUSTOM_ITEMS_PARAMS` | Custom item-level parameters from the items array |
| `TRANSACTION_EVENTS` | Events that populate the transactions table |
| `ECOMMERCE_ITEM_EVENTS` | Events that populate the ecommerce_items table |

**The distinction:** `workflow_settings.yaml` toggles what gets compiled; `client_config.js` controls how compiled models behave at runtime.

**Client fork owned.** Do not modify in the framework repo.

---

## Protected Files

These files are owned by the client fork and are preserved automatically during upstream merges via `.gitattributes`:

| File | Description |
|------|-------------|
| `workflow_settings.yaml` | Project/dataset settings and feature flags |
| `includes/client_config.js` | Data processing configuration |
| `includes/traffic_source.js` | Custom attribution logic |
| `definitions/declarations.js` | Source table declarations |
| `definitions/custom/**` | All client-specific models, including the `sessions`/`dim_pages` reporting views |

### Pulling Upstream Updates

```bash
git fetch upstream
git merge upstream/main --no-commit   # Review before finalizing
git commit -m "Pull upstream framework updates"
git push origin main
```

Client-owned files are preserved automatically. Framework files update cleanly. The `--no-commit` flag lets you review the merge result before finalizing.

---

## SSH Setup for Dataform

### Key Format Requirements

- **Must use RSA keys in PEM format.** Ed25519 and other formats are not compatible with Dataform.
- Generate with: `ssh-keygen -t rsa -b 4096 -m PEM -f dataform_deploy_key`

### Secret Manager Setup

1. Store the private key contents in a Secret Manager secret
2. Grant the Dataform service agent (`service-{PROJECT_NUMBER}@gcp-sa-dataform.iam.gserviceaccount.com`) the `Secret Manager Secret Accessor` role on that secret
3. Reference the secret in the Dataform repository settings

### Bitbucket Host Key

Bitbucket rotated its SSH host key in 2023. If authentication fails with a host key verification error, the old key may be cached. Update `~/.ssh/known_hosts` with the current Bitbucket host key.

---

## Backfill Operations

Backfills load historical data beyond the default initial load window. Use temporary release configurations — no code changes required.

**Always create a new release for each backfill.** Do not edit an existing release's compilation variables and re-run — Dataform may cache the previous compilation. A fresh release avoids this.

**Process:**

1. Create a release named `backfill-YYYYMMDD-YYYYMMDD`, pointed at `main`
2. Set compilation variable overrides (only what differs from defaults):
   ```
   FORCE_FULL_BACKFILL: true
   BACKFILL_START_DATE: 20240101
   BACKFILL_END_DATE: 20240131
   ```
3. Execute manually — select the `base_events` tag; downstream tables rebuild from it
4. Verify in BigQuery, then delete the release

For large backfills, split into monthly chunks with separate releases.

**Safety:** Never add `FORCE_FULL_BACKFILL: 'true'` to `workflow_settings.yaml` — this would cause every scheduled run to attempt a full historical reload.

---

## File Structure

```
├── includes/
│   ├── core_config.js          ← Framework flags (backfill, ecommerce, initial load)
│   ├── client_config.js        ← Client settings (streams, params, events)   [fork-owned]
│   ├── helper.js               ← Stream resolution, field refs, utilities
│   ├── sql_generators.js       ← Parameter extraction, key generation, items array
│   └── traffic_source.js       ← Attribution logic (default + custom)        [fork-owned]
├── definitions/
│   ├── outputs/
│   │   ├── base_events_preops.sqlx   ← Cleanup operation (deletes 3-day window)
│   │   ├── base_events.sqlx          ← Core event table (incremental)          [CORE_DATASET]
│   │   ├── sessions_core.sqlx        ← Session aggregations                    [CORE_DATASET]
│   │   ├── dim_pages_core.sqlx       ← Page/screen dimension (Type 1 SCD)      [CORE_DATASET]
│   │   ├── fct_page_views.sqlx       ← Page view facts (page-session grain)    [CORE_DATASET]
│   │   ├── transactions.sqlx         ← Transaction events (ecommerce)          [CORE_DATASET]
│   │   ├── ecommerce_items.sqlx      ← Item-level ecommerce (ecommerce)        [CORE_DATASET]
│   │   ├── user_identity_map.sqlx    ← Pseudo-ID to user-ID resolution         [CORE_DATASET]
│   │   ├── users.sqlx                ← User-level lifetime aggregations        [CORE_DATASET]
│   │   └── model_execution_log.sqlx  ← Pipeline audit log                      [CORE_DATASET]
│   ├── custom/                       ← Client-specific models              [fork-owned]
│   │   ├── sessions.sqlx             ← Reporting view over sessions_core   [fork-owned, REPORTING_DATASET]
│   │   └── dim_pages.sqlx            ← Reporting view over dim_pages_core  [fork-owned, REPORTING_DATASET]
│   └── declarations.js               ← Source table declarations           [fork-owned]
├── workflow_settings.yaml            ← Project settings & compilation vars [fork-owned]
├── .gitattributes                    ← Merge protection for fork-owned files
└── README.md
```

---

## Reconciliation: Known Tradeoffs

`base_events_preops.sqlx` (DELETE) and `base_events.sqlx` (INSERT) are two separate Dataform actions, not one atomic statement. This is an accepted tradeoff, not an unhandled bug — documented here so the reasoning doesn't get lost:

- **The exposure window is real but narrow.** If the INSERT fails, times out, or the run is killed between the two steps, `base_events` is left with a gap in the reconciliation window until the *next successful run* repairs it — which can be up to ~24 hours on a daily schedule, not just the runtime of the job itself.
- **Downstream tables are protected, not exposed.** `sessions_core`, `dim_pages_core`, `fct_page_views`, `transactions`, `ecommerce_items`, `user_identity_map`, and `users` all declare `assert_base_events_integrity` as an explicit dependency. If `base_events` fails, the assertion never runs, so nothing downstream runs either — those tables (and the `definitions/custom/**` reporting views built on `sessions_core`/`dim_pages_core`) stay on yesterday's data (stale but internally consistent), rather than reading through the gap.
- **What is exposed:** a query hitting `base_events` directly during the gap window (e.g. an ad hoc BI pull against `CORE_DATASET`, which client-facing analysts shouldn't be querying directly anyway per the Core/Reporting split above).
- **Why we haven't wrapped it in a transaction.** BigQuery multi-statement transactions could close this gap, but this exact DELETE step has caused unresolved problems in this pipeline's history before (motivating `base_events_preops.sqlx`'s current design) that we no longer have full context on, and it's unconfirmed whether Dataform executes `pre_operations`/action/`post_operations` as a single script that a transaction could span. Given failures here are loud (the Dataform run fails visibly) and the repair is a one-click re-run, the cost/risk of reworking this was judged not worth it relative to the size of the exposure.
- **What is in place instead:** `base_events` deduplicates on `event_key` via `QUALIFY ROW_NUMBER()`, so a retried INSERT (without its paired DELETE) is idempotent rather than double-inserting. `assert_base_events_integrity` also checks for `NO_DATA` and `INCOMPLETE_WINDOW` (a partial run that loads fewer than `RECONCILIATION_LOOKBACK_DAYS` of the expected dates) in addition to null-rate and duplicate-key thresholds.

## Known Gotchas

- **`ref()` registers compile-time dependencies even inside conditional logic.** If a model is conditionally skipped via a feature flag, any `ref()` calls inside that block still create dependency edges at compile time. Guard with `dataform.projectConfig.vars.HAS_ECOMMERCE === "true"` at the JS level, not just in SQL conditionals.

- **Both release config and workflow config are required for scheduled execution.** A release config alone does nothing — it must be paired with a workflow config that references it and defines the schedule.

- **First run requires non-incremental execution.** The `base_events` pre-ops script deletes the 3-day rolling window before reloading. On the first run, the table doesn't exist yet — the script handles this safely, but the table must be created before incremental mode works correctly.

- **Never add `FORCE_FULL_BACKFILL` to `workflow_settings.yaml`.** This flag belongs only in temporary backfill release configs. In `workflow_settings.yaml`, it would cause every scheduled run to reload all historical data.

- **Dataform may cache compilation results when you edit release config variables.** Always create a new release for backfills rather than editing an existing one's variables.
