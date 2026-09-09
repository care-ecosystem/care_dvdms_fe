import { FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate, useQueryParams } from "raviger";
import { useFieldArray, useForm } from "react-hook-form";
import { ChevronLeftIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import {
  BatchError,
  performBatchRequest,
  performSuperBatchRequest,
} from "@/apis/query";
import { HttpMethod, PaginatedResponse } from "@/apis/types";
import {
  I18N_NAMESPACE,
  LIST_FETCH_LIMIT,
  MAX_REQUESTS_PER_BATCH,
  MAX_REQUESTS_PER_SUPER_BATCH,
} from "@/lib/constants";
import { chunk, formatDate, toDateInputValue, toQuantity } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import {
  DeliveryItemFormValues,
  DeliveryItemsFormValues,
  createEmptyDeliveryItem,
} from "@/types/deliveryItemForm";
import { DeliveryOrderStatus } from "@/types/deliveryOrder";
import { DvdmsProductMapping } from "@/types/dvdms_config";
import { ProductStatus } from "@/types/inventory";
import { ProductKnowledge } from "@/types/productKnowledge";
import { RecordItemOrder } from "@/types/recordOrderItem";
import {
  ACKNOWLEDGEMENT_STATUS_LABELS,
  ACKNOWLEDGEMENT_STATUS_VARIANTS,
  RECORD_DELIVERY_ITEM_STATUS_LABELS,
  RECORD_DELIVERY_ITEM_STATUS_VARIANTS,
  RECORD_DELIVERY_STATUS_VARIANTS,
  RECORD_INWARD_STATUS_LABELS,
  RECORD_INWARD_STATUS_VARIANTS,
  DvdmsSyncRequestStatus,
  DvdmsSyncType,
  RecordDeliveryItem,
  RecordDeliveryItemStatus,
  RecordDeliveryStatus,
  RecordInwardItem,
} from "@/types/recordOrder";
import { SuperBatchRequestItem } from "@/types/superBatch";
import {
  SUPPLY_DELIVERY_ITEM_TYPE,
  SupplyDeliveryCondition,
  SupplyDeliveryStatus,
  SupplyDeliveryUpsertPayload,
} from "@/types/supplyDelivery";
import useRecordInwardDeliveries from "@/hooks/useRecordInwardDeliveries";

const MAX_ROWS_PER_SUPER_BATCH = Math.floor(MAX_REQUESTS_PER_SUPER_BATCH / 3);

const MAX_ITEMS_PER_APPROVAL_BATCH = MAX_REQUESTS_PER_SUPER_BATCH - 1;

const hasQuantity = (value: string | undefined) =>
  !!value?.trim() && Number(value) >= 1;

const listAllRecordOrderItems = async (
  instituteId: string,
  recordOrderId: string,
) => {
  const firstPage = await apis.item.list(instituteId, recordOrderId, {
    limit: LIST_FETCH_LIMIT,
  });

  const remainingOffsets: number[] = [];
  for (
    let offset = LIST_FETCH_LIMIT;
    offset < firstPage.count;
    offset += LIST_FETCH_LIMIT
  ) {
    remainingOffsets.push(offset);
  }
  if (remainingOffsets.length === 0) return firstPage.results;

  const response = await apis.batchRequests.createChunked({
    requests: remainingOffsets.map((offset) => ({
      url: apis.item.path(instituteId, recordOrderId),
      method: HttpMethod.GET,
      body: { limit: LIST_FETCH_LIMIT, offset },
      reference_id: `record_order_items_${offset}`,
    })),
  });

  return [
    ...firstPage.results,
    ...response.results.flatMap(
      (result) =>
        (result.data as PaginatedResponse<RecordItemOrder> | undefined)
          ?.results ?? [],
    ),
  ];
};

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

  const { data: recordOrderItems, isLoading: isRecordOrderItemsLoading } =
    useQuery({
      queryKey: ["dvdms_record_order_items", institute?.id, recordOrderId],
      queryFn: () => listAllRecordOrderItems(institute!.id, recordOrderId),
      enabled: !!institute?.id,
    });

  const orderProductKnowledgeByDrugId = useMemo(() => {
    const byDrugId = new Map<string, ProductKnowledge>();
    for (const recordItem of recordOrderItems ?? []) {
      if (recordItem.drug?.id && recordItem.supply_request?.item) {
        byDrugId.set(recordItem.drug.id, recordItem.supply_request.item);
      }
    }
    return byDrugId;
  }, [recordOrderItems]);

  const unmappedDrugIds = useMemo(
    () =>
      drugIds.filter((drugId) => !orderProductKnowledgeByDrugId.has(drugId)),
    [drugIds, orderProductKnowledgeByDrugId],
  );

  const { data: mappingsByDrugId, isError: isMappingsError } = useQuery({
    queryKey: [
      "dvdms_product_mappings_by_drug",
      institute?.id,
      unmappedDrugIds,
    ],
    queryFn: async () => {
      const resultsPerChunk = await Promise.all(
        chunk(unmappedDrugIds, MAX_REQUESTS_PER_BATCH).map((drugIdChunk) =>
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
    enabled:
      !!institute?.id &&
      !isRecordOrderItemsLoading &&
      unmappedDrugIds.length > 0,
  });

  /** The record order first, then whatever the mapping lookup filled in. */
  const productKnowledgeByDrugId = useMemo(() => {
    const byDrugId = new Map<string, ProductKnowledge>(
      orderProductKnowledgeByDrugId,
    );
    for (const [drugId, mapping] of mappingsByDrugId ?? []) {
      if (mapping?.product_knowledge && !byDrugId.has(drugId)) {
        byDrugId.set(drugId, mapping.product_knowledge);
      }
    }
    return byDrugId;
  }, [orderProductKnowledgeByDrugId, mappingsByDrugId]);

  const supplyRequestByRecordItemId = useMemo(() => {
    const byRecordItemId = new Map<string, string>();
    for (const recordItem of recordOrderItems ?? []) {
      if (recordItem.supply_request?.id) {
        byRecordItemId.set(recordItem.id, recordItem.supply_request.id);
      }
    }
    return byRecordItemId;
  }, [recordOrderItems]);

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

  const isDrugLookupPending =
    unmappedDrugIds.length > 0 && !mappingsByDrugId && !isMappingsError;

  const isLoadingItems =
    isLoadingApiItems ||
    isRecordInwardsLoading ||
    isRecordOrderItemsLoading ||
    isDrugLookupPending ||
    isLoadingSavedItems;

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
        eaushadhi_expiry: toDateInputValue(item.expiry_date),
        expiry_date: toDateInputValue(item.expiry_date),
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

  useEffect(() => {
    if (savedInwardItemIds.size === 0) return;
    const savedRowIndices = fields
      .map((field, index) => ({ field, index }))
      .filter(({ field }) => savedInwardItemIds.has(field.inward_record_item))
      .map(({ index }) => index);
    if (savedRowIndices.length > 0) remove(savedRowIndices);
  }, [savedInwardItemIds, fields, remove]);

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
      if (!item.expiry_date) {
        toast.error(t("expiry_date_required_at_row", { row }));
        return false;
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
      if (dispatched > 0 && accountedFor !== dispatched) {
        toast.error(
          t("quantities_must_match_dispatched_at_row", {
            row,
            dispatched,
            accountedFor,
          }),
        );
        return false;
      }
    }

    return true;
  };

  const buildRowRequests = (
    item: DeliveryItemFormValues,
    index: number,
    recordDeliveryId: string,
  ): SuperBatchRequestItem[] => {
    const quantity = toQuantity(item.received_quantity);
    const productRef = `product-${index}`;
    const supplyDeliveryRef = `supply-delivery-${index}`;

    const requests: SuperBatchRequestItem[] = [
      {
        reference_id: productRef,
        url: apis.products.path(facilityId),
        method: HttpMethod.POST,
        body: {
          status: ProductStatus.active,
          batch: item.eaushadhi_batch
            ? { lot_number: item.eaushadhi_batch }
            : {},
          expiration_date: item.expiry_date,
          product_knowledge: item.product_knowledge!.slug,
          charge_item_definition: null,
          standard_pack_size: quantity,
          purchase_price: 0,
          extensions: {},
        },
      },
      {
        reference_id: supplyDeliveryRef,
        url: apis.supplyDeliveries.path,
        method: HttpMethod.POST,
        body: {
          supplied_item_type: SUPPLY_DELIVERY_ITEM_TYPE,
          status: SupplyDeliveryStatus.in_progress,
          supplied_item_condition: SupplyDeliveryCondition.normal,
          supplied_item_quantity: quantity,
          supplied_item: "",
          supplied_item_pack_quantity: 1,
          supplied_item_pack_size: quantity,
          total_purchase_price: 0,
          supply_request: supplyRequestByRecordItemId.get(
            inwardItemById.get(item.inward_record_item)?.record_order_item ??
              "",
          ),
          destination: locationId,
          order: deliveryOrderId,
          extensions: {},
        },
        replacements: [
          {
            source_path: { reference_id: productRef, path: "id" },
            value_path: {
              reference_id: supplyDeliveryRef,
              path: "supplied_item",
            },
          },
        ],
      },
    ];

    // Rows added by hand have no eAushadhi item to record against.
    if (!item.inward_record_item) return requests;

    const deliveryItemRef = `delivery-item-${index}`;
    requests.push({
      reference_id: deliveryItemRef,
      url: apis.recordInwards.deliveryItemsPath(
        institute!.id,
        inwardRecord!.id,
        recordDeliveryId,
      ),
      method: HttpMethod.POST,
      body: {
        inward_record_item: item.inward_record_item,
        supply_delivery: "",
        quantity_dispatched: toQuantity(item.quantity_dispatched),
        quantity_accepted: quantity,
        quantity_damaged: toQuantity(item.quantity_damaged),
        quantity_short: toQuantity(item.quantity_short),
      },
      replacements: [
        {
          source_path: { reference_id: supplyDeliveryRef, path: "id" },
          value_path: {
            reference_id: deliveryItemRef,
            path: "supply_delivery",
          },
        },
      ],
    });

    return requests;
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

      const rows = data.items.map((item, index) => ({
        index,
        requests: buildRowRequests(item, index, recordDeliveryId),
      }));
      let failedCount = 0;

      // A batch is one transaction, so chunk by row to keep each product and
      // supply delivery together with the item that references them.
      const rowChunks = chunk(rows, MAX_ROWS_PER_SUPER_BATCH);
      const chunkResults = await Promise.allSettled(
        rowChunks.map((rowChunk) =>
          performSuperBatchRequest({
            requests: rowChunk.flatMap((row) => row.requests),
          }),
        ),
      );

      const savedIndices: number[] = [];
      const failureMessages: string[] = [];
      chunkResults.forEach((result, chunkIndex) => {
        const rowChunk = rowChunks[chunkIndex];
        if (result.status === "fulfilled") {
          savedIndices.push(...rowChunk.map((row) => row.index));
          return;
        }
        failedCount += rowChunk.length;
        if (result.reason instanceof BatchError) {
          failureMessages.push(...result.reason.errorMessages);
        }
      });

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
        toast.error(
          failureMessages[0] ||
            t("delivery_items_save_failed", { count: failedCount }),
        );
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

  const approveItemsMutation = useMutation({
    mutationFn: async () => {
      if (!institute?.id || !inwardRecord?.id || !recordDelivery?.id) {
        throw new Error("Missing institute, inward record or record delivery");
      }
      const instituteId = institute.id;
      const inwardRecordId = inwardRecord.id;
      const recordDeliveryId = recordDelivery.id;

      const chunks = chunk(pendingSavedItems, MAX_ITEMS_PER_APPROVAL_BATCH);

      await Promise.all(
        chunks.map((itemChunk) =>
          performSuperBatchRequest({
            requests: [
              {
                reference_id: "supply-delivery-upsert",
                url: apis.supplyDeliveries.upsertPath,
                method: HttpMethod.POST,
                body: {
                  datapoints: itemChunk.map(
                    (item): SupplyDeliveryUpsertPayload => ({
                      id: item.supply_delivery.id,
                      status: SupplyDeliveryStatus.completed,
                      supplied_item_condition: SupplyDeliveryCondition.normal,
                    }),
                  ),
                },
              },
              ...itemChunk.map((item) => ({
                reference_id: `delivery-item-${item.id}`,
                url: apis.recordInwards.deliveryItemPath(
                  instituteId,
                  inwardRecordId,
                  recordDeliveryId,
                  item.id,
                ),
                method: HttpMethod.PATCH,
                body: { status: RecordDeliveryItemStatus.active },
              })),
            ],
          }),
        ),
      );
    },
    onSuccess: () => {
      toast.success(
        t("delivery_items_approved", { count: pendingSavedItems.length }),
      );
    },
    onError: (error: unknown) => {
      const message =
        error instanceof BatchError
          ? error.errorMessages[0]
          : (error as { message?: string })?.message;
      toast.error(message || t("delivery_items_approve_failed"));
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
      const deliveryOrder = recordDelivery.delivery_order;

      return performSuperBatchRequest({
        requests: [
          {
            reference_id: "record-delivery",
            url: apis.recordInwards.deliveryPath(
              institute.id,
              inwardRecord.id,
              recordDelivery.id,
            ),
            method: HttpMethod.PATCH,
            body: { status: RecordDeliveryStatus.completed },
          },
          {
            reference_id: "delivery-order",
            url: apis.deliveryOrders.path(facilityId, deliveryOrder.id),
            method: HttpMethod.PATCH,
            body: {
              id: deliveryOrder.id,
              status: DeliveryOrderStatus.completed,
              name: deliveryOrder.name,
              destination: deliveryOrder.destination,
              supplier: deliveryOrder.supplier,
            },
          },
        ],
      });
    },
    onSuccess: () => {
      toast.success(t("record_delivery_approved"));
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_deliveries"] });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_delivery_detail"],
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof BatchError
          ? error.errorMessages[0]
          : (error as { message?: string })?.message;
      toast.error(message || t("record_delivery_approve_failed"));
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

  /** The issue's last sync, only when it was an acknowledgement attempt. */
  const acknowledgement =
    inwardRecord?.sync_log?.sync_type === DvdmsSyncType.acknowledge_issue
      ? inwardRecord.sync_log
      : undefined;

  const failedAcknowledgement =
    acknowledgement?.request_status === DvdmsSyncRequestStatus.failure
      ? acknowledgement
      : undefined;

  // Once submitted, the acknowledgement outcome is the meaningful status.
  const showAcknowledgementStatus =
    recordDeliveryStatus === RecordDeliveryStatus.completed &&
    !!acknowledgement;

  const hasFailedAcknowledgement =
    showAcknowledgementStatus && !!failedAcknowledgement;

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
                : t("mark_as_completed")}
              <ShortcutBadge actionId="mark-as" />
            </Button>
          )}
        </div>

        {isLoadingContext || isLoadingItems ? (
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
                      {!recordDeliveryStatus ? (
                        <div className="text-lg font-semibold text-gray-950">
                          —
                        </div>
                      ) : showAcknowledgementStatus ? (
                        <Badge
                          className="rounded-sm"
                          variant={
                            ACKNOWLEDGEMENT_STATUS_VARIANTS[
                              acknowledgement.request_status
                            ] ?? "secondary"
                          }
                          title={
                            failedAcknowledgement
                              ? (failedAcknowledgement.error_detail ??
                                (failedAcknowledgement.http_status_code
                                  ? t("acknowledgement_failed_with_status", {
                                      status:
                                        failedAcknowledgement.http_status_code,
                                    })
                                  : undefined))
                              : undefined
                          }
                        >
                          {t(
                            ACKNOWLEDGEMENT_STATUS_LABELS[
                              acknowledgement.request_status
                            ] ?? acknowledgement.request_status,
                          )}
                        </Badge>
                      ) : (
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
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("dvdms_status")}
                    </label>
                    <div>
                      {inwardRecord?.eaushadhi_issue_status ? (
                        <Badge
                          className="rounded-sm"
                          variant={
                            RECORD_INWARD_STATUS_VARIANTS[
                              inwardRecord.eaushadhi_issue_status
                            ] ?? "secondary"
                          }
                        >
                          {t(
                            RECORD_INWARD_STATUS_LABELS[
                              inwardRecord.eaushadhi_issue_status
                            ] ?? inwardRecord.eaushadhi_issue_status,
                          )}
                        </Badge>
                      ) : (
                        <div className="text-lg font-semibold text-gray-950">
                          —
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {savedItems.length > 0 && (
              <Card className="mb-4 py-4 rounded-md">
                <CardContent className="space-y-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      {t("items_already_added")}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {t("items_already_added_description")}
                    </p>
                  </div>
                  <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-gray-100">
                          <TableRow className="divide-x divide-gray-200">
                            <TableHead className="min-w-[200px] text-xs font-semibold">
                              {t("drug")}
                            </TableHead>
                            <TableHead className="min-w-[120px] text-xs font-semibold">
                              {t("batch")}
                            </TableHead>
                            <TableHead className="min-w-[130px] text-xs font-semibold">
                              {t("expiry")}
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
                              {t("received")}
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-right">
                              {t("short")}
                            </TableHead>
                            <TableHead className="text-xs font-semibold">
                              {t("status")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {savedItems.map((item) => {
                            // A saved item carries the batch but not the
                            // expiry, so the issue's own item supplies it.
                            const inwardItem = inwardItemById.get(
                              item.inward_record_item.id,
                            );

                            return (
                              <TableRow
                                key={item.id}
                                className="divide-x divide-gray-200"
                              >
                                <TableCell className="p-2 text-sm text-gray-900">
                                  <div className="flex flex-col whitespace-normal">
                                    <span>
                                      {item.inward_record_item.item_name || "—"}
                                    </span>
                                    {inwardItem?.drug_id && (
                                      <span className="text-xs text-gray-500">
                                        {t("drug_id")}: {inwardItem.drug_id}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="p-2 text-sm text-gray-900">
                                  {item.inward_record_item.batch_number || "—"}
                                </TableCell>
                                <TableCell className="p-2 text-sm text-gray-900">
                                  {formatDate(inwardItem?.expiry_date)}
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
                                  {item.quantity_accepted ?? "—"}
                                </TableCell>
                                <TableCell className="p-2 text-sm text-right tabular-nums">
                                  {item.quantity_short ?? "—"}
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
                  {pendingSavedItems.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-gray-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {t("approve_delivery_items")}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {t("approve_delivery_items_description", {
                            count: pendingSavedItems.length,
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        className="shrink-0"
                        onClick={() => approveItemsMutation.mutate()}
                        disabled={approveItemsMutation.isPending}
                      >
                        {approveItemsMutation.isPending
                          ? t("approving")
                          : t("mark_items_as_approved")}
                      </Button>
                    </div>
                  )}
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
                                  colSpan={3}
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
                                  {t("received_qty")}
                                </TableHead>
                                <TableHead
                                  rowSpan={2}
                                  className="w-24 text-xs font-semibold"
                                >
                                  {t("short")}
                                </TableHead>
                              </TableRow>
                              <TableRow className="divide-x divide-gray-200">
                                <TableHead className="min-w-[200px] text-xs font-semibold">
                                  {t("drug")}
                                </TableHead>
                                <TableHead className="min-w-[120px] text-xs font-semibold">
                                  {t("batch")}
                                </TableHead>
                                <TableHead className="min-w-[130px] text-xs font-semibold border-r">
                                  {t("expiry")}
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
