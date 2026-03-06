// ============================================================================
// SOURCE TABLE DECLARATIONS
// Owned by upstream repository
// ============================================================================

const helpers = require('../includes/helper.js');
const config = helpers.getConfig();

// Declare source tables for each configured property
console.log('[DECLARATIONS] Declaring sources for configured properties');

Object.keys(config.PROPERTIES_CONFIG).forEach(propertyName => {
  const property = config.PROPERTIES_CONFIG[propertyName];

  console.log(`[DECLARATIONS] Property: ${propertyName}, Dataset: ${property.source_dataset}`);

  declare({
    database: dataform.projectConfig.vars.SOURCE_PROJECT,
    schema: property.source_dataset,
    name: 'events_*',
  });

  // Only declare fresh_daily if at least one stream in this property uses it
  const propertyUsesFreshDaily = Object.values(property.streams).some(stream => {
    return stream.use_fresh_daily !== undefined ? stream.use_fresh_daily : config.USE_FRESH_DAILY;
  });

  if (propertyUsesFreshDaily) {
    declare({
      database: dataform.projectConfig.vars.SOURCE_PROJECT,
      schema: property.source_dataset,
      name: 'events_fresh_*',
    });
  }
});
