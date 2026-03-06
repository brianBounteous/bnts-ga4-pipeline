// ============================================================================
// HELPER.JS — Orchestrator, Stream Configuration & Utilities
// Owned by upstream repository
// ============================================================================

/**
 * Get merged configuration from core and client configs
 */
const getConfig = () => {
  const { coreConfig } = require("./core_config");
  const { clientConfig } = require("./client_config");
  return { ...coreConfig, ...clientConfig };
};

const config = getConfig();

// ============================================================================
// PROPERTY & STREAM CONFIGURATION HELPERS
// ============================================================================

/**
 * Gets all included streams across all properties
 * PROPERTIES_CONFIG is required — throws if missing or empty
 */
function getIncludedStreams() {
  if (!config.PROPERTIES_CONFIG || Object.keys(config.PROPERTIES_CONFIG).length === 0) {
    throw new Error('PROPERTIES_CONFIG is required. Configure at least one property with streams in client_config.js');
  }

  const streams = [];
  Object.keys(config.PROPERTIES_CONFIG).forEach(propertyName => {
    const property = config.PROPERTIES_CONFIG[propertyName];
    Object.keys(property.streams).forEach(streamId => {
      const stream = property.streams[streamId];
      if (stream.include !== false) {
        streams.push({
          property_name: propertyName,
          stream_id: streamId,
          stream_type: stream.stream_type,
          source_dataset: property.source_dataset,
          use_fresh_daily: stream.use_fresh_daily !== undefined ? stream.use_fresh_daily : config.USE_FRESH_DAILY
        });
      }
    });
  });

  return streams;
}

/**
 * Gets the effective data stream type based on included streams
 * @returns {string} 'web', 'app', or 'both'
 */
function getEffectiveDataStreamType() {
  const streams = getIncludedStreams();
  const hasWeb = streams.some(s => s.stream_type === 'web');
  const hasApp = streams.some(s => s.stream_type === 'app');

  if (hasWeb && hasApp) return 'both';
  if (hasWeb) return 'web';
  if (hasApp) return 'app';

  return 'both';
}

/**
 * Generates SQL filter for stream_id (used in multi-property mode)
 */
function generateStreamFilter(propertyName) {
  const property = config.PROPERTIES_CONFIG[propertyName];
  if (!property) {
    throw new Error(`Property ${propertyName} not found in PROPERTIES_CONFIG`);
  }

  const includedStreamIds = Object.keys(property.streams)
    .filter(streamId => property.streams[streamId].include !== false)
    .map(streamId => `'${streamId}'`);

  if (includedStreamIds.length === 0) return '1=0';
  if (includedStreamIds.length === 1) return `stream_id = ${includedStreamIds[0]}`;
  return `stream_id IN (${includedStreamIds.join(', ')})`;
}

// ============================================================================
// FIELD REFERENCE HELPERS
// ============================================================================

/**
 * Gets screen/page field source expressions from base_events structs.
 * Used in CTEs that reference base_events columns.
 * Returns null for fields not applicable to the stream type.
 */
function getScreenFieldRefs() {
  const effectiveType = getEffectiveDataStreamType();

  if (effectiveType === 'web') {
    return {
      key: 'page.page_key',
      location: 'page.page_location',
      path: 'page.page_path',
      referrer: 'page.page_referrer',
      title: 'page.page_title',
      hostname: "REGEXP_EXTRACT(page.page_location, r'://([^/]+)')"
    };
  }

  if (effectiveType === 'app') {
    return {
      key: 'app.screen_key',
      location: 'COALESCE(app.firebase_screen, app.firebase_screen_class)',
      path: null,
      referrer: 'app.firebase_previous_screen',
      title: 'COALESCE(app.firebase_screen, app.firebase_screen_class)',
      hostname: null
    };
  }

  // 'both' — COALESCE across page and app structs
  return {
    key: 'COALESCE(page.page_key, app.screen_key)',
    location: 'COALESCE(page.page_location, app.firebase_screen, app.firebase_screen_class)',
    path: 'page.page_path',
    referrer: 'COALESCE(page.page_referrer, app.firebase_previous_screen)',
    title: 'COALESCE(page.page_title, app.firebase_screen, app.firebase_screen_class)',
    hostname: "REGEXP_EXTRACT(page.page_location, r'://([^/]+)')"
  };
}

/**
 * Gets the output column name aliases for reporting tables (dim_pages, fct_page_views).
 * Null values indicate the column should be omitted entirely for that stream type.
 */
function getOutputColumnNames() {
  const effectiveType = getEffectiveDataStreamType();

  if (effectiveType === 'web') {
    return {
      key: 'page_key',
      session_key: 'page_session_key',
      location: 'page_location',
      path: 'page_path',
      referrer: 'page_referrer',
      title: 'page_title',
      hostname: 'page_hostname'
    };
  }

  if (effectiveType === 'app') {
    return {
      key: 'screen_key',
      session_key: 'screen_session_key',
      location: 'screen_location',
      path: null,
      referrer: 'screen_referrer',
      title: 'screen_title',
      hostname: null
    };
  }

  // 'both'
  return {
    key: 'content_key',
    session_key: 'content_session_key',
    location: 'content_location',
    path: 'page_path',
    referrer: 'content_referrer',
    title: 'content_title',
    hostname: 'page_hostname'
  };
}

/**
 * Gets the appropriate page/screen session key field reference
 */
function getPageSessionKeyRef() {
  const effectiveType = getEffectiveDataStreamType();

  if (effectiveType === 'web') return 'page_session_key';
  if (effectiveType === 'app') return 'screen_session_key';

  // both
  return 'COALESCE(page_session_key, screen_session_key)';
}

// ============================================================================
// STRING & UTILITY HELPERS
// ============================================================================

/**
 * Replaces null values and empty strings with '(not set)'
 */
function REPLACE_NULL_STRING(fieldName) {
  return `IF(${fieldName} IS NULL OR ${fieldName} = '', '(not set)', ${fieldName})`;
}

// ============================================================================
// DATE & BACKFILL HELPERS
// ============================================================================

function EXCLUDE_INTRADAY_TABLES() {
  return `_TABLE_SUFFIX NOT LIKE 'intraday%'`;
}

function GET_BACKFILL_START_DATE() {
  if (config.BACKFILL_START_DATE) {
    return config.BACKFILL_START_DATE;
  }
  return `FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 13 MONTH))`;
}

function GET_BACKFILL_END_DATE() {
  if (config.BACKFILL_END_DATE) {
    return config.BACKFILL_END_DATE;
  }
  return `FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY))`;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Config
  getConfig,

  // Property & Stream Helpers
  getIncludedStreams,
  getEffectiveDataStreamType,
  generateStreamFilter,

  // Field Reference Helpers
  getScreenFieldRefs,
  getOutputColumnNames,
  getPageSessionKeyRef,

  // String & Utility Helpers
  REPLACE_NULL_STRING,

  // Date & Backfill Helpers
  EXCLUDE_INTRADAY_TABLES,
  GET_BACKFILL_START_DATE,
  GET_BACKFILL_END_DATE
};
