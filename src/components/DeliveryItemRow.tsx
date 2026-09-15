import { FC } from "react";
import { useTranslation } from "react-i18next";
import { UseFormReturn } from "react-hook-form";

import { I18N_NAMESPACE } from "@/lib/constants";
import { cn, formatDate, toQuantity } from "@/lib/utils";
import { FormControl, FormField, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import ProductKnowledgeSelect from "@/components/ProductKnowledgeSelect";
import { useDeliveryRowItem } from "@/hooks/useDeliveryRowItem";
import {
  DeliveryItemFormValues,
  DeliveryItemsFormValues,
} from "@/types/deliveryItemForm";

const QUANTITY_INPUT_CLASS = "h-9 w-full min-w-[3.5rem]";

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

  const { productKnowledge, setField, resetFields, markAsEdited } =
    useDeliveryRowItem({ form, index, facilityId });

  const row = form.getValues(`items.${index}`);

  const readQuantity = (field: keyof DeliveryItemFormValues) =>
    toQuantity(form.getValues(`items.${index}.${field}`) as string);

  const dispatched = readQuantity("quantity_dispatched");
  const damagedLimit = Math.max(0, dispatched - readQuantity("quantity_short"));
  const receivedLimit = Math.max(
    0,
    dispatched - readQuantity("quantity_damaged"),
  );

  const applyDamaged = (value: string) => {
    const total = readQuantity("quantity_dispatched");
    const short = readQuantity("quantity_short");
    const damaged = Math.min(toQuantity(value), Math.max(0, total - short));
    setField("quantity_damaged", String(damaged));
    setField("received_quantity", String(total - damaged - short));
  };

  const applyReceived = (value: string) => {
    const total = readQuantity("quantity_dispatched");
    const damaged = readQuantity("quantity_damaged");
    const received = Math.min(toQuantity(value), Math.max(0, total - damaged));
    setField("received_quantity", String(received));
    setField("quantity_short", String(total - damaged - received));
  };

  const readOnlyQuantityClass = "bg-gray-100 text-gray-600 disabled:opacity-100";

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

      {/*
        eAushadhi expiry of the issued batch. It is only editable when eAushadhi
        did not send one, since a product still needs an expiry to be created.
      */}
      <TableCell className="align-top p-2 text-sm text-gray-900">
        {row.eaushadhi_expiry ? (
          formatDate(row.eaushadhi_expiry)
        ) : (
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
                    className="h-9 w-full min-w-0"
                  />
                </FormControl>
                <FormMessage />
              </>
            )}
          />
        )}
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
                  className="w-full"
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

      <TableCell className="align-top p-2">
        <Input
          value={productKnowledge?.product_type ?? ""}
          placeholder="-"
          disabled
          readOnly
          className="w-full min-w-0 bg-gray-50 capitalize cursor-default disabled:opacity-100 disabled:text-gray-950"
        />
      </TableCell>

      <TableCell className="align-top p-2">
        <FormField
          control={form.control}
          name={`items.${index}.quantity_dispatched`}
          rules={{ required: true, min: 0 }}
          render={({ field }) => (
            <>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={0}
                  disabled
                  className={cn(QUANTITY_INPUT_CLASS, readOnlyQuantityClass)}
                />
              </FormControl>
              <FormMessage />
            </>
          )}
        />
      </TableCell>

      {/* Damaged */}
      <TableCell className="align-top p-2">
        <FormField
          control={form.control}
          name={`items.${index}.quantity_damaged`}
          rules={{ required: true, min: 0 }}
          render={({ field }) => (
            <>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={0}
                  max={damagedLimit}
                  onChange={(event) => {
                    field.onChange(event);
                    applyDamaged(event.target.value);
                  }}
                  className={QUANTITY_INPUT_CLASS}
                />
              </FormControl>
              <FormMessage />
            </>
          )}
        />
      </TableCell>

      {/* Received (accepted into CARE stock) */}
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
                  max={receivedLimit}
                  onChange={(event) => {
                    field.onChange(event);
                    applyReceived(event.target.value);
                  }}
                  disabled={!canUpdateReceivedQuantity}
                  className={cn(
                    QUANTITY_INPUT_CLASS,
                    !canUpdateReceivedQuantity && readOnlyQuantityClass,
                  )}
                />
              </FormControl>
              <FormMessage />
            </>
          )}
        />
      </TableCell>

      {/* Short — the dispatched balance left over once damaged and received are known */}
      <TableCell className="align-top p-2">
        <FormField
          control={form.control}
          name={`items.${index}.quantity_short`}
          rules={{ required: true, min: 0 }}
          render={({ field }) => (
            <>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={0}
                  disabled
                  className={cn(QUANTITY_INPUT_CLASS, readOnlyQuantityClass)}
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
