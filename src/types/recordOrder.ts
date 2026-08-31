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

export interface RecordOrderOutward {
  id: string;
  record_order_id: string;
  status: string;
  eaushadhi_indent_no: string | null;
  eaushadhi_indent_status: string | null;
  sync_log_id: string | null;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}

export interface RecordInwardPayload {
  eaushadhi_issue_no: string;
  outward_record: string;
}

export interface RecordInward {
  id: string;
  eaushadhi_issue_no: string;
  created_at: string;
  eaushadhi_issue_status: string;
  outward_record: string;
  eaushadhi_indent_no: string | null;
  sync_log_id: string | null;
}

export interface RecordInwardItem {
  id: string;
  record_order_item: string;
  drug_id: string;
  drug_name: string;
  brand_id: string;
  batch: string;
  manufacturer: string;
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
  completed = "completed",
  cancelled = "cancelled",
}

export interface RecordDeliveryPayload {
  delivery_order: string;
  record_order: string;
  status: RecordDeliveryStatus;
}

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
  status: string;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}

export interface RecordDeliveryItemInwardRecordItem {
  id: string;
  item_name: string;
  batch_number: string;
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

export interface RecordDeliveryItemSupplyDelivery {
  id: string;
  status: string;
  modified_date: string;
  order: RecordDeliveryItemSupplyDeliveryOrder;
  supplied_inventory_item: RecordDeliveryItemSuppliedInventoryItem;
  supplied_item: RecordDeliveryItemSuppliedItem;
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
  name: string;
}

export interface RecordDeliveryItem {
  id: string;
  inward_record_item: RecordDeliveryItemInwardRecordItem;
  supply_delivery: RecordDeliveryItemSupplyDelivery;
  record_delivery: RecordDeliveryItemRecordDeliveryRef;
  product: RecordDeliveryItemProduct;
  product_knowledge: RecordDeliveryItemProduct;
  quantity_dispatched: number;
  quantity_accepted: number;
  quantity_damaged: number;
  quantity_short: number;
  status: string;
  deleted: boolean;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}

export interface RecordDeliveryDetail extends RecordDelivery {
  items: RecordDeliveryItem[];
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
