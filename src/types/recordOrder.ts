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
  status: string;
  created_by: RecordOrderUser | null;
  updated_by: RecordOrderUser | null;
  created_date: string;
  modified_date: string;
}
