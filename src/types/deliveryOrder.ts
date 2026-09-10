export enum DeliveryOrderStatus {
  draft = "draft",
  pending = "pending",
  completed = "completed",
  abandoned = "abandoned",
  entered_in_error = "entered_in_error",
}

export interface DeliveryOrderCreatePayload {
  status: DeliveryOrderStatus;
  name: string;
  note?: string;
  supplier?: string;
  origin?: string;
  destination: string;
  extensions: Record<string, unknown>;
}

export interface DeliveryOrderUpdatePayload {
  id: string;
  status: DeliveryOrderStatus;
  name: string;
  destination: string;
  supplier: string;
}

export interface DeliveryOrderRetrieve {
  id: string;
  status: DeliveryOrderStatus;
  name: string;
  note?: string;
  created_date: string;
}
