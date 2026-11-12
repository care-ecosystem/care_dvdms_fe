export const I18N_NAMESPACE = "care_dvdms";
export const PLUGIN_SLUG = "care_dvdms_fe";

export const LIST_FETCH_LIMIT = 20;

export const MAX_REQUESTS_PER_BATCH = 20;

export const MAX_REQUESTS_PER_SUPER_BATCH = 20;

export const ACKNOWLEDGEMENT_POLL_INTERVAL_MS = 5_000;

export const REQUEST_ORDER_STATUS_POLL_INTERVAL_MS = 5_000;

/**
 * DVDMS lookups are master data the backend already caches, so the UI holds
 * them for a working day rather than refetching them per page.
 */
export const DVDMS_LOOKUP_STALE_TIME_MS = 12 * 60 * 60 * 1_000;

export const DVDMS_SCHEMA_VERSION = "1";

export const DEFAULT_RECORD_ORDER_NAME = "{order_name}";
export const DEFAULT_DELIVERY_ORDER_NAME = "{order_name}";
export const DEFAULT_DELIVERY_ORDER_NOTE = "";
