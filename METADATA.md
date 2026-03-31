# METADATA.md — Agent Reference for GA4 Pipeline Column Documentation

This file is an instruction guide for AI agents working in this repo. It explains how to interpret, document, and update column-level metadata for columns that are dynamically generated at compile time and therefore cannot be described inline in the `.sqlx` config blocks.

---

## Dynamic Columns in base_events

`base_events` contains several groups of columns whose names and data types are not statically declared in the SQLX — they are generated at compile time from configuration arrays in `includes/client_config.js`. These columns cannot be documented in the `columns:` block of `base_events.sqlx`.

**Where to find the authoritative descriptions for these columns:**

For each dynamic column, the inline comment on the same line as the parameter entry in `client_config.js` is the authoritative description. The format is:

```javascript
{ name: "param_name", type: "string" },  // Description of what this parameter captures. STRING.
```

The comment states what the parameter measures and its BigQuery data type. When writing or updating documentation for these columns, update the inline comment in `client_config.js` — do not attempt to add them to the `columns:` block in `base_events.sqlx`.

---

## The Four Param Arrays

### `CORE_PARAMS_ARRAY`
Extracted for all stream types (web and app). These are standard GA4 event parameters that apply regardless of platform — session identifiers, engagement signals, scroll depth, form interactions, and video playback metrics.

### `WEB_PARAMS_ARRAY`
Extracted only when the effective stream type is `web` or `both`. These parameters are specific to browser-based events — page URL, page title, referrer, link click attributes, and visibility signals.

### `APP_PARAMS_ARRAY`
Extracted only when the effective stream type is `app` or `both`. These parameters are specific to Firebase/mobile app events — screen names, screen classes, screen IDs, and previous screen navigation context.

### `CUSTOM_PARAMS_ARRAY`
Client-specific event parameters that vary by deployment. These are defined per client fork and are not present in the upstream framework by default. The inline comment on each entry in `client_config.js` is the sole documentation for what a custom parameter means — treat it as authoritative.

---

## CORE_USER_PROPS_ARRAY

`CORE_USER_PROPS_ARRAY` in `client_config.js` defines user properties extracted from the `user_properties` array in the raw GA4 export. Like the event param arrays, these generate dynamic columns in `base_events`. The inline comment on each entry is the authoritative description.

---

## Determining the Effective Stream Type

The stream type for a deployment is determined by reading `PROPERTIES_CONFIG` in `client_config.js`. For each property, each stream entry has a `stream_type` field set to `'web'` or `'app'`.

- If all included streams across all properties have `stream_type: 'web'` → effective type is `web`
- If all included streams have `stream_type: 'app'` → effective type is `app`
- If included streams have a mix of `'web'` and `'app'` → effective type is `both`

The effective stream type controls:
- Which param arrays are active (`WEB_PARAMS_ARRAY` and/or `APP_PARAMS_ARRAY`)
- Whether `page` struct or `app` struct (or both) appear in `base_events`
- Which column naming variant is used in `fct_page_views` and `dim_pages` (`page_*`, `screen_*`, or `content_*`)

When writing column descriptions for `fct_page_views` and `dim_pages`, always cross-reference all three naming variants even if the current deployment only uses one.

---

## Column Description Standards

When writing or updating column descriptions in `.sqlx` config blocks:

- **Key columns** (`session_key`, `event_key`, `page_key`, `screen_key`, `content_key`, `page_session_key`, `screen_session_key`, `content_session_key`): Always state the construction logic in plain English. Name the component fields and the separator used.
- **Timestamp columns**: Always state the unit (microseconds) and timezone (UTC).
- **Boolean flag columns**: Explicitly state what `true` and `false` each mean.
- **Conditional columns** (ecommerce columns in `users`, `HAS_ECOMMERCE`-gated tables): State the condition under which the column is populated.
- **Dynamic-name columns** in `fct_page_views` and `dim_pages`: Always cross-reference the other naming variants (`page_*` / `screen_*` / `content_*`).
- **Traffic source structs** in `base_events`: Include a redirect note pointing analysts to the flattened columns in `sessions` instead.
- **Voice**: Present tense, third person, one to two sentences. Written for analysts and business users, not engineers.
