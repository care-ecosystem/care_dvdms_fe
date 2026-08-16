import { RecordOrderUser } from "@/types/recordOrder";

export interface RecordItemOrderDrug {
  id: string;
  name: string;
  brand_id: string;
  group_id: string;
  sub_group_id: string;
  unit_id: string;
  drug_category: string;
}

export interface RecordItemOrderPayload {
  supply_request: string;
  drug: RecordItemOrderDrug;
}

export interface RecordItemOrderSupplyRequestItem {
  id: string;
  alternate_identifier: string | null;
  status: string;
}

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
