// ============================================================================
// PROPERTY & DATA STREAM CONFIGURATION
// ============================================================================

/**
 * GA4 Properties and Data Streams Configuration
 * 
 * SIMPLE MODE (default): Leave null to process all streams from the single 
 * property/dataset defined in workflow_settings.yaml
 * 
 * ADVANCED MODE: Define multiple properties and granular stream-level control
 * 
 * Structure:
 * {
 *   'property_name': {
 *     source_dataset: 'analytics_XXXXXXXXX',
 *     streams: {
 *       'stream_id': {
 *         include: true/false,
 *         stream_type: 'web'/'app',
 *         use_fresh_daily: true/false  // Optional, defaults to global setting
 *       }
 *     }
 *   }
 * }
 */
const PROPERTIES_CONFIG = null;

// Example multi-property configuration:
// const PROPERTIES_CONFIG = {
//   'main_website': {
//     source_dataset: 'analytics_123456789',
//     streams: {
//       '1234567890': { include: true, stream_type: 'web' },
//       '0987654321': { include: false, stream_type: 'app' }  // Excluded
//     }
//   },
//   'mobile_app': {
//     source_dataset: 'analytics_987654321',
//     streams: {
//       '5555555555': { include: true, stream_type: 'app', use_fresh_daily: false }
//     }
//   }
// };

/**
 * Default data stream type (used when PROPERTIES_CONFIG is null)
 * Options: 'web', 'app', or 'both'
 */
const DATA_STREAM_TYPE = 'web';

/**
 * Parameter consolidation for combined web/app streams
 * Only applies when DATA_STREAM_TYPE = 'both' or when processing mixed stream types
 * true: Consolidates parameters (page_location + firebase_screen → screen_location)
 * false: Keeps web and app parameters separate
 */
const CONSOLIDATE_WEB_APP_PARAMS = true;

// ============================================================================
// LOAD STRATEGY CONFIGURATION
// ============================================================================

/**
 * Fresh daily table usage
 * true: Uses events_fresh_daily_* for recent data (faster, available ~4-6 hours after midnight)
 * false: Uses only events_* tables (finalized, available ~24 hours after midnight)
 */
const USE_FRESH_DAILY = false;

/**
 * Initial load size (days) - Used when base_events table doesn't exist
 */
const INITIAL_LOAD_DAYS = 7;

// ============================================================================
// BACKFILL CONFIGURATION
// ============================================================================

/**
 * Manual full backfill mode - Set to true ONLY for intentional historical loads
 * Can be overridden via workflow compilation variables
 * 
 * IMPORTANT: This should ALWAYS be false in repository code
 * Override via release compilation variables for one-time backfill operations
 * 
 * To override: Set compilation variable FORCE_FULL_BACKFILL=true in release config
 */
const FORCE_FULL_BACKFILL = dataform.projectConfig.vars.FORCE_FULL_BACKFILL === 'true' || false;

/**
 * Backfill date range (YYYYMMDD format, only used when FORCE_FULL_BACKFILL = true)
 * Can be overridden via workflow compilation variables
 * null = auto-calculate (13 months ago to yesterday)
 * 
 * To override: Set BACKFILL_START_DATE and BACKFILL_END_DATE in release config
 */
const BACKFILL_START_DATE = dataform.projectConfig.vars.BACKFILL_START_DATE || null;
const BACKFILL_END_DATE = dataform.projectConfig.vars.BACKFILL_END_DATE || null;

// ============================================================================
// PARAMETER EXTRACTION CONFIGURATION
// ============================================================================

/**
 * Core event parameters (extracted for all stream types)
 * Supported types: string, int, float, double
 */
const CORE_PARAMS_ARRAY = [
    { name: "engagement_time_msec", type: "int" },
    { name: "engaged_session_event", type: "int" },
    { name: "entrances", type: "int" },
    { name: "form_name", type: "string" },
    { name: "ga_session_id", type: "int" },
    { name: "ga_session_number", type: "int" },
    { name: "ignore_referrer", type: "string" },
    { name: "percent_scrolled", type: "int" },
    { name: "session_engaged", type: "string" }
];

/**
 * Web-specific event parameters (extracted when stream_type = 'web')
 * consolidated_name: Used when CONSOLIDATE_WEB_APP_PARAMS = true
 */
const WEB_PARAMS_ARRAY = [
    { name: "link_classes", type: "string" },
    { name: "link_text", type: "string" },
    { name: "link_url", type: "string" },
    { name: "page_location", type: "string", consolidated_name: "screen_location" },
    { name: "page_referrer", type: "string", consolidated_name: "screen_referrer" },
    { name: "page_title", type: "string", consolidated_name: "screen_title" },
    { name: "video_current_time", type: "int" },
    { name: "video_duration", type: "int" },
    { name: "video_percent", type: "int" },
    { name: "video_provider", type: "string" },
    { name: "video_title", type: "string" },
    { name: "video_url", type: "string" },
    { name: "visible", type: "string" }
];

/**
 * App-specific event parameters (extracted when stream_type = 'app')
 * consolidated_name: Used when CONSOLIDATE_WEB_APP_PARAMS = true
 */
const APP_PARAMS_ARRAY = [
    { name: "firebase_conversion", type: "int" },
    { name: "firebase_previous_class", type: "string" },
    { name: "firebase_previous_id", type: "string" },
    { name: "firebase_previous_screen", type: "string", consolidated_name: "screen_referrer" },
    { name: "firebase_screen", type: "string", consolidated_name: "screen_location" },
    { name: "firebase_screen_class", type: "string", consolidated_name: "screen_title" },
    { name: "firebase_screen_id", type: "string" }
];

/**
 * Custom event parameters (implementation-specific, always extracted)
 * Add your custom GA4 parameters here
 */
const CUSTOM_PARAMS_ARRAY = [
    { name: "blog_word_count", type: "int" },
    { name: "blog_word_count_cohort", type: "string" },
];

/**
 * Core user properties to extract
 */
const CORE_USER_PROPS_ARRAY = [
    { name: "user_type", type: "string" }
];

/**
 * Custom item parameters (extracted from items array)
 */
const CUSTOM_ITEMS_PARAMS = [
    // Example:
    // { name: "custom_size", type: "string" },
    // { name: "custom_color", type: "string" },
];

// ============================================================================
// EXPORT CONFIGURATION
// ============================================================================

const coreConfig = {
    // Property & Stream Config
    PROPERTIES_CONFIG,
    DATA_STREAM_TYPE,
    CONSOLIDATE_WEB_APP_PARAMS,
    
    // Load Strategy
    USE_FRESH_DAILY,
    INITIAL_LOAD_DAYS,
    
    // Backfill
    FORCE_FULL_BACKFILL,
    BACKFILL_START_DATE,
    BACKFILL_END_DATE,
    
    // Parameter Arrays
    CORE_PARAMS_ARRAY,
    WEB_PARAMS_ARRAY,
    APP_PARAMS_ARRAY,
    CUSTOM_PARAMS_ARRAY,
    CORE_USER_PROPS_ARRAY,
    CUSTOM_ITEMS_PARAMS
};

module.exports = {
    coreConfig
};


