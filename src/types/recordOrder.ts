import { RequestOrderBadgeVariant } from "@/types/requestOrder";

export interface RecordOrderPayload {
  name: string;
  order: string;
  institute_store: string;
  institute_supplier: string;
  status: string;
}

export type RecordOrderUpdatePayload = Partial<RecordOrderPayload>;

export interface RecordOrderUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface RecordOrderRequestOrder {
  id: string;
  name: string;
  category: string;
  intent: string;
  priority: string;
  reason: string;
  status: string;
}

export interface RecordOrderInstituteStore {
  id: string;
  eaushadhi_store_id: string;
  eaushadhi_store_name: string;
  store: {
    id: string;
    name: string;
    form: string;
  };
}

export interface RecordOrderInstituteSupplier {
  id: string;
  eaushadhi_warehouse_id: string;
  eaushadhi_warehouse_name: string;
  supplier: {
    id: string;
    name: string;
    org_type: string;
  };
}

export interface RecordOrder {
  id: string;
  name: string;
  order: RecordOrderRequestOrder;
  institute_store: RecordOrderInstituteStore;
  institute_supplier: RecordOrderInstituteSupplier;
  care_indent_no: string | null;
  status: string;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}

/**
 * What DVDMS said when a sync failed, as stored on a record's `meta`. The same
 * shape comes back for every sync type — saving an indent, acknowledging an
 * issue — so it is shared by outwards, inwards and deliveries.
 *
 * `detail` is the raw upstream body — often an HTML error page — so it is kept
 * for support, never rendered.
 */
export interface DvdmsSyncError {
  code?: string;
  type?: string;
  message?: string;
  detail?: string;
  status_code?: number;
  failed_at?: string;
  attempt?: number;
  sync_log_id?: string;
  sync_type?: string;
}

export interface DvdmsSyncMeta {
  error?: DvdmsSyncError;
}

/** Where the push to DVDMS has got to. */
export enum RecordOrderOutwardStatus {
  created = "created",
  submitted = "submitted",
  cancelled = "cancelled",
  failed = "failed",
}

/**
 * The order is with DVDMS: an indent has been raised or is being raised, so
 * CARE must not void or reopen the order behind its back.
 */
export const isOutwardWithDvdms = (status?: string | null) =>
  status === RecordOrderOutwardStatus.created ||
  status === RecordOrderOutwardStatus.submitted;

export interface RecordOrderOutward {
  id: string;
  record_order_id: string;
  status: string;
  eaushadhi_indent_no: string | null;
  eaushadhi_indent_status: string | null;
  sync_log_id: string | null;
  /** Populated when `status` is `failed`. */
  meta?: DvdmsSyncMeta | null;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}
/**
 * Message shown for each DVDMS failure, keyed either by `<sync_type>_<code>`
 * for wording specific to what was being synced, or by the bare `<code>` as a
 * catch-all for that code.
 *
 * Add an entry as DVDMS starts reporting a code; anything unmapped falls back
 * to `dvdms_error_unknown`.
 */
/** The codes the backend surfaces on a failed DVDMS call. */
export enum DvdmsErrorCode {
  /** No response at all — DVDMS down, DNS, timeout. */
  unreachable = "DVDMS_UNREACHABLE",
  /** DVDMS answered and refused the request. */
  rejected = "DVDMS_REJECTED",
  /** The failure was on our side. */
  internal = "INTERNAL_ERROR",
}

export const DVDMS_ERROR_KEYS: Record<string, string> = {
  save_indent_DVDMS_REJECTED: "dvdms_error_save_indent_dvdms_rejected",
  track_indent_DVDMS_REJECTED: "dvdms_error_track_indent_dvdms_rejected",
  fetch_issue_DVDMS_REJECTED: "dvdms_error_fetch_issue_dvdms_rejected",
  acknowledge_issue_DVDMS_REJECTED:
    "dvdms_error_acknowledge_issue_dvdms_rejected",
  DVDMS_REJECTED: "dvdms_error_dvdms_rejected",

  save_indent_DVDMS_UNREACHABLE: "dvdms_error_save_indent_dvdms_unreachable",
  track_indent_DVDMS_UNREACHABLE: "dvdms_error_track_indent_dvdms_unreachable",
  fetch_issue_DVDMS_UNREACHABLE: "dvdms_error_fetch_issue_dvdms_unreachable",
  acknowledge_issue_DVDMS_UNREACHABLE:
    "dvdms_error_acknowledge_issue_dvdms_unreachable",
  DVDMS_UNREACHABLE: "dvdms_error_dvdms_unreachable",

  save_indent_INTERNAL_ERROR: "dvdms_error_save_indent_internal_error",
  track_indent_INTERNAL_ERROR: "dvdms_error_track_indent_internal_error",
  fetch_issue_INTERNAL_ERROR: "dvdms_error_fetch_issue_internal_error",
  acknowledge_issue_INTERNAL_ERROR:
    "dvdms_error_acknowledge_issue_internal_error",
  INTERNAL_ERROR: "dvdms_error_internal_error",
};

/**
 * The most specific message available: the sync type and code together, then
 * the code on its own, then a generic failure.
 */
export const dvdmsErrorKey = (error?: DvdmsSyncError | null) => {
  if (!error?.code) return "dvdms_error_unknown";
  return (
    (error.sync_type && DVDMS_ERROR_KEYS[`${error.sync_type}_${error.code}`]) ||
    DVDMS_ERROR_KEYS[error.code] ||
    "dvdms_error_unknown"
  );
};

const STATUSES_WITHOUT_INDENT = ["draft", "pending", "failed", "cancelled"];

export const hasDvdmsIndent = (status: string) =>
  !STATUSES_WITHOUT_INDENT.includes(status);

export const showsDvdmsIndentStatus = (status: string) => status === "approved";

/** How far DVDMS has got with issuing against the indent. */
export enum DvdmsIndentStatus {
  issue_in_process = "issue in process",
  issued = "issued",
}

export const DVDMS_INDENT_STATUS_VARIANTS: Record<
  DvdmsIndentStatus,
  RequestOrderBadgeVariant
> = {
  [DvdmsIndentStatus.issue_in_process]: "yellow",
  [DvdmsIndentStatus.issued]: "green",
};

export const DVDMS_INDENT_STATUS_LABELS: Record<DvdmsIndentStatus, string> = {
  [DvdmsIndentStatus.issue_in_process]: "issue_in_process",
  [DvdmsIndentStatus.issued]: "issued",
};

export const toDvdmsIndentStatusKey = (status: string) =>
  status.trim().toLowerCase().replace(/\s+/g, " ") as DvdmsIndentStatus;

export enum DvdmsSyncType {
  save_indent = "save_indent",
  track_indent = "track_indent",
  fetch_issue = "fetch_issue",
  acknowledge_issue = "acknowledge_issue",
}

export enum DvdmsSyncRequestStatus {
  pending = "pending",
  success = "success",
  failure = "failure",
}

/** DVDMS reports a single issue status — the issue has been fetched from eAushadhi. */
export enum RecordInwardStatus {
  fetched = "fetched",
}

export const RECORD_INWARD_STATUS_VARIANTS: Record<
  RecordInwardStatus,
  RequestOrderBadgeVariant
> = {
  [RecordInwardStatus.fetched]: "green",
};

export const RECORD_INWARD_STATUS_LABELS: Record<RecordInwardStatus, string> = {
  [RecordInwardStatus.fetched]: "fetched",
};

/** The outcome of the last DVDMS sync against an issue. */
export interface RecordInwardSyncLog {
  id: string;
  sync_type: DvdmsSyncType;
  request_status: DvdmsSyncRequestStatus;
  http_status_code: number | null;
  retry_count: number;
  error_detail: string | null;
}

export interface RecordInward {
  id: string;
  eaushadhi_issue_no: string;
  created_at: string;
  eaushadhi_issue_status: RecordInwardStatus | null;
  outward_record: string;
  eaushadhi_indent_no: string | null;
  sync_log_id: string | null;
  sync_log: RecordInwardSyncLog | null;
  /** Populated when the last DVDMS sync against this issue failed. */
  meta?: DvdmsSyncMeta | null;
}

export interface RecordInwardItem {
  id: string;
  record_order_item: string;
  drug_id: string;
  drug_name: string;
  brand_id: string;
  batch: string;
  manufacturer: string;
  expiry_date: string | null;
  received_quantity: string;
  status: string;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}

export interface RecordInwardDetail extends RecordInward {
  items: RecordInwardItem[];
}

export enum RecordDeliveryStatus {
  pending = "pending",
  in_progress = "in_progress",
  received = "received",
  acknowledged = "acknowledged",
  acknowledgement_failed = "acknowledgement_failed",
  cancelled = "cancelled",
}

export const RECORD_DELIVERY_STATUS_VARIANTS: Record<
  RecordDeliveryStatus,
  RequestOrderBadgeVariant
> = {
  [RecordDeliveryStatus.pending]: "yellow",
  [RecordDeliveryStatus.in_progress]: "indigo",
  [RecordDeliveryStatus.received]: "green",
  [RecordDeliveryStatus.acknowledged]: "green",
  [RecordDeliveryStatus.acknowledgement_failed]: "destructive",
  [RecordDeliveryStatus.cancelled]: "destructive",
};

export const RECORD_DELIVERY_STATUS_LABELS: Record<
  RecordDeliveryStatus,
  string
> = {
  [RecordDeliveryStatus.pending]: "pending",
  [RecordDeliveryStatus.in_progress]: "in_progress",
  [RecordDeliveryStatus.received]: "delivered",
  [RecordDeliveryStatus.acknowledged]: "acknowledgement_completed",
  [RecordDeliveryStatus.acknowledgement_failed]: "acknowledgement_failed",
  [RecordDeliveryStatus.cancelled]: "cancelled",
};

export const isRecordDeliveryReceived = (
  status?: RecordDeliveryStatus,
): boolean =>
  status === RecordDeliveryStatus.received ||
  status === RecordDeliveryStatus.acknowledged ||
  status === RecordDeliveryStatus.acknowledgement_failed;

export interface RecordDeliveryPayload {
  delivery_order: string;
  record_order: string;
  status: RecordDeliveryStatus;
}

export type RecordDeliveryUpdatePayload = {
  status: RecordDeliveryStatus;
};

export interface RecordDeliveryOrder {
  id: string;
  name: string;
  destination: string;
  supplier: string;
}

export interface RecordDeliveryRecordOrder {
  id: string;
  name: string;
  category: string;
  intent: string;
  priority: string;
  reason: string;
  status: string;
  created_date: string;
  modified_date: string;
}

export interface RecordDelivery {
  id: string;
  delivery_order: RecordDeliveryOrder;
  record_order: RecordDeliveryRecordOrder;
  status: RecordDeliveryStatus;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}

export enum RecordDeliveryItemStatus {
  draft = "draft",
  active = "ACTIVE",
  reversed = "REVERSED",
}

export const RECORD_DELIVERY_ITEM_STATUS_VARIANTS: Record<
  RecordDeliveryItemStatus,
  RequestOrderBadgeVariant
> = {
  [RecordDeliveryItemStatus.draft]: "secondary",
  [RecordDeliveryItemStatus.active]: "green",
  [RecordDeliveryItemStatus.reversed]: "destructive",
};

export const RECORD_DELIVERY_ITEM_STATUS_LABELS: Record<
  RecordDeliveryItemStatus,
  string
> = {
  [RecordDeliveryItemStatus.draft]: "draft",
  [RecordDeliveryItemStatus.active]: "active",
  [RecordDeliveryItemStatus.reversed]: "reversed",
};

export interface RecordDeliveryItemInwardRecordItem {
  id: string;
  item_name: string;
  batch_number: string;
  expiry_date: string | null;
}

export interface RecordDeliveryItemSupplyDeliveryOrder {
  id: string;
  status: string;
  extensions: Record<string, unknown>;
}

export interface RecordDeliveryItemSuppliedInventoryItem {
  id: string;
  status: string;
  net_content: string;
}

export interface RecordDeliveryItemSuppliedItem {
  id: string;
  status: string;
  batch: {
    lot_number: string;
  };
}

/**
 * As serialized under a record delivery's items — the nested order, inventory
 * item and supplied item are only present on the standalone supply delivery
 * read, not here.
 */
export interface RecordDeliveryItemSupplyDelivery {
  id: string;
  status: string;
  modified_date: string;
  order?: RecordDeliveryItemSupplyDeliveryOrder;
  supplied_inventory_item?: RecordDeliveryItemSuppliedInventoryItem;
  supplied_item?: RecordDeliveryItemSuppliedItem;
  supplied_item_condition: string;
  supplied_item_pack_quantity: number;
  supplied_item_pack_size: number;
  supplied_item_quantity: number;
}

export interface RecordDeliveryItemRecordDeliveryRef {
  id: string;
  status: string;
}

export interface RecordDeliveryItemProduct {
  id: string;
  name?: string;
}

export interface RecordDeliveryItem {
  id: string;
  inward_record_item: RecordDeliveryItemInwardRecordItem;
  supply_delivery: RecordDeliveryItemSupplyDelivery | null;
  record_delivery: RecordDeliveryItemRecordDeliveryRef;
  product: RecordDeliveryItemProduct | null;
  product_knowledge: RecordDeliveryItemProduct | null;
  quantity_dispatched: string;
  quantity_accepted: string;
  quantity_damaged: string;
  quantity_short: string;
  status: RecordDeliveryItemStatus;
  deleted: boolean;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}

export interface RecordDeliveryDetail extends RecordDelivery {
  items: RecordDeliveryItem[];
  /** Populated when acknowledging this delivery to DVDMS failed. */
  meta?: DvdmsSyncMeta | null;
}

export interface RecordDeliveryItemPayload {
  inward_record_item: string;
  supply_delivery: string;
  quantity_dispatched: number;
  quantity_accepted: number;
  quantity_damaged: number;
  quantity_short: number;
}

export type RecordDeliveryItemUpdatePayload = Partial<{
  quantity_accepted: number;
  quantity_damaged: number;
  quantity_short: number;
  status: string;
}>;
