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
    { name: "engagement_time_msec", type: "int" },    // Total active engagement time for this event in milliseconds. INT64.
    { name: "engaged_session_event", type: "int" },   // Set to 1 when this event occurs during an engaged session. INT64.
    { name: "entrances", type: "int" },               // Set to 1 for the first event in a session. INT64.
    { name: "form_name", type: "string" },            // Name of the HTML form submitted with this event. STRING.
    { name: "ga_session_id", type: "int" },           // Unique session identifier assigned by GA4. Component of session_key. INT64.
    { name: "ga_session_number", type: "int" },       // Ordinal session count for the user, starting at 1. INT64.
    { name: "ignore_referrer", type: "string" },      // Set to 'true' when the referrer should be excluded from session attribution logic. STRING.
    { name: "percent_scrolled", type: "int" },        // How far down the page the user scrolled at the time of the scroll event, as a percentage (0–100). INT64.
    { name: "session_engaged", type: "string" },      // Set to '1' when the session meets GA4's engagement criteria (10+ seconds, 1+ conversion, or 2+ page views). STRING.
    { name: "video_current_time", type: "int" },      // Playback position in the video at the time of the video event, in seconds. INT64.
    { name: "video_duration", type: "int" },          // Total duration of the video, in seconds. INT64.
    { name: "video_percent", type: "int" },           // Percentage of the video that has been played at the time of the video event (0–100). INT64.
    { name: "video_provider", type: "string" },       // Provider of the video (for example, YouTube). STRING.
    { name: "video_title", type: "string" },          // Title of the video. STRING.
    { name: "video_url", type: "string" }             // URL of the video. STRING.
];

/**
 * Web-specific event parameters (extracted when stream_type = 'web')
 */
const WEB_PARAMS_ARRAY = [
    { name: "link_classes", type: "string" },   // CSS class(es) of the link element that triggered a click event. STRING.
    { name: "link_text", type: "string" },      // Visible text of the link element that triggered a click event. STRING.
    { name: "link_url", type: "string" },       // Full URL of the link that was clicked. STRING.
    { name: "page_location", type: "string" },  // Full URL of the page at the time of the event, including path and query string. STRING.
    { name: "page_referrer", type: "string" },  // URL of the page the user navigated from. STRING.
    { name: "page_title", type: "string" },     // Title of the page as returned by the browser. STRING.
    { name: "visible", type: "string" }         // Set to 'true' when the page or element was visible at the time of the event. STRING.
];

/**
 * App-specific event parameters (extracted when stream_type = 'app')
 */
const APP_PARAMS_ARRAY = [
    { name: "firebase_conversion", type: "int" },           // Set to 1 when this event is marked as a Firebase conversion. INT64.
    { name: "firebase_previous_class", type: "string" },    // Class name of the screen the user navigated from. STRING.
    { name: "firebase_previous_id", type: "string" },       // Unique identifier of the screen the user navigated from. STRING.
    { name: "firebase_previous_screen", type: "string" },   // Name of the screen the user navigated from. STRING.
    { name: "firebase_screen", type: "string" },            // Name of the app screen where the event occurred. STRING.
    { name: "firebase_screen_class", type: "string" },      // Class name of the app screen where the event occurred. STRING.
    { name: "firebase_screen_id", type: "string" }          // Unique identifier of the app screen where the event occurred. STRING.
];

/**
 * Custom event parameters (implementation-specific, always extracted)
 * Add your custom GA4 parameters here
 */
const CUSTOM_PARAMS_ARRAY = [
    // Add client-specific event parameters here. Follow the inline comment pattern below.
    // Example:
    // { name: "custom_param_name", type: "string" },  // Description of what this parameter captures. STRING.
    // { name: "custom_param_int", type: "int" },      // Description of what this parameter captures. INT64.
];

/**
 * Custom user properties to extract
 */
const CUSTOM_USER_PROPS_ARRAY = [
    { name: "user_type", type: "string" }  // Segment or classification of the user as set by the implementation (for example, member, guest, admin). STRING.
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
    CUSTOM_USER_PROPS_ARRAY,
    CUSTOM_ITEMS_PARAMS,

    // Ecommerce Event Config
    TRANSACTION_EVENTS,
    ECOMMERCE_ITEM_EVENTS
};

module.exports = { clientConfig };
