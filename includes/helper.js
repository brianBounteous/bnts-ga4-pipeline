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
 * Determines if using simple or advanced property configuration
 */
function isAdvancedMode() {
  return config.PROPERTIES_CONFIG !== null && config.PROPERTIES_CONFIG !== undefined;
}

/**
 * Gets all included streams across all properties
 */
function getIncludedStreams() {
  if (!isAdvancedMode()) {
    return [{
      simple_mode: true,
      stream_type: config.DATA_STREAM_TYPE,
      use_fresh_daily: config.USE_FRESH_DAILY
    }];
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
  if (!isAdvancedMode()) {
    return config.DATA_STREAM_TYPE;
  }
  
  const streams = getIncludedStreams();
  const hasWeb = streams.some(s => s.stream_type === 'web');
  const hasApp = streams.some(s => s.stream_type === 'app');
  
  if (hasWeb && hasApp) return 'both';
  if (hasWeb) return 'web';
  if (hasApp) return 'app';
  
  return 'both';
}

/**
 * Determines if parameter consolidation should occur
 */
function shouldConsolidateParams() {
  const effectiveType = getEffectiveDataStreamType();
  return effectiveType === 'both' && config.CONSOLIDATE_WEB_APP_PARAMS;
}

/**
 * Gets the consolidated field name for a given parameter
 */
function getConsolidatedFieldName(paramName) {
  const webParam = config.WEB_PARAMS_ARRAY.find(p => p.name === paramName);
  if (webParam && webParam.consolidated_name) {
    return webParam.consolidated_name;
  }
  
  const appParam = config.APP_PARAMS_ARRAY.find(p => p.name === paramName);
  if (appParam && appParam.consolidated_name) {
    return appParam.consolidated_name;
  }
  
  return null;
}

/**
 * Generates SQL filter for stream_id (used in advanced mode)
 */
function generateStreamFilter(propertyName) {
  if (!isAdvancedMode()) {
    return '1=1';
  }
  
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
 * Gets screen field references for session aggregations
 * Returns appropriate field paths based on web/app/both configuration
 */
function getScreenFieldRefs() {
  const effectiveType = getEffectiveDataStreamType();
  const consolidate = shouldConsolidateParams();
  
  if (effectiveType === 'web') {
    return {
      location: 'page.page_location',
      path: 'page.page_path',
      referrer: 'page.page_referrer',
      key: 'page.page_key',
      title: 'page.page_title'
    };
  }
  
  if (effectiveType === 'app') {
    return {
      location: 'COALESCE(app.firebase_screen, app.firebase_screen_class)',
      path: 'COALESCE(app.firebase_screen, app.firebase_screen_class)',
      referrer: 'CAST(NULL AS STRING)',
      key: 'app.screen_key',
      title: 'app.firebase_screen_class'
    };
  }
  
  // For 'both'
  if (consolidate) {
    return {
      location: 'page.screen_location',
      path: 'page.page_path',
      referrer: 'page.screen_referrer',
      key: 'page.screen_key',
      title: 'page.screen_title'
    };
  } else {
    return {
      location: 'COALESCE(page.page_location, app.firebase_screen, app.firebase_screen_class)',
      path: 'COALESCE(page.page_path, app.firebase_screen, app.firebase_screen_class)',
      referrer: 'COALESCE(page.page_referrer, app.firebase_previous_screen)',
      key: 'COALESCE(page.page_key, app.screen_key)',
      title: 'COALESCE(page.page_title, app.firebase_screen_class)'
    };
  }
}

/**
 * Gets the appropriate page/screen session key field reference
 */
function getPageSessionKeyRef() {
  const effectiveType = getEffectiveDataStreamType();
  const consolidate = shouldConsolidateParams();
  
  if (effectiveType === 'web') return 'page_session_key';
  if (effectiveType === 'app') return 'screen_session_key';
  
  // both
  if (consolidate) return 'screen_session_key';
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
  isAdvancedMode,
  getIncludedStreams,
  getEffectiveDataStreamType,
  shouldConsolidateParams,
  getConsolidatedFieldName,
  generateStreamFilter,
  
  // Field Reference Helpers
  getScreenFieldRefs,
  getPageSessionKeyRef,
  
  // String & Utility Helpers
  REPLACE_NULL_STRING,
  
  // Date & Backfill Helpers
  EXCLUDE_INTRADAY_TABLES,
  GET_BACKFILL_START_DATE,
  GET_BACKFILL_END_DATE
};