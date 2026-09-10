import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UseFormReturn, useWatch } from "react-hook-form";

import { apis } from "@/apis";
import { LIST_FETCH_LIMIT } from "@/lib/constants";
import { toDateInputValue } from "@/lib/utils";
import {
  DeliveryItemFormValues,
  DeliveryItemsFormValues,
} from "@/types/deliveryItemForm";
import { Product, getBasePriceComponent } from "@/types/inventory";

type ItemPath = `items.${number}.${keyof DeliveryItemFormValues}`;

type UseDeliveryRowItemProps = {
  form: UseFormReturn<DeliveryItemsFormValues>;
  index: number;
  facilityId: string;
};

export function useDeliveryRowItem({
  form,
  index,
  facilityId,
}: UseDeliveryRowItemProps) {
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const item = useWatch({ control: form.control, name: `items.${index}` });

  const {
    product_knowledge: productKnowledge,
    supplied_item: suppliedItem,
    charge_item_category: chargeItemCategory,
    is_manually_edited: isManuallyEdited,
    eaushadhi_expiry: eaushadhiExpiry,
  } = item || {};

  const setField = useCallback(
    <K extends keyof DeliveryItemFormValues>(
      field: K,
      value: DeliveryItemFormValues[K],
    ) => {
      form.setValue(`items.${index}.${field}` as ItemPath, value);
    },
    [form, index],
  );

  const resetFields = useCallback(() => {
    const fieldsToReset: Partial<DeliveryItemFormValues> = {
      supplied_item: undefined,
      expiry_date: eaushadhiExpiry ?? "",
      charge_item_definition: undefined,
      unit_price: "0",
      purchase_price: undefined,
      charge_item_category: undefined,
      is_manually_edited: false,
    };

    Object.entries(fieldsToReset).forEach(([field, value]) => {
      setField(
        field as keyof DeliveryItemFormValues,
        value as DeliveryItemFormValues[keyof DeliveryItemFormValues],
      );
    });
    setIsCreatingNew(false);
  }, [setField, eaushadhiExpiry]);

  const markAsEdited = useCallback(() => {
    setField("is_manually_edited", true);
    setField("supplied_item", undefined);
    setIsCreatingNew(true);
  }, [setField]);

  const { data: productsData } = useQuery({
    queryKey: ["dvdms_products", facilityId, productKnowledge?.slug],
    queryFn: () =>
      apis.products.list(facilityId, {
        product_knowledge: productKnowledge!.slug,
        ordering: "-created_date",
        limit: LIST_FETCH_LIMIT,
        status: "active",
      }),
    enabled: !!productKnowledge?.slug,
  });
  const products = useMemo(() => productsData?.results ?? [], [productsData]);

  const fillFromProduct = useCallback(
    (product: Product) => {
      resetFields();

      setField("supplied_item", product);
      if (!eaushadhiExpiry && product.expiration_date) {
        setField("expiry_date", toDateInputValue(product.expiration_date));
      }
      if (product.purchase_price != null) {
        setField("purchase_price", product.purchase_price);
      }

      const chargeItemDefinition = product.charge_item_definition;
      if (!chargeItemDefinition) return;

      setField("charge_item_definition", {
        slug: chargeItemDefinition.slug,
      });
      if (chargeItemDefinition.category?.slug) {
        setField("charge_item_category", chargeItemDefinition.category.slug);
      }

      const base = getBasePriceComponent(chargeItemDefinition);
      if (base?.amount) {
        setField("unit_price", base.amount);
      }
    },
    [resetFields, setField, eaushadhiExpiry],
  );


  useEffect(() => {
    const isManuallyEdited = form.getValues(
      `items.${index}.is_manually_edited`,
    );
    if (products.length === 0 || suppliedItem || isManuallyEdited) {
      return;
    }

    const eaushadhiBatch = form.getValues(`items.${index}.eaushadhi_batch`);
    const matchingProduct = eaushadhiBatch
      ? products.find(
          (product) =>
            product.batch?.lot_number?.toLowerCase() ===
            eaushadhiBatch.toLowerCase(),
        )
      : undefined;

    fillFromProduct(matchingProduct ?? products[0]);
  }, [products, suppliedItem, index, form, fillFromProduct]);

  const needsCategorySelection = useMemo(() => {
    if (!productKnowledge) return false;
    if (suppliedItem?.charge_item_definition?.category) return false;
    return isCreatingNew || isManuallyEdited || products.length === 0;
  }, [
    productKnowledge,
    suppliedItem,
    products.length,
    isCreatingNew,
    isManuallyEdited,
  ]);

  return {
    productKnowledge,
    suppliedItem,
    chargeItemCategory,

    needsCategorySelection,

    setField,
    resetFields,
    markAsEdited,
  };
}
