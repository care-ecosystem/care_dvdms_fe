import { ProductKnowledge } from "@/types/productKnowledge";
import { RecordOrderUser } from "@/types/recordOrder";

export interface RecordItemOrderDrug {
  id: string;
  name: string;
  brand_id: string;
  group_id: string;
  // Optional in the API spec (defaults to ""); absent for drugs with no subgroup.
  sub_group_id?: string;
  unit_id: string;
  drug_category: string;
}

export interface RecordItemOrderPayload {
  supply_request: string;
  drug: RecordItemOrderDrug;
}

export type RecordItemOrderSupplyRequestItem = ProductKnowledge;

export interface RecordItemOrderSupplyRequestOrder {
  id: string;
  status: string;
  name: string;
  category: string;
  intent: string;
  priority: string;
  reason: string;
}

export interface RecordItemOrderSupplyRequest {
  id: string;
  item: RecordItemOrderSupplyRequestItem;
  order: RecordItemOrderSupplyRequestOrder;
  quantity: string;
  status: string;
}

export interface RecordItemOrder {
  id: string;
  supply_request: RecordItemOrderSupplyRequest;
  drug: RecordItemOrderDrug;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}
