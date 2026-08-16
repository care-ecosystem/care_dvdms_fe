export interface TagConfigBase {
  id: string;
  display: string;
  parent?: TagConfigBase;
}

export interface TagConfig extends TagConfigBase {
  has_children: boolean;
}

export const REQUEST_ORDER_TAG_RESOURCE = "supply_request_order";
