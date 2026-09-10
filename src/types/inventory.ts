import { ProductKnowledge, ResourceCategory } from "@/types/productKnowledge";

/**
 * A charge item definition prices an item as a list of components (base rate,
 * taxes, discounts, …). Taxes and discounts are care's business — this plugin
 * only ever reads and writes the base rate.
 */
export const BASE_PRICE_COMPONENT = "base";

export interface MonetaryComponent {
  monetary_component_type: string;
  amount?: string | null;
}

export enum ProductStatus {
  active = "active",
  inactive = "inactive",
  entered_in_error = "entered_in_error",
}

export enum ChargeItemDefinitionStatus {
  draft = "draft",
  active = "active",
  retired = "retired",
}

export interface ChargeItemDefinition {
  id: string;
  slug: string;
  title: string;
  status: ChargeItemDefinitionStatus;
  price_components: MonetaryComponent[];
  category: ResourceCategory | null;
  can_edit_charge_item: boolean;
}

export type ChargeItemDefinitionCreatePayload = {
  slug_value: string;
  category: string;
  title: string;
  status: ChargeItemDefinitionStatus;
  can_edit_charge_item: boolean;
  price_components: MonetaryComponent[];
  discount_configuration: null;
};

export interface ProductBatch {
  lot_number?: string;
}

export interface Product {
  id: string;
  status: ProductStatus;
  batch?: ProductBatch;
  expiration_date?: string;
  purchase_price?: string;
  product_knowledge: ProductKnowledge;
  charge_item_definition?: ChargeItemDefinition;
}

export type ProductCreatePayload = {
  status: ProductStatus;
  batch: ProductBatch;
  expiration_date: string;
  product_knowledge: string;
  charge_item_definition?: string | null;
  standard_pack_size?: number;
  purchase_price?: string;
  extensions: Record<string, unknown>;
};

/** The base rate of a charge item definition, if it carries one. */
export function getBasePriceComponent(
  chargeItemDefinition: ChargeItemDefinition,
): MonetaryComponent | undefined {
  return chargeItemDefinition.price_components.find(
    (component) => component.monetary_component_type === BASE_PRICE_COMPONENT,
  );
}
