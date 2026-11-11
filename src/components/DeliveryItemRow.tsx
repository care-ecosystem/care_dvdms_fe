import { FC } from "react";
import { useTranslation } from "react-i18next";
import { UseFormReturn, useWatch } from "react-hook-form";

import { I18N_NAMESPACE } from "@/lib/constants";
import { cn, formatDate, toQuantity } from "@/lib/utils";
import { FormControl, FormField, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import ProductKnowledgeSelect from "@/components/ProductKnowledgeSelect";
import { useDeliveryRowItem } from "@/hooks/useDeliveryRowItem";
import { packSizeOf } from "@/hooks/useDvdmsUnits";
import {
  DeliveryItemFormValues,
  DeliveryItemsFormValues,
} from "@/types/deliveryItemForm";
import { DvdmsLookupUnit } from "@/types/dvdms_config";

const QUANTITY_INPUT_CLASS = "h-9 w-full min-w-[3.5rem]";

type DeliveryItemRowProps = {
  form: UseFormReturn<DeliveryItemsFormValues>;
  index: number;
  facilityId: string;
  /** The DVDMS unit the drug is mapped to — read-only, it is not the user's to pick. */
  unit?: DvdmsLookupUnit;
  /** What the order asked for, from the item's CARE supply request. */
  requestedQuantity?: number;
};

const DeliveryItemRow: FC<DeliveryItemRowProps> = ({
  form,
  index,
  facilityId,
  unit,
  requestedQuantity,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const { productKnowledge, setField, resetFields, markAsEdited } =
    useDeliveryRowItem({ form, index, facilityId });

  const row = form.getValues(`items.${index}`);

  const readQuantity = (field: keyof DeliveryItemFormValues) =>
    toQuantity(form.getValues(`items.${index}.${field}`) as string);

  // Watched, not read once: the derived cells below have to follow the two
  // quantities the user edits.
  const watchedGood = useWatch({
    control: form.control,
    name: `items.${index}.received_quantity`,
  });
  const watchedDamaged = useWatch({
    control: form.control,
    name: `items.${index}.quantity_damaged`,
  });

  const dispatched = readQuantity("quantity_dispatched");

  /** What physically arrived, whatever condition it is in. */
  const physicalReceived = toQuantity(watchedGood) + toQuantity(watchedDamaged);
  /**
   * Damaged plus missing — everything that cannot go into stock.
   *
   * Display only: the API's `quantity_short` carries the missing count alone,
   * because the backend rejects accepted + damaged + short > dispatched.
   */
  const shortage = Math.max(0, dispatched - toQuantity(watchedGood));
  const remainingToFulfill =
    requestedQuantity != null
      ? Math.max(0, requestedQuantity - toQuantity(watchedGood))
      : undefined;
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

  const readOnlyQuantityClass =
    "bg-gray-100 text-gray-600 disabled:opacity-100";

  // Product and expiry only matter for stock, so a row with nothing received skips them.
  const requiredWhenReceived = {
    validate: (value: unknown) =>
      !!value || readQuantity("received_quantity") === 0,
  };

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
              {t("id")}: {row.drug_id}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell className="align-top p-2 text-sm text-gray-900">
        {row.eaushadhi_batch || "—"}
      </TableCell>

      <TableCell className="align-top p-2 text-sm text-gray-900 whitespace-nowrap">
        {unit ? `${unit.gstrUnitName} (${packSizeOf(unit)})` : "—"}
      </TableCell>

      <TableCell className="align-top p-2 text-sm text-gray-900">
        {row.eaushadhi_expiry ? (
          formatDate(row.eaushadhi_expiry)
        ) : (
          <FormField
            control={form.control}
            name={`items.${index}.expiry_date`}
            rules={requiredWhenReceived}
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

      {/* CARE product knowledge */}
      <TableCell className="align-top p-2">
        <FormField
          control={form.control}
          name={`items.${index}.product_knowledge`}
          rules={requiredWhenReceived}
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
              {/* {productKnowledge?.slug && (
                <span className="mt-1 block text-xs text-gray-500 break-all">
                  {t("slug")}: {productKnowledge.slug}
                </span>
              )} */}
              <FormMessage />
            </>
          )}
        />
      </TableCell>

      <TableCell className="align-top p-2 text-sm text-gray-900 tabular-nums">
        {requestedQuantity ?? "—"}
      </TableCell>

      <TableCell className="align-top p-2 text-sm text-gray-900 tabular-nums">
        {dispatched}
      </TableCell>

      {/* Physical received — good plus damaged, derived */}
      <TableCell className="align-top p-2 text-sm text-gray-900 tabular-nums">
        {physicalReceived}
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
          rules={{ required: true, min: 0 }}
          render={({ field }) => (
            <>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={0}
                  max={receivedLimit}
                  onChange={(event) => {
                    field.onChange(event);
                    applyReceived(event.target.value);
                  }}
                  className={QUANTITY_INPUT_CLASS}
                />
              </FormControl>
              <FormMessage />
            </>
          )}
        />
      </TableCell>

      {/* Shortage — damaged plus missing, derived */}
      <TableCell className="align-top p-2 text-sm text-gray-900 tabular-nums">
        {shortage}
      </TableCell>

      {/* What is still owed on the order: requested less the good quantity */}
      <TableCell
        className={cn(
          "align-top p-2 text-sm text-gray-900 tabular-nums",
          !!remainingToFulfill && "font-semibold text-red-700",
        )}
      >
        {remainingToFulfill ?? "—"}
      </TableCell>
    </TableRow>
  );
};

export default DeliveryItemRow;
