import { Product } from "@/types/inventory";
import { ProductKnowledge } from "@/types/productKnowledge";

export type DeliveryItemFormValues = {
  // eAushadhi inward item — read-only
  inward_record_item: string;
  drug_id: string;
  drug_name: string;
  eaushadhi_batch: string;
  eaushadhi_expiry: string;
  received_quantity: string;
  quantity_dispatched: string;
  quantity_damaged: string;
  quantity_short: string;

  // CARE product
  product_knowledge?: ProductKnowledge;
  supplied_item?: Product;
  expiry_date: string;
  charge_item_category?: string;
  charge_item_definition?: { slug: string };
  unit_price?: string;
  purchase_price?: string;
  is_manually_edited?: boolean;
};

export type DeliveryItemsFormValues = {
  items: DeliveryItemFormValues[];
};

export const createEmptyDeliveryItem = (): DeliveryItemFormValues => ({
  inward_record_item: "",
  drug_id: "",
  drug_name: "",
  eaushadhi_batch: "",
  eaushadhi_expiry: "",
  received_quantity: "",
  quantity_dispatched: "",
  quantity_damaged: "0",
  quantity_short: "0",
  product_knowledge: undefined,
  supplied_item: undefined,
  expiry_date: "",
  unit_price: "0",
});
