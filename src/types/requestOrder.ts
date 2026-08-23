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
