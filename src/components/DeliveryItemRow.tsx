import { FC } from "react";
import { useTranslation } from "react-i18next";
import { UseFormReturn } from "react-hook-form";

import { I18N_NAMESPACE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { FormControl, FormField, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import ProductKnowledgeSelect from "@/components/ProductKnowledgeSelect";
import ResourceCategoryPicker from "@/components/ResourceCategoryPicker";
import { useDeliveryRowItem } from "@/hooks/useDeliveryRowItem";
import { DeliveryItemsFormValues } from "@/types/deliveryItemForm";
import { ResourceCategoryType } from "@/types/productKnowledge";

type DeliveryItemRowProps = {
  form: UseFormReturn<DeliveryItemsFormValues>;
  index: number;
  facilityId: string;
  canUpdateReceivedQuantity?: boolean;
};

const DeliveryItemRow: FC<DeliveryItemRowProps> = ({
  form,
  index,
  facilityId,
  canUpdateReceivedQuantity = false,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const {
    productKnowledge,
    suppliedItem,
    chargeItemCategory,
    needsCategorySelection,
    setField,
    resetFields,
    markAsEdited,
  } = useDeliveryRowItem({ form, index, facilityId });

  const row = form.getValues(`items.${index}`);

  return (
    <TableRow className="divide-x divide-gray-200 hover:bg-gray-50/50">
      {/* eAushadhi drug */}
      <TableCell className="align-top p-2">
        <div className="flex flex-col whitespace-normal">
          <span className="text-sm font-medium text-gray-900">
            {row.drug_name || "—"}
          </span>
          {row.drug_id && (
            <span className="text-xs text-gray-500">
              {t("drug_id")}: {row.drug_id}
            </span>
          )}
        </div>
      </TableCell>

      {/* eAushadhi batch — also the lot number of the CARE product */}
      <TableCell className="align-top p-2 text-sm text-gray-900">
        {row.eaushadhi_batch || "—"}
      </TableCell>

      {/* CARE product knowledge — its slug is shown once one is picked */}
      <TableCell className="align-top p-2">
        <FormField
          control={form.control}
          name={`items.${index}.product_knowledge`}
          rules={{ required: true }}
          render={({ field }) => (
            <>
              <FormControl>
                <ProductKnowledgeSelect
                  facilityId={facilityId}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    resetFields();
                  }}
                  placeholder={t("select_product")}
                  className="w-full min-w-[180px]"
                  hideClearButton
                />
              </FormControl>
              {productKnowledge?.slug && (
                <span className="mt-1 block text-xs text-gray-500 break-all">
                  {t("slug")}: {productKnowledge.slug}
                </span>
              )}
              <FormMessage />
            </>
          )}
        />
      </TableCell>

      {/* Expiry */}
      <TableCell className="align-top p-2">
        <FormField
          control={form.control}
          name={`items.${index}.expiry_date`}
          rules={{ required: true }}
          render={({ field }) => (
            <>
              <FormControl>
                <Input
                  {...field}
                  type="date"
                  onChange={(event) => {
                    field.onChange(event);
                    markAsEdited();
                  }}
                  disabled={!productKnowledge}
                  className="h-9 w-full min-w-[10rem]"
                />
              </FormControl>
              <FormMessage />
            </>
          )}
        />
      </TableCell>

      {/* Category */}
      <TableCell className="align-top p-2 text-center">
        {needsCategorySelection ? (
          <ResourceCategoryPicker
            facilityId={facilityId}
            resourceType={ResourceCategoryType.charge_item_definition}
            value={chargeItemCategory}
            onValueChange={(category) => {
              setField("charge_item_category", category?.slug || "");
              markAsEdited();
            }}
            placeholder={t("select_category")}
            className="w-full min-w-[140px]"
          />
        ) : (
          <span className="text-sm text-gray-500">
            {suppliedItem?.charge_item_definition?.category?.title || "-"}
          </span>
        )}
      </TableCell>
      
      <TableCell className="align-top p-2">
        <FormField
          control={form.control}
          name={`items.${index}.received_quantity`}
          rules={{ required: true, min: 1 }}
          render={({ field }) => (
            <>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={1}
                  disabled={!canUpdateReceivedQuantity}
                  className={cn(
                    "h-9 w-28",
                    !canUpdateReceivedQuantity &&
                      "bg-gray-100 text-gray-600 disabled:opacity-100",
                  )}
                />
              </FormControl>
              <FormMessage />
            </>
          )}
        />
      </TableCell>
    </TableRow>
  );
};

export default DeliveryItemRow;
