import { FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate, useQueryParams } from "raviger";
import { useFieldArray, useForm } from "react-hook-form";
import { ChevronLeftIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import { BatchError, performBatchRequest } from "@/apis/query";
import { HttpMethod, PaginatedResponse } from "@/apis/types";
import {
  I18N_NAMESPACE,
  LIST_FETCH_LIMIT,
  MAX_REQUESTS_PER_BATCH,
} from "@/lib/constants";
import { chunk } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form } from "@/components/ui/form";
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
import BackButton from "@/components/BackButton";
import DeliveryItemRow from "@/components/DeliveryItemRow";
import ReceiveStockDialog from "@/components/ReceiveStockDialog";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import {
  DeliveryItemFormValues,
  DeliveryItemsFormValues,
  createEmptyDeliveryItem,
} from "@/types/deliveryItemForm";
import { DvdmsProductMapping } from "@/types/dvdms_config";
import {
  BASE_PRICE_COMPONENT,
  ChargeItemDefinitionStatus,
  Product,
  ProductStatus,
} from "@/types/inventory";
import { ProductKnowledge } from "@/types/productKnowledge";
import {
  RECORD_DELIVERY_ITEM_STATUS_LABELS,
  RECORD_DELIVERY_ITEM_STATUS_VARIANTS,
  RECORD_DELIVERY_STATUS_VARIANTS,
  DvdmsSyncRequestStatus,
  DvdmsSyncType,
  RecordDeliveryItem,
  RecordDeliveryItemStatus,
  RecordDeliveryStatus,
  RecordInwardItem,
} from "@/types/recordOrder";
import {
  SupplyDeliveryCondition,
  SupplyDeliveryStatus,
} from "@/types/supplyDelivery";
import useRecordInwardDeliveries from "@/hooks/useRecordInwardDeliveries";

const toQuantity = (value: string | undefined) =>
  Math.max(0, Math.round(Number(value) || 0));

const hasQuantity = (value: string | undefined) =>
  !!value?.trim() && Number(value) >= 1;

const toPrice = (value: number) => Number(value.toFixed(6));

const isPendingReceipt = (item: RecordDeliveryItem) =>
  item.status === RecordDeliveryItemStatus.draft &&
  item.supply_delivery.status === SupplyDeliveryStatus.in_progress;

type AddDeliveryItemsPageProps = {
  facilityId: string;
  locationId: string;
  requestOrderId: string;
  recordOrderId: string;
  deliveryOrderId: string;
};

const AddDeliveryItemsPage: FC<AddDeliveryItemsPageProps> = (props) => (
  <ShortcutProvider>
    <AddDeliveryItemsPageContent {...props} />
  </ShortcutProvider>
);

const AddDeliveryItemsPageContent: FC<AddDeliveryItemsPageProps> = ({
  facilityId,
  locationId,
  requestOrderId,
  recordOrderId,
  deliveryOrderId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  useShortcutSubContext("facility:inventory");
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSavedItemIds, setSelectedSavedItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [isReceiveStockOpen, setIsReceiveStockOpen] = useState(false);

  const [{ issue: issueId }] = useQueryParams<{ issue?: string }>();

  const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/${requestOrderId}/record/${recordOrderId}`;

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });

  const { data: recordOrdersData, isLoading: isRecordOrderLoading } = useQuery({
    queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
    queryFn: () =>
      apis.recordOrders.list(institute!.id, {
        order: requestOrderId,
        limit: LIST_FETCH_LIMIT,
      }),
    enabled: !!institute?.id,
  });
  const recordOrder = recordOrdersData?.results?.find(
    (item) => item.id === recordOrderId,
  );

  const { data: outwardData, isLoading: isOutwardLoading } = useQuery({
    queryKey: ["dvdms_record_order_outward", institute?.id, recordOrder?.id],
    queryFn: () =>
      apis.recordOrderOutward.list(institute!.id, recordOrder!.id, {
        limit: 1,
      }),
    enabled: !!institute?.id && !!recordOrder?.id,
  });
  const outward = outwardData?.results?.[0];

  const {
    inwardRecord: fallbackInwardRecord,
    inwardRecords,
    deliveriesByInwardId,
    isLoading: isRecordInwardsLoading,
  } = useRecordInwardDeliveries(institute?.id, outward?.id, {
    inwardRecordId: issueId,
  });

  const deliveryOwner = inwardRecords
    .map((record) => ({
      inwardRecord: record,
      recordDelivery: (deliveriesByInwardId.get(record.id) ?? []).find(
        (delivery) => delivery.delivery_order.id === deliveryOrderId,
      ),
    }))
    .find((entry) => !!entry.recordDelivery);

  const inwardRecord = deliveryOwner?.inwardRecord ?? fallbackInwardRecord;
  const recordDelivery = deliveryOwner?.recordDelivery;
  const recordDeliveryStatus = recordDelivery?.status;

  const { data: recordDeliveryDetail, isLoading: isLoadingSavedItems } =
    useQuery({
      queryKey: [
        "dvdms_record_delivery_detail",
        institute?.id,
        inwardRecord?.id,
        recordDelivery?.id,
      ],
      queryFn: () =>
        apis.recordInwards.retrieveDelivery(
          institute!.id,
          inwardRecord!.id,
          recordDelivery!.id,
        ),
      enabled: !!institute?.id && !!inwardRecord?.id && !!recordDelivery?.id,
    });

  const savedItems = useMemo(
    () => recordDeliveryDetail?.items ?? [],
    [recordDeliveryDetail],
  );

  const savedInwardItemIds = useMemo(
    () => new Set(savedItems.map((item) => item.inward_record_item.id)),
    [savedItems],
  );

  const { data: recordInwardDetail, isLoading: isLoadingApiItems } = useQuery({
    queryKey: ["dvdms_record_inward_detail", institute?.id, inwardRecord?.id],
    queryFn: () => apis.recordInwards.retrieve(institute!.id, inwardRecord!.id),
    enabled: !!institute?.id && !!inwardRecord?.id,
  });

  const apiItems: RecordInwardItem[] = recordInwardDetail?.items ?? [];

  const drugIds = useMemo(
    () =>
      Array.from(new Set(apiItems.map((item) => item.drug_id).filter(Boolean))),
    [apiItems],
  );

  const { data: mappingsByDrugId, isLoading: isMappingsLoading } = useQuery({
    queryKey: ["dvdms_product_mappings_by_drug", institute?.id, drugIds],
    queryFn: async () => {
      const resultsPerChunk = await Promise.all(
        chunk(drugIds, MAX_REQUESTS_PER_BATCH).map((drugIdChunk) =>
          performBatchRequest({
            requests: drugIdChunk.map((drugId) => ({
              reference_id: drugId,
              url: `${apis.productMappings.path(institute!.id)}?eaushadhi_drug_id=${encodeURIComponent(drugId)}&limit=1`,
              method: HttpMethod.GET,
            })),
          }).catch((error: unknown) =>
            error instanceof BatchError ? error.results : [],
          ),
        ),
      );

      const byDrugId = new Map<string, DvdmsProductMapping>();
      for (const result of resultsPerChunk.flat()) {
        if (result.status_code > 299) continue;
        const mapping = (
          result.data as PaginatedResponse<DvdmsProductMapping> | undefined
        )?.results?.[0];
        if (mapping) byDrugId.set(result.reference_id, mapping);
      }
      return byDrugId;
    },
    enabled: !!institute?.id && drugIds.length > 0,
  });

  const productKnowledgeByDrugId = useMemo(() => {
    const byDrugId = new Map<string, ProductKnowledge>();
    for (const [drugId, mapping] of mappingsByDrugId ?? []) {
      if (mapping?.product_knowledge) {
        byDrugId.set(drugId, mapping.product_knowledge);
      }
    }
    return byDrugId;
  }, [mappingsByDrugId]);

  const { data: recordItemOrdersData } = useQuery({
    queryKey: ["dvdms_record_order_items", institute?.id, recordOrderId],
    queryFn: () =>
      apis.item.list(institute!.id, recordOrderId, { limit: LIST_FETCH_LIMIT }),
    enabled: !!institute?.id,
  });

  const supplyRequestByRecordItemId = useMemo(() => {
    const byRecordItemId = new Map<string, string>();
    for (const recordItem of recordItemOrdersData?.results ?? []) {
      if (recordItem.supply_request?.id) {
        byRecordItemId.set(recordItem.id, recordItem.supply_request.id);
      }
    }
    return byRecordItemId;
  }, [recordItemOrdersData]);

  const inwardItemById = useMemo(
    () => new Map(apiItems.map((item) => [item.id, item])),
    [apiItems],
  );

  const canUpdateReceivedQuantity =
    institute?.meta?.allow_updating_quantity_after_received ?? false;

  const form = useForm<DeliveryItemsFormValues>({
    defaultValues: { items: [] },
  });

  const { fields, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const isLoadingItems =
    isLoadingApiItems || isMappingsLoading || isLoadingSavedItems;

  const balanceItems = useMemo(
    () => apiItems.filter((item) => !savedInwardItemIds.has(item.id)),
    [apiItems, savedInwardItemIds],
  );

  useEffect(() => {
    if (isLoadingItems || fields.length > 0 || balanceItems.length === 0) {
      return;
    }
    replace(
      balanceItems.map((item) => ({
        ...createEmptyDeliveryItem(),
        inward_record_item: item.id,
        drug_id: item.drug_id,
        drug_name: item.drug_name,
        eaushadhi_batch: item.batch,
        received_quantity: item.received_quantity,
        quantity_dispatched: item.received_quantity,
        quantity_damaged: "0",
        quantity_short: "0",
        product_knowledge: productKnowledgeByDrugId.get(item.drug_id),
      })),
    );
  }, [
    isLoadingItems,
    balanceItems,
    productKnowledgeByDrugId,
    fields.length,
    replace,
  ]);

  const validateItems = (items: DeliveryItemFormValues[]) => {
    if (items.length === 0) {
      toast.error(t("at_least_one_item_required"));
      return false;
    }

    for (const [index, item] of items.entries()) {
      const row = index + 1;

      if (!item.product_knowledge?.slug) {
        toast.error(t("select_product_at_row", { row }));
        return false;
      }
      if (!item.supplied_item || item.is_manually_edited) {
        if (!item.expiry_date) {
          toast.error(t("expiry_date_required_at_row", { row }));
          return false;
        }
        if (!item.charge_item_category) {
          toast.error(t("category_required_at_row", { row }));
          return false;
        }
      }
      if (!hasQuantity(item.received_quantity)) {
        toast.error(t("received_qty_required_at_row", { row }));
        return false;
      }

      // The backend rejects received + damaged + short > dispatched.
      const dispatched = toQuantity(item.quantity_dispatched);
      const accountedFor =
        toQuantity(item.received_quantity) +
        toQuantity(item.quantity_damaged) +
        toQuantity(item.quantity_short);
      if (dispatched > 0 && accountedFor > dispatched) {
        toast.error(
          t("quantities_exceed_dispatched_at_row", { row, dispatched }),
        );
        return false;
      }
    }

    return true;
  };

  const processRowItem = async (
    item: DeliveryItemFormValues,
    index: number,
    recordDeliveryId: string,
  ) => {
    let productId = item.supplied_item?.id;
    let chargeItemSlug = item.charge_item_definition?.slug;

    if (!productId || item.is_manually_edited) {
      if (item.is_manually_edited) {
        productId = undefined;
        chargeItemSlug = undefined;
      }

      if (!chargeItemSlug) {
        const chargeItemDefinition = await apis.chargeItemDefinitions.create(
          facilityId,
          {
            slug_value: crypto.randomUUID(),
            category: item.charge_item_category!,
            title: `${item.product_knowledge!.name}${
              item.eaushadhi_batch ? ` - ${item.eaushadhi_batch}` : ""
            }`,
            status: ChargeItemDefinitionStatus.active,
            can_edit_charge_item: false,
            price_components: [
              {
                monetary_component_type: BASE_PRICE_COMPONENT,
                amount: item.unit_price || "0",
              },
            ],
            discount_configuration: null,
          },
        );
        chargeItemSlug = chargeItemDefinition.slug;
        form.setValue(`items.${index}.charge_item_definition`, {
          slug: chargeItemSlug,
        });
        form.setValue(`items.${index}.is_manually_edited`, false);
      }

      if (!productId) {
        const product = await apis.products.create(facilityId, {
          status: ProductStatus.active,
          batch: item.eaushadhi_batch
            ? { lot_number: item.eaushadhi_batch }
            : {},
          expiration_date: item.expiry_date,
          product_knowledge: item.product_knowledge!.slug,
          charge_item_definition: chargeItemSlug,
          purchase_price: item.purchase_price,
          extensions: {},
        });
        productId = product.id;
        form.setValue(`items.${index}.supplied_item`, {
          id: productId,
        } as Product);
      }
    }

    const quantity = toQuantity(item.received_quantity);
    const supplyDelivery = await apis.supplyDeliveries.create({
      status: SupplyDeliveryStatus.in_progress,
      supplied_item_condition: SupplyDeliveryCondition.normal,
      supplied_item_quantity: quantity,
      supplied_item: productId!,
      supplied_item_pack_quantity: 1,
      supplied_item_pack_size: quantity,
      total_purchase_price: item.purchase_price
        ? toPrice(parseFloat(item.purchase_price) * quantity)
        : undefined,
      supply_request: supplyRequestByRecordItemId.get(
        inwardItemById.get(item.inward_record_item)?.record_order_item ?? "",
      ),
      destination: locationId,
      order: deliveryOrderId,
      extensions: {},
    });

    // Rows added by hand have no eAushadhi item to record against.
    if (!item.inward_record_item) return;

    await apis.recordInwards.createDeliveryItem(
      institute!.id,
      inwardRecord!.id,
      recordDeliveryId,
      {
        inward_record_item: item.inward_record_item,
        supply_delivery: supplyDelivery.id,
        quantity_dispatched: toQuantity(item.quantity_dispatched),
        quantity_accepted: quantity,
        quantity_damaged: toQuantity(item.quantity_damaged),
        quantity_short: toQuantity(item.quantity_short),
      },
    );
  };

  const onSubmit = form.handleSubmit(async (data) => {
    if (!institute?.id || !inwardRecord?.id) {
      toast.error(t("failed_to_save_delivery_items"));
      return;
    }
    if (!validateItems(data.items)) return;

    setIsProcessing(true);
    try {
      const recordDeliveryId =
        recordDelivery?.id ??
        (
          await apis.recordInwards.createDelivery(
            institute.id,
            inwardRecord.id,
            {
              delivery_order: deliveryOrderId,
              record_order: recordOrderId,
              status: RecordDeliveryStatus.pending,
            },
          )
        ).id;

      const results = await Promise.allSettled(
        data.items.map((item, index) =>
          processRowItem(item, index, recordDeliveryId).then(() => index),
        ),
      );

      const savedIndices = results
        .map((result) => (result.status === "fulfilled" ? result.value : null))
        .filter((index): index is number => index !== null);
      const failedCount = results.length - savedIndices.length;

      if (savedIndices.length > 0) {
        toast.success(
          t("delivery_items_saved", { count: savedIndices.length }),
        );

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["dvdms_record_deliveries"],
          }),
          queryClient.invalidateQueries({
            queryKey: ["dvdms_record_delivery_detail"],
          }),
          queryClient.invalidateQueries({
            queryKey: ["dvdms_record_inward_detail"],
          }),
          queryClient.invalidateQueries({ queryKey: ["dvdms_products"] }),
        ]);

        [...savedIndices]
          .sort((a, b) => b - a)
          .forEach((index) => remove(index));
      }
      if (failedCount > 0) {
        toast.error(t("delivery_items_save_failed", { count: failedCount }));
      }
    } catch (error) {
      toast.error(
        (error as { message?: string })?.message ||
          t("failed_to_save_delivery_items"),
      );
    } finally {
      setIsProcessing(false);
    }
  });

  const pendingSavedItems = useMemo(
    () => savedItems.filter(isPendingReceipt),
    [savedItems],
  );

  useEffect(() => {
    const pendingIds = new Set(pendingSavedItems.map((item) => item.id));
    setSelectedSavedItemIds((previous) => {
      const next = new Set([...previous].filter((id) => pendingIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [pendingSavedItems]);

  const selectedSavedItems = pendingSavedItems.filter((item) =>
    selectedSavedItemIds.has(item.id),
  );

  const receiveStockMutation = useMutation({
    mutationFn: async ({
      status,
      condition,
    }: {
      status: SupplyDeliveryStatus;
      condition: SupplyDeliveryCondition;
    }) => {
      await apis.supplyDeliveries.upsert(
        selectedSavedItems.map((item) => ({
          id: item.supply_delivery.id,
          status,
          supplied_item_condition: condition,
        })),
      );

      if (
        status !== SupplyDeliveryStatus.completed ||
        condition !== SupplyDeliveryCondition.normal ||
        !institute?.id ||
        !inwardRecord?.id ||
        !recordDelivery?.id
      ) {
        return;
      }

      const results = await Promise.allSettled(
        selectedSavedItems.map((item) =>
          apis.recordInwards.updateDeliveryItem(
            institute.id,
            inwardRecord.id,
            recordDelivery.id,
            item.id,
            { status: RecordDeliveryItemStatus.active },
          ),
        ),
      );

      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;
      if (failedCount > 0) {
        throw new Error(
          t("delivery_items_activate_failed", { count: failedCount }),
        );
      }
    },
    onSuccess: () => {
      toast.success(t("stock_updated"));
      setIsReceiveStockOpen(false);
      setSelectedSavedItemIds(new Set());
    },
    onError: (error: { message?: string }) => {
      toast.error(error?.message || t("stock_update_failed"));
    },

    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["dvdms_record_delivery_detail"],
        }),
        queryClient.invalidateQueries({ queryKey: ["dvdms_products"] }),
      ]);
    },
  });

  const approveDeliveryMutation = useMutation({
    mutationFn: () => {
      if (!institute?.id || !inwardRecord?.id || !recordDelivery?.id) {
        throw new Error("Missing institute, inward record or record delivery");
      }
      return apis.recordInwards.updateDelivery(
        institute.id,
        inwardRecord.id,
        recordDelivery.id,
        { status: RecordDeliveryStatus.completed },
      );
    },
    onSuccess: () => {
      toast.success(t("record_delivery_approved"));
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_deliveries"] });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_delivery_detail"],
      });
    },
    onError: (error: { message?: string }) => {
      toast.error(error?.message || t("record_delivery_approve_failed"));
    },
  });

  const retryAcknowledgementMutation = useMutation({
    mutationFn: () => {
      if (!institute?.id || !inwardRecord?.id || !recordDelivery?.id) {
        throw new Error("Missing institute, inward record or record delivery");
      }
      return apis.recordInwards.retryDeliveryAcknowledgement(
        institute.id,
        inwardRecord.id,
        recordDelivery.id,
      );
    },
    onSuccess: () => {
      toast.success(t("acknowledgement_retry_queued"));
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_inwards"] });
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_deliveries"] });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_delivery_detail"],
      });
    },
    onError: (error: { message?: string }) => {
      toast.error(error?.message || t("acknowledgement_retry_failed"));
    },
  });


  const failedAcknowledgement =
    inwardRecord?.sync_log?.sync_type === DvdmsSyncType.acknowledge_issue &&
    inwardRecord.sync_log.request_status === DvdmsSyncRequestStatus.failure
      ? inwardRecord.sync_log
      : undefined;

  const hasFailedAcknowledgement =
    !!recordDelivery?.id && !!failedAcknowledgement;

  const canApproveDelivery =
    !!recordDelivery?.id &&
    recordDeliveryStatus !== RecordDeliveryStatus.completed &&
    recordDeliveryStatus !== RecordDeliveryStatus.cancelled &&
    fields.length === 0 &&
    savedItems.length > 0 &&
    !isProcessing;

  const hasUnreceivedItems = pendingSavedItems.length > 0;

  const isLoadingContext =
    isRecordOrderLoading || isOutwardLoading || isRecordInwardsLoading;

  return (
    <div className="md:px-6 py-0 min-w-0">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-start gap-4 mb-6">
          <BackButton
            size="icon"
            className="shrink-0"
            onClick={() => navigate(returnPath)}
          >
            <ChevronLeftIcon className="size-4" />
            <span className="sr-only">{t("back")}</span>
          </BackButton>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">
              {t("add_delivery_items")}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t("add_delivery_items_description")}
            </p>
          </div>
          {hasFailedAcknowledgement && (
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => retryAcknowledgementMutation.mutate()}
              disabled={retryAcknowledgementMutation.isPending}
              title={
                failedAcknowledgement?.error_detail ??
                (failedAcknowledgement?.http_status_code
                  ? t("acknowledgement_failed_with_status", {
                      status: failedAcknowledgement.http_status_code,
                    })
                  : undefined)
              }
            >
              <RefreshCw className="size-4" />
              {retryAcknowledgementMutation.isPending
                ? t("retrying")
                : t("retry_acknowledgement")}
            </Button>
          )}
          {canApproveDelivery && (
            <Button
              type="button"
              className="shrink-0"
              onClick={() => approveDeliveryMutation.mutate()}
              disabled={approveDeliveryMutation.isPending || hasUnreceivedItems}
              title={
                hasUnreceivedItems
                  ? t("receive_all_items_to_approve")
                  : undefined
              }
            >
              {approveDeliveryMutation.isPending
                ? t("saving")
                : t("mark_as_approved")}
              <ShortcutBadge actionId="mark-as" />
            </Button>
          )}
        </div>

        {isLoadingContext || isLoadingItems || isProcessing ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <Card className="mb-4">
              <CardContent className="space-y-1 p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("deliver_to")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950">
                      {recordOrder?.institute_store?.store.name ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("supplier")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950">
                      {recordOrder?.institute_supplier?.supplier?.name ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("status")}
                    </label>
                    <div>
                      {recordDeliveryStatus ? (
                        <Badge
                          className="rounded-sm"
                          variant={
                            RECORD_DELIVERY_STATUS_VARIANTS[
                              recordDeliveryStatus
                            ] ?? "secondary"
                          }
                        >
                          {t(recordDeliveryStatus)}
                        </Badge>
                      ) : (
                        <div className="text-lg font-semibold text-gray-950">
                          —
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      {t("eaushadhi_indent_status")}
                    </label>
                    <div>
                      <Badge className="rounded-sm" variant="secondary">
                        {outward?.eaushadhi_indent_status ?? "—"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("care_indent_no")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950">
                      {recordOrder?.care_indent_no ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("eaushadhi_indent_no")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950">
                      {outward?.eaushadhi_indent_no ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("issue_no")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950">
                      {inwardRecord?.eaushadhi_issue_no ?? "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {savedItems.length > 0 && (
              <Card className="mb-4 py-4 rounded-md">
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">
                        {t("items_already_added")}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {t("items_already_added_description")}
                      </p>
                    </div>
                    {pendingSavedItems.length > 0 && (
                      <Button
                        type="button"
                        className="shrink-0"
                        onClick={() => setIsReceiveStockOpen(true)}
                        disabled={selectedSavedItemIds.size === 0}
                      >
                        {t("receive_update_stock")}
                      </Button>
                    )}
                  </div>
                  <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-gray-100">
                          <TableRow className="divide-x divide-gray-200">
                            <TableHead className="w-10">
                              {pendingSavedItems.length > 0 && (
                                <Checkbox
                                  checked={
                                    selectedSavedItemIds.size ===
                                    pendingSavedItems.length
                                  }
                                  onCheckedChange={(checked) =>
                                    setSelectedSavedItemIds(
                                      checked
                                        ? new Set(
                                            pendingSavedItems.map(
                                              (item) => item.id,
                                            ),
                                          )
                                        : new Set(),
                                    )
                                  }
                                  aria-label={t("select_all")}
                                />
                              )}
                            </TableHead>
                            <TableHead className="min-w-[200px] text-xs font-semibold">
                              {t("drug")}
                            </TableHead>
                            <TableHead className="min-w-[120px] text-xs font-semibold">
                              {t("batch")}
                            </TableHead>
                            <TableHead className="min-w-[200px] text-xs font-semibold">
                              {t("product_knowledge")}
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-right">
                              {t("dispatched")}
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-right">
                              {t("damaged")}
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-right">
                              {t("short")}
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-right">
                              {t("received")}
                            </TableHead>
                            <TableHead className="text-xs font-semibold">
                              {t("status")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {savedItems.map((item) => {
                            const drugId = inwardItemById.get(
                              item.inward_record_item.id,
                            )?.drug_id;

                            return (
                              <TableRow
                                key={item.id}
                                className="divide-x divide-gray-200"
                              >
                                <TableCell className="p-2">
                                  {isPendingReceipt(item) && (
                                    <Checkbox
                                      checked={selectedSavedItemIds.has(
                                        item.id,
                                      )}
                                      onCheckedChange={(checked) =>
                                        setSelectedSavedItemIds((previous) => {
                                          const next = new Set(previous);
                                          if (checked) {
                                            next.add(item.id);
                                          } else {
                                            next.delete(item.id);
                                          }
                                          return next;
                                        })
                                      }
                                      aria-label={
                                        item.inward_record_item.item_name
                                      }
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="p-2 text-sm text-gray-900">
                                  <div className="flex flex-col whitespace-normal">
                                    <span>
                                      {item.inward_record_item.item_name || "—"}
                                    </span>
                                    {drugId && (
                                      <span className="text-xs text-gray-500">
                                        {t("drug_id")}: {drugId}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="p-2 text-sm text-gray-900">
                                  {item.inward_record_item.batch_number || "—"}
                                </TableCell>
                                <TableCell className="p-2 text-sm text-gray-900">
                                  {item.product_knowledge?.name || "—"}
                                </TableCell>
                                <TableCell className="p-2 text-sm text-right tabular-nums">
                                  {item.quantity_dispatched ?? "—"}
                                </TableCell>
                                <TableCell className="p-2 text-sm text-right tabular-nums">
                                  {item.quantity_damaged ?? "—"}
                                </TableCell>
                                <TableCell className="p-2 text-sm text-right tabular-nums">
                                  {item.quantity_short ?? "—"}
                                </TableCell>
                                <TableCell className="p-2 text-sm text-right tabular-nums">
                                  {item.quantity_accepted ?? "—"}
                                </TableCell>
                                <TableCell className="p-2">
                                  <Badge
                                    className="rounded-sm"
                                    variant={
                                      RECORD_DELIVERY_ITEM_STATUS_VARIANTS[
                                        item.status
                                      ] ?? "secondary"
                                    }
                                  >
                                    {t(
                                      RECORD_DELIVERY_ITEM_STATUS_LABELS[
                                        item.status
                                      ] ?? item.status,
                                    )}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <ReceiveStockDialog
                    open={isReceiveStockOpen}
                    onOpenChange={setIsReceiveStockOpen}
                    selectedCount={selectedSavedItemIds.size}
                    isPending={receiveStockMutation.isPending}
                    onConfirm={(status, condition) =>
                      receiveStockMutation.mutate({ status, condition })
                    }
                  />
                </CardContent>
              </Card>
            )}

            {fields.length > 0 && (
              <Card className="bg-gray-50 py-4 rounded-md">
                <CardContent className="space-y-4">
                  <Form {...form}>
                    <form onSubmit={onSubmit} className="space-y-6">
                      <div className="rounded-md border border-gray-200 bg-white shadow overflow-hidden">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-gray-100">
                              <TableRow className="divide-x divide-gray-200">
                                <TableHead
                                  colSpan={2}
                                  className="text-xs font-semibold text-center border-b"
                                >
                                  {t("eaushadhi")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="min-w-[200px] text-xs font-semibold"
                                >
                                  {t("product_knowledge")}
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
                                  className="w-24 text-xs font-semibold"
                                >
                                  {t("dispatched")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="w-24 text-xs font-semibold"
                                >
                                  {t("damaged")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="w-24 text-xs font-semibold"
                                >
                                  {t("short")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="w-24 text-xs font-semibold"
                                >
                                  {t("received_qty")}
                                </TableHead>
                              </TableRow>
                              <TableRow className="divide-x divide-gray-200">
                                <TableHead className="min-w-[200px] text-xs font-semibold">
                                  {t("drug")}
                                </TableHead>
                                <TableHead className="min-w-[120px] text-xs font-semibold border-r">
                                  {t("batch")}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {fields.map((field, index) => (
                                <DeliveryItemRow
                                  key={field.id}
                                  form={form}
                                  index={index}
                                  facilityId={facilityId}
                                  canUpdateReceivedQuantity={
                                    canUpdateReceivedQuantity
                                  }
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button type="submit" disabled={isProcessing}>
                          {isProcessing ? t("saving") : t("save")}
                          <ShortcutBadge actionId="submit-action" />
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AddDeliveryItemsPage;
