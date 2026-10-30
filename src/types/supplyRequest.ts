export interface SupplyRequestItem {
  id: string;
  name: string;
  base_unit?: { display: string } | null;
  category?: { title: string } | null;
}

export interface SupplyRequest {
  id: string;
  item: SupplyRequestItem;
  quantity: string | number;
}
