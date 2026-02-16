// ============================================================================
// SQL_GENERATORS.JS — Parameter Extraction, Key Generation & Items Array
// Owned by upstream repository
// ============================================================================

const helpers = require('./helper');
const config = helpers.getConfig();

// ============================================================================
// PARAMETER EXTRACTION HELPERS
// ============================================================================

/**
 * Internal: Generates SQL for extracting parameters from a repeated STRUCT array
 */
function extractParamsSQL(paramsArray, sourceArray = 'event_params') {
  return paramsArray.map(param => {
    let valueField;
    
    switch(param.type.toLowerCase()) {
      case 'string':
        valueField = 'string_value'; break;
      case 'int':
      case 'integer':
        valueField = 'int_value'; break;
      case 'float':
      case 'double':
        valueField = 'double_value'; break;
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
  if (config.CORE_PARAMS_ARRAY.length === 0) return '';
  return extractParamsSQL(config.CORE_PARAMS_ARRAY, sourceArray);
}

/**
 * Extracts web-specific parameters
 */
function EXTRACT_WEB_PARAMS(sourceArray = 'event_params') {
  if (config.WEB_PARAMS_ARRAY.length === 0) return '';
  return extractParamsSQL(config.WEB_PARAMS_ARRAY, sourceArray);
}

/**
 * Extracts app-specific parameters
 */
function EXTRACT_APP_PARAMS(sourceArray = 'event_params') {
  if (config.APP_PARAMS_ARRAY.length === 0) return '';
  return extractParamsSQL(config.APP_PARAMS_ARRAY, sourceArray);
}

/**
 * Extracts custom event parameters (always extracted)
 */
function EXTRACT_CUSTOM_PARAMS(sourceArray = 'event_params') {
  if (config.CUSTOM_PARAMS_ARRAY.length === 0) return '';
  return extractParamsSQL(config.CUSTOM_PARAMS_ARRAY, sourceArray);
}

/**
 * Generates consolidation SQL for web/app parameters
 * Creates unified fields when CONSOLIDATE_WEB_APP_PARAMS = true
 */
function CONSOLIDATE_PARAMS() {
  const effectiveType = helpers.getEffectiveDataStreamType();
  
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

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generates event key concatenation including all extracted parameters
 * Dynamically builds the hash based on what parameters are actually extracted
 */
function GENERATE_EVENT_KEY_CONCAT() {
  const effectiveType = helpers.getEffectiveDataStreamType();
  
  const fields = [
    "COALESCE(user_id, '')",
    "COALESCE(CAST(ga_session_id AS STRING), '')",
    "CAST(event_timestamp AS STRING)",
    "event_name",
    "COALESCE(CAST(event_server_timestamp_offset AS STRING), '')",
    "COALESCE(CAST(batch_event_index AS STRING), '')",
    "COALESCE(CAST(event_bundle_sequence_id AS STRING), '')"
  ];
  
  config.CORE_PARAMS_ARRAY.forEach(param => {
    fields.push(`COALESCE(CAST(${param.name} AS STRING), '')`);
  });
  
  if (effectiveType === 'both' && config.CONSOLIDATE_WEB_APP_PARAMS) {
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
        fields.push(`COALESCE(CAST(${param.name} AS STRING), '')`);
      }
    });
    
    consolidatedNames.forEach(name => {
      fields.push(`COALESCE(${name}, '')`);
    });
    
  } else {
    if (effectiveType === 'web' || effectiveType === 'both') {
      config.WEB_PARAMS_ARRAY.forEach(param => {
        fields.push(`COALESCE(CAST(${param.name} AS STRING), '')`);
      });
    }
    
    if (effectiveType === 'app' || effectiveType === 'both') {
      config.APP_PARAMS_ARRAY.forEach(param => {
        fields.push(`COALESCE(CAST(${param.name} AS STRING), '')`);
      });
    }
  }
  
  config.CUSTOM_PARAMS_ARRAY.forEach(param => {
    fields.push(`COALESCE(CAST(${param.name} AS STRING), '')`);
  });
  
  return fields.join(", '-', ");
}

// ============================================================================
// USER PROPERTIES
// ============================================================================

/**
 * Generates SQL for extracting user properties
 */
function EXTRACT_USER_PROPS(sourceArray = 'user_properties') {
  if (config.CORE_USER_PROPS_ARRAY.length === 0) return '';
  
  return config.CORE_USER_PROPS_ARRAY.map(prop => {
    let valueField;
    
    switch(prop.type.toLowerCase()) {
      case 'string':
        valueField = 'string_value'; break;
      case 'int':
      case 'integer':
        valueField = 'int_value'; break;
      case 'float':
      case 'double':
        valueField = 'double_value'; break;
      default:
        throw new Error(`Unsupported property type: ${prop.type} for property: ${prop.name}`);
    }
    
    return `(SELECT value.${valueField} FROM UNNEST(${sourceArray}) WHERE key = '${prop.name}') AS ${prop.name}`;
  }).join(',\n        ');
}

// ============================================================================
// ITEMS ARRAY
// ============================================================================

/**
 * Internal: generates item parameter extraction SQL
 */
function generateItemParamsSQL(paramsConfig, sourceArray) {
  return paramsConfig.map(param => {
    let valueField;
    
    switch(param.type.toLowerCase()) {
      case 'string':
        valueField = 'string_value'; break;
      case 'int':
      case 'integer':
        valueField = 'int_value'; break;
      case 'float':
      case 'double':
        valueField = 'double_value'; break;
      default:
        throw new Error(`Unsupported item parameter type: ${param.type} for parameter: ${param.name}`);
    }
    
    return `(SELECT value.${valueField} FROM UNNEST(${sourceArray}) WHERE key = '${param.name}') AS ${param.name}`;
  }).join(',\n                ');
}

/**
 * Internal: wraps SQL in a STRUCT
 */
function generateStructSQL(paramsSQL) {
  return `STRUCT(
                ${paramsSQL}
            )`;
}

/**
 * Generates items array extraction with optional custom item parameters
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
// EXPORTS
// ============================================================================

module.exports = {
  // Parameter Extraction
  EXTRACT_EVENT_PARAMS,
  EXTRACT_WEB_PARAMS,
  EXTRACT_APP_PARAMS,
  EXTRACT_CUSTOM_PARAMS,
  CONSOLIDATE_PARAMS,
  
  // Key Generation
  GENERATE_EVENT_KEY_CONCAT,
  
  // User Properties
  EXTRACT_USER_PROPS,
  
  // Items Array
  EXTRACT_ITEMS_ARRAY
};