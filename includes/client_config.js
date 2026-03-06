// ============================================================================
// CLIENT CONFIGURATION
// Owned by client fork — protected from upstream merges via .gitattributes
// ============================================================================

// ============================================================================
// PROPERTY & DATA STREAM CONFIGURATION
// ============================================================================

/**
 * GA4 Properties and Data Streams Configuration
 * Required — define at least one property with at least one included stream.
 *
 * Structure:
 * {
 *   'property_name': {
 *     source_dataset: 'analytics_XXXXXXXXX',
 *     streams: {
 *       'stream_id': {
 *         include: true/false,
 *         stream_type: 'web'/'app',
 *         use_fresh_daily: true/false
 *       }
 *     }
 *   }
 * }
 */

// Example configuration:
// const PROPERTIES_CONFIG = {
//   'main_website': {
//     source_dataset: 'analytics_123456789',
//     streams: {
//       '1234567890': { include: true, stream_type: 'web' },
//       '0987654321': { include: false, stream_type: 'app' }
//     }
//   },
//   'mobile_app': {
//     source_dataset: 'analytics_987654321',
//     streams: {
//       '5555555555': { include: true, stream_type: 'app', use_fresh_daily: false }
//     }
//   }
// };

const PROPERTIES_CONFIG = {
  // Configure your GA4 properties here. See the example above.
};

/**
 * Fresh daily table usage
 * true: Uses events_fresh_* for recent data (faster, available ~4-6 hours after midnight)
 * false: Uses only events_* tables (finalized, available ~24 hours after midnight)
 */
const USE_FRESH_DAILY = false;

/**
 * Traffic source attribution logic
 * false: Use default GA4 traffic source fields as-is
 * true: Use custom traffic source logic defined in traffic_source.js
 */
const USE_CUSTOM_TRAFFIC_SOURCE_LOGIC = false;

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
    { name: "session_engaged", type: "string" },
    { name: "video_current_time", type: "int" },
    { name: "video_duration", type: "int" },
    { name: "video_percent", type: "int" },
    { name: "video_provider", type: "string" },
    { name: "video_title", type: "string" },
    { name: "video_url", type: "string" }
];

/**
 * Web-specific event parameters (extracted when stream_type = 'web')
 */
const WEB_PARAMS_ARRAY = [
    { name: "link_classes", type: "string" },
    { name: "link_text", type: "string" },
    { name: "link_url", type: "string" },
    { name: "page_location", type: "string" },
    { name: "page_referrer", type: "string" },
    { name: "page_title", type: "string" },
    { name: "visible", type: "string" }
];

/**
 * App-specific event parameters (extracted when stream_type = 'app')
 */
const APP_PARAMS_ARRAY = [
    { name: "firebase_conversion", type: "int" },
    { name: "firebase_previous_class", type: "string" },
    { name: "firebase_previous_id", type: "string" },
    { name: "firebase_previous_screen", type: "string" },
    { name: "firebase_screen", type: "string" },
    { name: "firebase_screen_class", type: "string" },
    { name: "firebase_screen_id", type: "string" }
];

/**
 * Custom event parameters (implementation-specific, always extracted)
 * Add your custom GA4 parameters here
 */
const CUSTOM_PARAMS_ARRAY = [
    // Example:
    // { name: "custom_param_name", type: "string" },
    // { name: "custom_param_int", type: "int" },
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
// ECOMMERCE EVENT CONFIGURATION
// ============================================================================

/**
 * Transaction events that populate the transactions table
 */
const TRANSACTION_EVENTS = ['purchase', 'refund'];

/**
 * Ecommerce events with items array
 * These events populate the ecommerce_items table
 */
const ECOMMERCE_ITEM_EVENTS = [
    'purchase',
    'refund',
    'view_item',
    'add_to_cart',
    'remove_from_cart',
    'begin_checkout',
    'add_payment_info',
    'add_shipping_info'
];

// ============================================================================
// EXPORT
// ============================================================================

const clientConfig = {
    // Property & Stream Config
    PROPERTIES_CONFIG,
    USE_FRESH_DAILY,
    USE_CUSTOM_TRAFFIC_SOURCE_LOGIC,

    // Parameter Arrays
    CORE_PARAMS_ARRAY,
    WEB_PARAMS_ARRAY,
    APP_PARAMS_ARRAY,
    CUSTOM_PARAMS_ARRAY,
    CORE_USER_PROPS_ARRAY,
    CUSTOM_ITEMS_PARAMS,

    // Ecommerce Event Config
    TRANSACTION_EVENTS,
    ECOMMERCE_ITEM_EVENTS
};

module.exports = { clientConfig };
