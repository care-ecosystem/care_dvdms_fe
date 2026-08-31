import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueries, useQuery } from "@tanstack/react-query";
import { navigate } from "raviger";
import { useFieldArray, useForm } from "react-hook-form";
import { PlusCircle, Trash2, XIcon } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import DisablingCover from "@/components/DisablingCover";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import { RecordInwardItem } from "@/types/recordOrder";

type AddDeliveryItemsPageProps = {
  facilityId: string;
  locationId: string;
  requestOrderId: string;
  deliveryOrderId: string;
};

type DeliveryItemFormValues = {
  product_name: string;
  batch: string;
  expiry_date: string;
  category: string;
  pack_size: string;
  pack_quantity: string;
  quantity: string;
  item_price: string;
  purchase_price: string;
  total_purchase_price: string;
  tax: string;
};

type DeliveryItemsFormValues = {
  items: DeliveryItemFormValues[];
};

const createEmptyItem = (): DeliveryItemFormValues => ({
  product_name: "",
  batch: "",
  expiry_date: "",
  category: "",
  pack_size: "",
  pack_quantity: "",
  quantity: "",
  item_price: "",
  purchase_price: "",
  total_purchase_price: "",
  tax: "",
});

const AddDeliveryItemsPage: FC<AddDeliveryItemsPageProps> = (props) => (
  <ShortcutProvider>
    <AddDeliveryItemsPageContent {...props} />
  </ShortcutProvider>
);

const AddDeliveryItemsPageContent: FC<AddDeliveryItemsPageProps> = ({
  facilityId,
  locationId,
  requestOrderId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  useShortcutSubContext("facility:inventory");
  const [isProcessing, setIsProcessing] = useState(false);

  const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/${requestOrderId}`;

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });

  const { data: recordOrdersData, isLoading: isRecordOrderLoading } = useQuery(
    {
      queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
      queryFn: () =>
        apis.recordOrders.list(institute!.id, {
          order: requestOrderId,
          limit: 1,
        }),
      enabled: !!institute?.id,
    },
  );
  const recordOrder = recordOrdersData?.results?.[0];

  const { data: outwardData, isLoading: isOutwardLoading } = useQuery({
    queryKey: ["dvdms_record_order_outward", institute?.id, recordOrder?.id],
    queryFn: () =>
      apis.recordOrderOutward.list(institute!.id, recordOrder!.id, {
        limit: 1,
      }),
    enabled: !!institute?.id && !!recordOrder?.id,
  });
  const outward = outwardData?.results?.[0];

  const { data: recordInwardsData, isLoading: isRecordInwardsLoading } =
    useQuery({
      queryKey: ["dvdms_record_inwards", institute?.id, outward?.id],
      queryFn: () =>
        apis.recordInwards.list(institute!.id, {
          limit: 100,
          ordering: "-created_at",
        }),
      enabled: !!institute?.id && !!outward?.id,
    });

  const recordInwards = (recordInwardsData?.results ?? []).filter(
    (inward) => inward.outward_record === outward?.id,
  );

  const recordInwardDetailQueries = useQueries({
    queries: recordInwards.map((inward) => ({
      queryKey: ["dvdms_record_inward_detail", institute?.id, inward.id],
      queryFn: () => apis.recordInwards.retrieve(institute!.id, inward.id),
      enabled: !!institute?.id,
    })),
  });

  const isLoadingApiItems = recordInwardDetailQueries.some(
    (query) => query.isLoading,
  );

  const apiItems: RecordInwardItem[] = recordInwardDetailQueries.flatMap(
    (query) => query.data?.items ?? [],
  );

  const form = useForm<DeliveryItemsFormValues>({
    defaultValues: { items: [] },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (isLoadingApiItems || fields.length > 0 || apiItems.length === 0) {
      return;
    }
    replace(
      apiItems.map((item) => ({
        ...createEmptyItem(),
        product_name: item.drug_name,
        batch: item.batch,
        quantity: item.received_quantity,
      })),
    );
  }, [isLoadingApiItems, apiItems, fields.length, replace]);

  const handleAddItem = () => append(createEmptyItem());

  const onSubmit = form.handleSubmit((data) => {
    if (data.items.length === 0) {
      toast.error(t("at_least_one_item_required"));
      return;
    }
    setIsProcessing(true);
    toast.info(t("delivery_items_submit_not_implemented"));
    setIsProcessing(false);
  });

  const isLoadingContext =
    isRecordOrderLoading || isOutwardLoading || isRecordInwardsLoading;

  return (
    <div className="md:px-6 py-0 min-w-0">
      <div className="container mx-auto max-w-6xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {t("add_delivery_items")}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t("add_delivery_items_description")}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(returnPath)}
          >
            <XIcon className="size-5" />
            <span className="sr-only">{t("close")}</span>
          </Button>
        </div>

        {isLoadingContext || isLoadingApiItems ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <DisablingCover disabled={isProcessing} message={t("saving")}>
            <Card className="bg-gray-50 py-4 rounded-md">
              <CardContent className="space-y-4">
                {fields.length > 0 ? (
                  <Form {...form}>
                    <form onSubmit={onSubmit} className="space-y-6">
                      <div className="rounded-md border border-gray-200 bg-white shadow overflow-hidden">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-gray-100">
                              <TableRow className="divide-x divide-gray-200">
                                <TableHead
                                  rowSpan={2}
                                  className="min-w-[180px] text-xs font-semibold"
                                >
                                  {t("product")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="min-w-[140px] text-xs font-semibold"
                                >
                                  {t("batch")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="min-w-[130px] text-xs font-semibold"
                                >
                                  {t("expiry")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="min-w-[140px] text-xs font-semibold text-center"
                                >
                                  {t("category")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="w-20 text-xs font-semibold"
                                >
                                  {t("pack_size")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="w-28 text-xs font-semibold"
                                >
                                  {t("pack_qty")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="w-32 text-xs font-semibold"
                                >
                                  {t("qty")}
                                </TableHead>
                                <TableHead
                                  colSpan={1}
                                  className="text-xs font-semibold text-center border-b"
                                >
                                  {t("sale")}
                                </TableHead>
                                <TableHead
                                  colSpan={2}
                                  className="text-xs font-semibold text-center border-b"
                                >
                                  {t("purchase")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="min-w-[120px] text-xs font-semibold"
                                >
                                  {t("tax")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="text-xs font-semibold"
                                >
                                  {t("actions")}
                                </TableHead>
                              </TableRow>
                              <TableRow className="divide-x divide-gray-200">
                                <TableHead className="min-w-[100px] text-xs font-semibold">
                                  {t("item_price")}
                                </TableHead>
                                <TableHead className="min-w-[100px] text-xs font-semibold">
                                  {t("pr")}
                                </TableHead>
                                <TableHead className="min-w-[120px] text-xs font-semibold border-r">
                                  {t("tpr")}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {fields.map((field, index) => (
                                <TableRow
                                  key={field.id}
                                  className="divide-x divide-gray-200"
                                >
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.product_name`}
                                      rules={{ required: true }}
                                      render={({ field }) => (
                                        <>
                                          <FormControl>
                                            <Input
                                              className="h-9"
                                              placeholder={t("select_product")}
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.batch`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            className="h-9"
                                            placeholder={t("batch")}
                                            {...field}
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.expiry_date`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            type="date"
                                            className="h-9"
                                            {...field}
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.category`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            className="h-9"
                                            placeholder={t("category")}
                                            {...field}
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.pack_size`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={0}
                                            className="h-9"
                                            {...field}
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.pack_quantity`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={0}
                                            className="h-9"
                                            {...field}
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.quantity`}
                                      rules={{ required: true, min: 1 }}
                                      render={({ field }) => (
                                        <>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              min={1}
                                              className="h-9"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.item_price`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={0}
                                            className="h-9"
                                            {...field}
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.purchase_price`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={0}
                                            className="h-9"
                                            {...field}
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.total_purchase_price`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={0}
                                            className="h-9"
                                            {...field}
                                          />
                                        </FormControl>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.tax`}
                                      render={({ field }) => (
                                        <FormControl>
                                          <Input className="h-9" {...field} />
                                        </FormControl>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top p-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => remove(index)}
                                      aria-label={t("remove")}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="flex flex-row gap-2 mt-4 items-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddItem}
                        >
                          <PlusCircle className="mr-2 size-4" />
                          {t("add_another")}
                        </Button>
                      </div>

                      <div className="flex justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isProcessing}
                          onClick={() => form.reset()}
                        >
                          {t("cancel")}
                        </Button>
                        <div className="flex space-x-3">
                          <Button type="submit" disabled={isProcessing}>
                            {isProcessing ? t("saving") : t("save")}
                            <ShortcutBadge actionId="submit-action" />
                          </Button>
                        </div>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="flex flex-col gap-3 items-center">
                    <h4>{t("add_items_to_delivery")}</h4>
                    <p>{t("add_items_to_delivery_description")}</p>
                    <div className="flex flex-row gap-2 items-center mt-2">
                      <Button
                        type="button"
                        variant="outline_primary"
                        onClick={handleAddItem}
                      >
                        <PlusCircle className="mr-2 size-4" />
                        {t("add_item")}
                        <ShortcutBadge actionId="add-item" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </DisablingCover>
        )}
      </div>
    </div>
  );
};

export default AddDeliveryItemsPage;
