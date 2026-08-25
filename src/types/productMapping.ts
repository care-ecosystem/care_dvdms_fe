import { RecordOrderUser } from "@/types/recordOrder";
import { RecordItemOrderDrug } from "@/types/recordOrderItem";

export interface ProductMappingSupplyRequestItem {
  id: string;
  status: string;
}

export interface ProductMappingSupplyRequest {
  id: string;
  item: ProductMappingSupplyRequestItem;
  quantity: string;
  status: string;
}

export interface ProductMapping {
  id: string;
  eaushadhi_drug_details: RecordItemOrderDrug;
  product_knowledge_id: string;
  usage_count: number;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}

export interface RecordOrderProductMapping {
  supply_request: ProductMappingSupplyRequest;
  product_mapping: ProductMapping | null;
}
