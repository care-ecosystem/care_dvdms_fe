export enum SupplyDeliveryStatus {
  in_progress = "in_progress",
  completed = "completed",
  abandoned = "abandoned",
  entered_in_error = "entered_in_error",
}

export enum SupplyDeliveryCondition {
  normal = "normal",
  damaged = "damaged",
}

export const SUPPLY_DELIVERY_ITEM_TYPE = "product";

export interface SupplyDeliveryCreatePayload {
  status: SupplyDeliveryStatus;
  supplied_item_condition: SupplyDeliveryCondition;
  supplied_item_quantity: string | number;
  supplied_item: string;
  supplied_item_pack_quantity: number;
  supplied_item_pack_size: number;
  total_purchase_price?: number;
  supply_request?: string;
  destination: string;
  order: string;
  extensions: Record<string, unknown>;
}

export interface SupplyDeliveryRetrieve {
  id: string;
  status: SupplyDeliveryStatus;
  supplied_item_condition: SupplyDeliveryCondition;
  supplied_item_quantity: number;
  supplied_item_pack_quantity: number;
  supplied_item_pack_size: number;
  total_purchase_price: string;
  supplied_item: { id: string; status: string; batch: { lot_number: string } };
  supplied_inventory_item: { id: string; status: string; net_content: number };
  order: { id: string; status: string };
  extensions?: Record<string, unknown>;
  created_date: string;
  modified_date: string;
}

export interface SupplyDeliveryUpsertPayload {
  id: string;
  status: SupplyDeliveryStatus;
  supplied_item_condition: SupplyDeliveryCondition;
}

/**
 * A supply delivery as the list endpoint returns it — the fields the order
 * summary needs: which supply request it fulfils, and what arrived.
 */
export interface SupplyDeliveryListItem {
  id: string;
  status: SupplyDeliveryStatus;
  supplied_item_condition?: SupplyDeliveryCondition;
  supplied_item_quantity: string | number;
  supplied_item_pack_quantity?: number;
  supplied_item_pack_size?: number;
  supplied_item?: {
    id: string;
    product_knowledge?: { id: string; name: string; slug?: string } | null;
    batch?: { lot_number?: string | null } | null;
    expiration_date?: string | null;
  } | null;
  supply_request?: {
    id: string;
    item?: { id: string; name: string } | null;
    quantity?: string | number;
  } | null;
  created_date?: string;
}

/** Deliveries in these states never counted towards what was received. */
export const VOID_SUPPLY_DELIVERY_STATUSES: SupplyDeliveryStatus[] = [
  SupplyDeliveryStatus.abandoned,
  SupplyDeliveryStatus.entered_in_error,
];
