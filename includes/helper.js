/**
 * Get merged configuration from core and custom configs
 */
const getConfig = () => {
  const { coreConfig } = require("./default_config");
  return { ...coreConfig };
};

const config = getConfig();

// ============================================================================
// PROPERTY & STREAM CONFIGURATION HELPERS
// ============================================================================

/**
 * Determines if using simple or advanced property configuration
 * @returns {boolean} True if using PROPERTIES_CONFIG, false if using simple mode
 */
function isAdvancedMode() {
  return config.PROPERTIES_CONFIG !== null && config.PROPERTIES_CONFIG !== undefined;
}

/**
 * Gets all included streams across all properties
 * @returns {Array} Array of stream objects with property and stream metadata
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
 * @returns {boolean}
 */
function shouldConsolidateParams() {
  const effectiveType = getEffectiveDataStreamType();
  return effectiveType === 'both' && config.CONSOLIDATE_WEB_APP_PARAMS;
}

/**
 * Generates SQL filter for stream_id (used in advanced mode)
 * @param {string} propertyName - Property name from PROPERTIES_CONFIG
 * @returns {string} SQL WHERE clause fragment for stream filtering
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
  
  if (includedStreamIds.length === 0) {
    return '1=0';
  }
  
  if (includedStreamIds.length === 1) {
    return `stream_id = ${includedStreamIds[0]}`;
  }
  
  return `stream_id IN (${includedStreamIds.join(', ')})`;
}

// ============================================================================
// STRING MANIPULATION HELPERS
// ============================================================================

/**
 * Replaces null values and empty strings with '(not set)'
 * Used for standardizing GA4 string fields across reports
 * @param {string} fieldName - The field name or expression to check
 * @returns {string} SQL expression with null and empty string handling
 */
function REPLACE_NULL_STRING(fieldName) {
  return `IF(${fieldName} IS NULL OR ${fieldName} = '', '(not set)', ${fieldName})`;
}

// ============================================================================
// PARAMETER EXTRACTION HELPERS
// ============================================================================

/**
 * Generates SQL for extracting event parameters from an array
 * Generic function used by EXTRACT_EVENT_PARAMS, EXTRACT_WEB_PARAMS, EXTRACT_APP_PARAMS, EXTRACT_CUSTOM_PARAMS
 */
function extractParamsSQL(paramsArray, sourceArray = 'event_params') {
  return paramsArray.map(param => {
    let valueField;
    
    switch(param.type.toLowerCase()) {
      case 'string':
        valueField = 'string_value';
        break;
      case 'int':
      case 'integer':
        valueField = 'int_value';
        break;
      case 'float':
      case 'double':
        valueField = 'double_value';
        break;
      default:
        throw new Error(`Unsupported parameter type: ${param.type} for parameter: ${param.name}`);
    }
    
    return `(SELECT value.${valueField} FROM UNNEST(${sourceArray}) WHERE key = '${param.name}') AS ${param.name}`;
  }).join(',\n        ');
}

/**
 * Extracts core event parameters (always included)
 */
function EXTRACT_EVENT_PARAMS(sourceArray = 'event_params') {
  if (config.CORE_PARAMS_ARRAY.length === 0) {
    return '';
  }
  return extractParamsSQL(config.CORE_PARAMS_ARRAY, sourceArray);
}

/**
 * Extracts web-specific parameters
 * Only called when effective stream type includes web
 */
function EXTRACT_WEB_PARAMS(sourceArray = 'event_params') {
  if (config.WEB_PARAMS_ARRAY.length === 0) {
    return '';
  }
  return extractParamsSQL(config.WEB_PARAMS_ARRAY, sourceArray);
}

/**
 * Extracts app-specific parameters
 * Only called when effective stream type includes app
 */
function EXTRACT_APP_PARAMS(sourceArray = 'event_params') {
  if (config.APP_PARAMS_ARRAY.length === 0) {
    return '';
  }
  return extractParamsSQL(config.APP_PARAMS_ARRAY, sourceArray);
}

/**
 * Extracts custom event parameters
 * Always extracted regardless of stream type
 */
function EXTRACT_CUSTOM_PARAMS(sourceArray = 'event_params') {
  if (config.CUSTOM_PARAMS_ARRAY.length === 0) {
    return '';
  }
  return extractParamsSQL(config.CUSTOM_PARAMS_ARRAY, sourceArray);
}

/**
 * Generates consolidation SQL for web/app parameters
 * Creates unified fields when CONSOLIDATE_WEB_APP_PARAMS = true
 */
function CONSOLIDATE_PARAMS() {
  const effectiveType = getEffectiveDataStreamType();
  
  if (effectiveType !== 'both' || !config.CONSOLIDATE_WEB_APP_PARAMS) {
    return '';
  }
  
  const consolidationMap = {};
  
  config.WEB_PARAMS_ARRAY.forEach(param => {
    if (param.consolidated_name) {
      if (!consolidationMap[param.consolidated_name]) {
        consolidationMap[param.consolidated_name] = { web: null, app: null };
      }
      consolidationMap[param.consolidated_name].web = param.name;
    }
  });
  
  config.APP_PARAMS_ARRAY.forEach(param => {
    if (param.consolidated_name) {
      if (!consolidationMap[param.consolidated_name]) {
        consolidationMap[param.consolidated_name] = { web: null, app: null };
      }
      consolidationMap[param.consolidated_name].app = param.name;
    }
  });
  
  const consolidations = Object.keys(consolidationMap).map(consolidatedName => {
    const sources = consolidationMap[consolidatedName];
    const fields = [];
    
    if (sources.web) fields.push(sources.web);
    if (sources.app) fields.push(sources.app);
    
    return `COALESCE(${fields.join(', ')}) AS ${consolidatedName}`;
  });
  
  return consolidations.join(',\n        ');
}

/**
 * Generates event key concatenation including all extracted parameters
 * Dynamically builds the hash based on what parameters are actually extracted
 */
function GENERATE_EVENT_KEY_CONCAT() {
  const effectiveType = getEffectiveDataStreamType();
  
  const fields = [
    "COALESCE(user_id, '')",
    "COALESCE(CAST(ga_session_id AS STRING), '')",
    "CAST(event_timestamp AS STRING)",
    "event_name"
  ];
  
  // Add core params
  config.CORE_PARAMS_ARRAY.forEach(param => {
    fields.push(`COALESCE(CAST(${param.name} AS STRING), '')`);
  });
  
  // Handle web/app params based on consolidation
  if (effectiveType === 'both' && config.CONSOLIDATE_WEB_APP_PARAMS) {
    // Use consolidated field names
    const consolidatedNames = new Set();
    
    config.WEB_PARAMS_ARRAY.forEach(param => {
      if (param.consolidated_name) {
        consolidatedNames.add(param.consolidated_name);
      }
    });
    
    config.APP_PARAMS_ARRAY.forEach(param => {
      if (param.consolidated_name) {
        consolidatedNames.add(param.consolidated_name);
      } else {
        // App-only params that don't consolidate
        fields.push(`COALESCE(CAST(${param.name} AS STRING), '')`);
      }
    });
    
    // Add consolidated fields (these are already strings from COALESCE)
    consolidatedNames.forEach(name => {
      fields.push(`COALESCE(${name}, '')`);
    });
    
  } else {
    // Not consolidating - add web and app params separately
    if (effectiveType === 'web' || effectiveType === 'both') {
      config.WEB_PARAMS_ARRAY.forEach(param => {
        fields.push(`COALESCE(CAST(${param.name} AS STRING), '')`);  // FIX: Added CAST
      });
    }
    
    if (effectiveType === 'app' || effectiveType === 'both') {
      config.APP_PARAMS_ARRAY.forEach(param => {
        fields.push(`COALESCE(CAST(${param.name} AS STRING), '')`);
      });
    }
  }
  
  // Add custom params (always included)
  config.CUSTOM_PARAMS_ARRAY.forEach(param => {
    fields.push(`COALESCE(CAST(${param.name} AS STRING), '')`);
  });
  
  return fields.join(", '-', ");
}

/**
 * Generates SQL for extracting user properties
 */
function EXTRACT_USER_PROPS(sourceArray = 'user_properties') {
  if (config.CORE_USER_PROPS_ARRAY.length === 0) {
    return '';
  }
  
  return config.CORE_USER_PROPS_ARRAY.map(prop => {
    let valueField;
    
    switch(prop.type.toLowerCase()) {
      case 'string':
        valueField = 'string_value';
        break;
      case 'int':
      case 'integer':
        valueField = 'int_value';
        break;
      case 'float':
      case 'double':
        valueField = 'double_value';
        break;
      default:
        throw new Error(`Unsupported property type: ${prop.type} for property: ${prop.name}`);
    }
    
    return `(SELECT value.${valueField} FROM UNNEST(${sourceArray}) WHERE key = '${prop.name}') AS ${prop.name}`;
  }).join(',\n        ');
}

// ============================================================================
// ITEMS ARRAY HELPERS
// ============================================================================

/**
 * Internal helper for item params extraction
 */
function generateItemParamsSQL(paramsConfig, sourceArray) {
  return paramsConfig.map(param => {
    let valueField;
    
    switch(param.type.toLowerCase()) {
      case 'string':
        valueField = 'string_value';
        break;
      case 'int':
      case 'integer':
        valueField = 'int_value';
        break;
      case 'float':
      case 'double':
        valueField = 'double_value';
        break;
      default:
        throw new Error(`Unsupported item parameter type: ${param.type} for parameter: ${param.name}`);
    }
    
    return `(SELECT value.${valueField} FROM UNNEST(${sourceArray}) WHERE key = '${param.name}') AS ${param.name}`;
  }).join(',\n                ');
}

function generateStructSQL(paramsSQL) {
  return `STRUCT(
                ${paramsSQL}
            )`;
}

/**
 * Generates items array extraction
 */
function EXTRACT_ITEMS_ARRAY() {
  const hasCustomParams = config.CUSTOM_ITEMS_PARAMS && config.CUSTOM_ITEMS_PARAMS.length > 0;
  
  let customParamsSQL = '';
  if (hasCustomParams) {
    const paramsSQL = generateItemParamsSQL(config.CUSTOM_ITEMS_PARAMS, 'items.item_params');
    customParamsSQL = `,
                ${generateStructSQL(paramsSQL)} AS item_params_custom`;
  }
  
  return `ARRAY(
        (
            SELECT
                STRUCT(
                    items.item_id,
                    items.item_name,
                    items.item_brand,
                    items.item_variant,
                    items.item_category,
                    items.item_category2,
                    items.item_category3,
                    items.item_category4,
                    items.item_category5,
                    items.price_in_usd,
                    items.price,
                    items.quantity,
                    items.item_revenue_in_usd,
                    items.item_revenue,
                    items.item_refund_in_usd,
                    items.item_refund,
                    items.coupon,
                    items.affiliation,
                    items.location_id,
                    items.item_list_id,
                    items.item_list_name,
                    items.item_list_index,
                    items.promotion_id,
                    items.promotion_name,
                    items.creative_name,
                    items.creative_slot${customParamsSQL}
                )
            FROM UNNEST(items) AS items
        )
    ) AS items`;
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
  generateStreamFilter,
  
  // String Helpers
  REPLACE_NULL_STRING,
  
  // Parameter Extraction
  EXTRACT_EVENT_PARAMS,
  EXTRACT_WEB_PARAMS,
  EXTRACT_APP_PARAMS,
  EXTRACT_CUSTOM_PARAMS,
  CONSOLIDATE_PARAMS,
  GENERATE_EVENT_KEY_CONCAT,
  EXTRACT_USER_PROPS,
  
  // Items Array
  EXTRACT_ITEMS_ARRAY,
  
  // Date & Backfill Helpers
  EXCLUDE_INTRADAY_TABLES,
  GET_BACKFILL_START_DATE,
  GET_BACKFILL_END_DATE
};