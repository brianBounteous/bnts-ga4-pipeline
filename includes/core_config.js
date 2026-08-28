// ============================================================================
// FRAMEWORK CONFIGURATION
// Owned by upstream repository — do not modify in client forks
// ============================================================================

/**
 * Manual full backfill mode
 * IMPORTANT: This should ALWAYS be false in repository code
 * Override via release compilation variables for one-time backfill operations
 */
const FORCE_FULL_BACKFILL = dataform.projectConfig.vars.FORCE_FULL_BACKFILL === 'true' || false;

/**
 * Backfill date range (YYYYMMDD format, only used when FORCE_FULL_BACKFILL = true)
 * null = auto-calculate (13 months ago to yesterday)
 */
const BACKFILL_START_DATE = dataform.projectConfig.vars.BACKFILL_START_DATE || null;
const BACKFILL_END_DATE = dataform.projectConfig.vars.BACKFILL_END_DATE || null;

/**
 * Ecommerce feature flag
 * Controlled via workflow_settings.yaml or release compilation variables
 */
const HAS_ECOMMERCE = dataform.projectConfig.vars.HAS_ECOMMERCE === 'true';

/**
 * Initial load size (days) - Used when base_events table doesn't exist
 */
const INITIAL_LOAD_DAYS = 7;

/**
 * Reconciliation lookback window (days) - base_events_preops deletes and
 * base_events re-inserts this many trailing days on every incremental run,
 * to capture late-arriving/corrected GA4 events. Referenced by
 * base_events_preops.sqlx, base_events.sqlx's incremental date filter,
 * assert_base_events_integrity.sqlx, and model_execution_log.sqlx — change
 * here, not per-file.
 */
const RECONCILIATION_LOOKBACK_DAYS = 3;

// ============================================================================
// EXPORT
// ============================================================================

const coreConfig = {
  FORCE_FULL_BACKFILL,
  BACKFILL_START_DATE,
  BACKFILL_END_DATE,
  HAS_ECOMMERCE,
  INITIAL_LOAD_DAYS,
  RECONCILIATION_LOOKBACK_DAYS
};

module.exports = { coreConfig };