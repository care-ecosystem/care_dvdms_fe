import { TagConfig } from "@/types/tagConfig";

export interface RequestOrderOrganization {
  id: string;
  name: string;
}

export interface RequestOrderUser {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email?: string;
}

export interface RequestOrder {
  id: string;
  status: string;
  name: string;
  note: string | null;
  intent: string;
  category: string;
  priority: string;
  reason: string;
  destination: RequestOrderOrganization | null;
  supplier: RequestOrderOrganization | null;
  origin: RequestOrderOrganization | null;
  tags: TagConfig[];
  created_by: RequestOrderUser | null;
  created_date: string;
}

export interface AvailableRequestOrderLocation {
  id: string;
  name: string;
  status: string;
  operational_status: string;
  form: string;
}

export interface AvailableRequestOrderSupplier {
  id: string;
  name: string;
  active: boolean;
  org_type: string;
}

export interface AvailableRequestOrder {
  id: string;
  name: string;
  category: string;
  intent: string;
  priority: string;
  reason: string;
  status: string;
  note: string | null;
  tags: TagConfig[];
  origin: AvailableRequestOrderLocation | null;
  destination: AvailableRequestOrderLocation | null;
  supplier: AvailableRequestOrderSupplier | null;
  item_count: number;
  created_by: RequestOrderUser | null;
  updated_by: RequestOrderUser | null;
  created_date: string;
  modified_date: string;
}

export type RequestOrderBadgeVariant =
  | "secondary"
  | "yellow"
  | "green"
  | "destructive"
  | "indigo";

export const REQUEST_ORDER_STATUS_VARIANTS: Record<
  string,
  RequestOrderBadgeVariant
> = {
  draft: "secondary",
  pending: "yellow",
  approved: "indigo",
  completed: "green",
  rejected: "destructive",
  cancelled: "destructive",
  failed: "destructive",
  created: "yellow",
  submitted: "green",
};

export const REQUEST_ORDER_PRIORITY_VARIANTS: Record<
  string,
  RequestOrderBadgeVariant
> = {
  stat: "secondary",
  urgent: "yellow",
  asap: "destructive",
  routine: "indigo",
};
