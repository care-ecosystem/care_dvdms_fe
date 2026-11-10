import { FC, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryParams } from "raviger";
import { UseFormReturn, useFieldArray, useForm } from "react-hook-form";
import { ChevronLeftIcon, Edit, Loader2Icon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import {
  BatchError,
  performBatchRequest,
  performSuperBatchRequest,
} from "@/apis/query";
import { HttpMethod, PaginatedResponse } from "@/apis/types";
import {
  ACKNOWLEDGEMENT_POLL_INTERVAL_MS,
  I18N_NAMESPACE,
  LIST_FETCH_LIMIT,
  MAX_REQUESTS_PER_BATCH,
  MAX_REQUESTS_PER_SUPER_BATCH,
} from "@/lib/constants";
import { dvdmsRecordPath } from "@/lib/paths";
import {
  chunk,
  cn,
  formatDate,
  toDateInputValue,
  toLocalDateInputValue,
  toQuantity,
} from "@/lib/utils";
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
import useDvdmsUnits, { packSizeOf } from "@/hooks/useDvdmsUnits";
import DvdmsIssueStatusBadge from "@/components/DvdmsIssueStatusBadge";
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
import { Product, ProductStatus } from "@/types/inventory";
import { ProductKnowledge } from "@/types/productKnowledge";
import { RecordItemOrder } from "@/types/recordOrderItem";
import {
  RECORD_DELIVERY_ITEM_STATUS_LABELS,
  RECORD_DELIVERY_ITEM_STATUS_VARIANTS,
  RECORD_DELIVERY_STATUS_LABELS,
  RECORD_DELIVERY_STATUS_VARIANTS,
  RECORD_INWARD_STATUS_LABELS,
  RECORD_INWARD_STATUS_VARIANTS,
  RecordDeliveryItem,
  RecordDeliveryItemStatus,
  RecordDeliveryStatus,
  RecordInwardItem,
  isRecordDeliveryReceived,
} from "@/types/recordOrder";
import { SuperBatchRequestItem } from "@/types/superBatch";
import {
  SUPPLY_DELIVERY_ITEM_TYPE,
  SupplyDeliveryCondition,
  SupplyDeliveryStatus,
  SupplyDeliveryRetrieve,
  SupplyDeliveryUpsertPayload,
} from "@/types/supplyDelivery";
import useRecordInwardDeliveries from "@/hooks/useRecordInwardDeliveries";

const MAX_ROWS_PER_SUPER_BATCH = Math.floor(MAX_REQUESTS_PER_SUPER_BATCH / 3);

const MAX_ITEMS_PER_APPROVAL_BATCH = MAX_REQUESTS_PER_SUPER_BATCH - 1;

/** An edited row sends at most 5 requests (see `buildEditRequests`). */
const MAX_EDIT_ROWS_PER_SUPER_BATCH = Math.floor(
  MAX_REQUESTS_PER_SUPER_BATCH / 5,
);

/** `product` and `supplyDelivery` are null when nothing was received. */
type EditRow = {
  savedItem: RecordDeliveryItem;
  product: Product | null;
  supplyDelivery: SupplyDeliveryRetrieve | null;
};

const savedExpiryOf = ({ savedItem, product }: EditRow) =>
  toDateInputValue(savedItem.inward_record_item.expiry_date) ||
  toLocalDateInputValue(product?.expiration_date);

/** CARE updates replace every field, so send the full product. */
const productUpdateBody = (
  product: Product,
  overrides: Record<string, unknown>,
) => ({
  status: product.status,
  batch: product.batch ?? {},
  expiration_date: product.expiration_date ?? null,
  standard_pack_size: product.standard_pack_size ?? null,
  purchase_price: product.purchase_price ?? null,
  extensions: product.extensions ?? {},
  ...overrides,
});

/** One at a time, like care_fe: creating supply deliveries locks the delivery order. */
const runSuperBatchesInOrder = async (batches: SuperBatchRequestItem[][]) => {
  const results: PromiseSettledResult<unknown>[] = [];
  for (const requests of batches) {
    try {
      results.push({
        status: "fulfilled",
        value: await performSuperBatchRequest({ requests }),
      });
    } catch (reason) {
      results.push({ status: "rejected", reason });
    }
  }
  return results;
};

const errorMessageOf = (error: unknown) =>
  error instanceof BatchError
    ? error.errorMessages[0]
    : (error as { message?: string })?.message;

const hasQuantity = (value: string | undefined) =>
  !!value?.trim() && Number(value) >= 0;

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
  (!item.supply_delivery ||
    item.supply_delivery.status === SupplyDeliveryStatus.in_progress);

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
  const isProcessingRef = useRef(false);

  const [{ issue: issueId }] = useQueryParams<{ issue?: string }>();

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
      refetchInterval: (query) =>
        query.state.data?.status === RecordDeliveryStatus.received
          ? ACKNOWLEDGEMENT_POLL_INTERVAL_MS
          : false,
    });

  const recordDeliveryStatus =
    recordDeliveryDetail?.status ?? recordDelivery?.status;

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

  const { unitById, isLoading: isUnitsLoading } = useDvdmsUnits(institute?.id);

  /**
   * The DVDMS unit of each drug — the record order's own drug details first,
   * then whatever the product mapping lookup filled in. Both carry the
   * `unit_id` that `lookup/units/` resolves.
   */
  const unitIdByDrugId = useMemo(() => {
    const byDrugId = new Map<string, string>();
    for (const recordItem of recordOrderItems ?? []) {
      if (recordItem.drug?.id && recordItem.drug.unit_id) {
        byDrugId.set(recordItem.drug.id, recordItem.drug.unit_id);
      }
    }
    for (const [drugId, mapping] of mappingsByDrugId ?? []) {
      const unitId = mapping?.eaushadhi_drug_details?.unit_id;
      if (unitId && !byDrugId.has(drugId)) byDrugId.set(drugId, unitId);
    }
    return byDrugId;
  }, [recordOrderItems, mappingsByDrugId]);

  const unitForDrugId = (drugId: string) => {
    const unitId = unitIdByDrugId.get(drugId);
    return unitId ? unitById.get(unitId) : undefined;
  };

  /**
   * The pack size CARE stores on the product and on the supply delivery.
   * `packSizeOf` falls back to 1 for a missing or unusable unit.
   */
  const packSizeForDrugId = (drugId: string) =>
    packSizeOf(unitForDrugId(drugId));

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
    isUnitsLoading ||
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
        received_quantity: String(toQuantity(item.received_quantity)),
        quantity_dispatched: String(toQuantity(item.received_quantity)),
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

      if (!hasQuantity(item.received_quantity)) {
        toast.error(t("received_qty_required_at_row", { row }));
        return false;
      }
      // Product and expiry are only needed for stock, so not when nothing was received.
      const isReceived = toQuantity(item.received_quantity) > 0;
      if (isReceived && !item.product_knowledge?.slug) {
        toast.error(t("select_product_at_row", { row }));
        return false;
      }
      if (isReceived && !item.expiry_date) {
        toast.error(t("expiry_date_required_at_row", { row }));
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

  const productBody = (item: DeliveryItemFormValues) => ({
    status: ProductStatus.active,
    batch: item.eaushadhi_batch ? { lot_number: item.eaushadhi_batch } : {},
    expiration_date: item.expiry_date,
    product_knowledge: item.product_knowledge!.slug,
    charge_item_definition: null,
    standard_pack_size: packSizeForDrugId(item.drug_id),
    purchase_price: 0,
    extensions: {},
  });

  const supplyDeliveryBody = (
    item: DeliveryItemFormValues,
    suppliedItem: string,
  ) => {
    const quantity = toQuantity(item.received_quantity);
    const packSize = packSizeForDrugId(item.drug_id);
    return {
      supplied_item_type: SUPPLY_DELIVERY_ITEM_TYPE,
      status: SupplyDeliveryStatus.in_progress,
      supplied_item_condition: SupplyDeliveryCondition.normal,
      // The good quantity is how many packs came in, the pack size is the
      // mapped DVDMS unit's conversion value, so the stocked quantity is the
      // two multiplied.
      supplied_item_quantity: quantity * packSize,
      supplied_item: suppliedItem,
      supplied_item_pack_quantity: quantity,
      supplied_item_pack_size: packSize,
      total_purchase_price: 0,
      supply_request: supplyRequestByRecordItemId.get(
        inwardItemById.get(item.inward_record_item)?.record_order_item ?? "",
      ),
      destination: locationId,
      order: deliveryOrderId,
      extensions: {},
    };
  };

  const buildRowRequests = (
    item: DeliveryItemFormValues,
    index: number,
    recordDeliveryId: string,
  ): SuperBatchRequestItem[] => {
    const isReceived = toQuantity(item.received_quantity) > 0;
    const productRef = `product-${index}`;
    const supplyDeliveryRef = `supply-delivery-${index}`;

    // CARE supply deliveries need a quantity of at least 1, so a row with
    // nothing received is recorded on DVDMS only.
    const requests: SuperBatchRequestItem[] = isReceived
      ? [
          {
            reference_id: productRef,
            url: apis.products.path(facilityId),
            method: HttpMethod.POST,
            body: productBody(item),
          },
          {
            reference_id: supplyDeliveryRef,
            url: apis.supplyDeliveries.path,
            method: HttpMethod.POST,
            body: supplyDeliveryBody(item, ""),
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
        ]
      : [];

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
        ...(isReceived && { supply_delivery: "" }),
        quantity_dispatched: toQuantity(item.quantity_dispatched),
        quantity_accepted: toQuantity(item.received_quantity),
        quantity_damaged: toQuantity(item.quantity_damaged),
        quantity_short: toQuantity(item.quantity_short),
      },
      replacements: isReceived
        ? [
            {
              source_path: { reference_id: supplyDeliveryRef, path: "id" },
              value_path: {
                reference_id: deliveryItemRef,
                path: "supply_delivery",
              },
            },
          ]
        : undefined,
    });

    return requests;
  };

  const invalidateDeliveryQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_deliveries"] }),
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_delivery_detail"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_inward_detail"],
      }),
      queryClient.invalidateQueries({ queryKey: ["dvdms_products"] }),
    ]);

  const onSubmit = form.handleSubmit(async (data) => {
    if (!institute?.id || !inwardRecord?.id) {
      toast.error(t("failed_to_save_delivery_items"));
      return;
    }
    if (!validateItems(data.items)) return;
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

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
      const chunkResults = await runSuperBatchesInOrder(
        rowChunks.map((rowChunk) => rowChunk.flatMap((row) => row.requests)),
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

        await invalidateDeliveryQueries();

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
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  });

  const pendingSavedItems = useMemo(
    () => savedItems.filter(isPendingReceipt),
    [savedItems],
  );

  const editForm = useForm<DeliveryItemsFormValues>({
    defaultValues: { items: [] },
  });
  const { fields: editFields, replace: replaceEditFields } = useFieldArray({
    control: editForm.control,
    name: "items",
  });
  const [editRows, setEditRows] = useState<EditRow[] | null>(null);
  const isEditingSaved = editRows !== null;

  const startEditMutation = useMutation({
    mutationFn: async (): Promise<EditRow[]> => {
      const receivedItems = pendingSavedItems.filter(
        (item) => item.supply_delivery,
      );
      if (receivedItems.some((item) => !item.product?.id)) {
        throw new Error(t("delivery_items_edit_load_failed"));
      }
      const results = await Promise.all(
        chunk(receivedItems, MAX_REQUESTS_PER_BATCH / 2).map((items) =>
          performBatchRequest({
            requests: items.flatMap((item) => [
              {
                reference_id: `product-${item.id}`,
                url: apis.products.detailPath(facilityId, item.product!.id),
                method: HttpMethod.GET,
              },
              {
                reference_id: `supply-delivery-${item.id}`,
                url: apis.supplyDeliveries.detailPath(item.supply_delivery!.id),
                method: HttpMethod.GET,
              },
            ]),
          }),
        ),
      );
      const dataByReference = new Map(
        results.flat().map((result) => [result.reference_id, result.data]),
      );
      return pendingSavedItems.map((savedItem) => ({
        savedItem,
        product:
          (dataByReference.get(`product-${savedItem.id}`) as Product) ?? null,
        supplyDelivery:
          (dataByReference.get(
            `supply-delivery-${savedItem.id}`,
          ) as SupplyDeliveryRetrieve) ?? null,
      }));
    },
    onSuccess: (rows) => {
      replaceEditFields(
        rows.map((row) => {
          const drugId =
            inwardItemById.get(row.savedItem.inward_record_item.id)?.drug_id ??
            "";
          return {
            ...createEmptyDeliveryItem(),
            inward_record_item: row.savedItem.inward_record_item.id,
            drug_id: drugId,
            drug_name: row.savedItem.inward_record_item.item_name,
            eaushadhi_batch: row.savedItem.inward_record_item.batch_number,
            eaushadhi_expiry: toDateInputValue(
              row.savedItem.inward_record_item.expiry_date,
            ),
            expiry_date: savedExpiryOf(row),
            quantity_dispatched: String(
              toQuantity(row.savedItem.quantity_dispatched),
            ),
            quantity_damaged: String(
              toQuantity(row.savedItem.quantity_damaged),
            ),
            received_quantity: String(
              toQuantity(row.savedItem.quantity_accepted),
            ),
            quantity_short: String(toQuantity(row.savedItem.quantity_short)),
            product_knowledge:
              row.product?.product_knowledge ??
              productKnowledgeByDrugId.get(drugId),
            is_manually_edited: true,
          };
        }),
      );
      setEditRows(rows);
    },
    onError: (error: unknown) => {
      toast.error(
        errorMessageOf(error) || t("delivery_items_edit_load_failed"),
      );
    },
  });

  const buildEditRequests = (
    row: EditRow,
    item: DeliveryItemFormValues,
    index: number,
  ): SuperBatchRequestItem[] => {
    const { savedItem, product, supplyDelivery } = row;
    const received = toQuantity(item.received_quantity);
    const counts = {
      quantity_accepted: received,
      quantity_damaged: toQuantity(item.quantity_damaged),
      quantity_short: toQuantity(item.quantity_short),
    };
    const areCountsChanged =
      received !== toQuantity(savedItem.quantity_accepted) ||
      counts.quantity_damaged !== toQuantity(savedItem.quantity_damaged) ||
      counts.quantity_short !== toQuantity(savedItem.quantity_short);

    // A row only has a CARE product and supply delivery while something is received.
    const wasReceived = !!product && !!supplyDelivery;
    const isReceived = received > 0;
    const isKept = wasReceived && isReceived;
    const isProductKnowledgeChanged =
      isKept &&
      item.product_knowledge?.slug !== product?.product_knowledge.slug;
    const isReceivedChanged =
      isKept && received !== toQuantity(savedItem.quantity_accepted);
    const isExpiryChanged = isKept && item.expiry_date !== savedExpiryOf(row);

    const needsNewProduct =
      isReceived && (!wasReceived || isProductKnowledgeChanged);
    const needsNewSupplyDelivery = needsNewProduct || isReceivedChanged;

    const requests: SuperBatchRequestItem[] = [];
    const newProductRef = `edit-product-${index}`;
    const newSupplyDeliveryRef = `edit-supply-delivery-${index}`;

    if (needsNewProduct) {
      requests.push({
        reference_id: newProductRef,
        url: apis.products.path(facilityId),
        method: HttpMethod.POST,
        body: productBody(item),
      });
    }

    if (product && (!isReceived || isProductKnowledgeChanged)) {
      requests.push({
        reference_id: `retire-product-${index}`,
        url: apis.products.detailPath(facilityId, product.id),
        method: HttpMethod.PUT,
        body: productUpdateBody(product, {
          status: ProductStatus.entered_in_error,
        }),
      });
    } else if (product && (isReceivedChanged || isExpiryChanged)) {
      requests.push({
        reference_id: `update-product-${index}`,
        url: apis.products.detailPath(facilityId, product.id),
        method: HttpMethod.PUT,
        body: productUpdateBody(product, {
          standard_pack_size: packSizeForDrugId(item.drug_id),
          ...(isExpiryChanged && { expiration_date: item.expiry_date }),
        }),
      });
    }

    if (supplyDelivery && (!isReceived || needsNewSupplyDelivery)) {
      requests.push({
        reference_id: `abandon-supply-delivery-${index}`,
        url: apis.supplyDeliveries.detailPath(supplyDelivery.id),
        method: HttpMethod.PUT,
        body: {
          status: SupplyDeliveryStatus.abandoned,
          supplied_item_condition: supplyDelivery.supplied_item_condition,
          total_purchase_price: supplyDelivery.total_purchase_price,
          extensions: supplyDelivery.extensions ?? {},
        },
      });
    }

    if (needsNewSupplyDelivery) {
      requests.push({
        reference_id: newSupplyDeliveryRef,
        url: apis.supplyDeliveries.path,
        method: HttpMethod.POST,
        body: supplyDeliveryBody(item, needsNewProduct ? "" : product!.id),
        replacements: needsNewProduct
          ? [
              {
                source_path: { reference_id: newProductRef, path: "id" },
                value_path: {
                  reference_id: newSupplyDeliveryRef,
                  path: "supplied_item",
                },
              },
            ]
          : undefined,
      });
    }

    const deliveryItemPath = apis.recordInwards.deliveryItemPath(
      institute!.id,
      inwardRecord!.id,
      recordDelivery!.id,
      savedItem.id,
    );
    const deliveryItemRef = `edit-delivery-item-${index}`;
    if (needsNewSupplyDelivery) {
      requests.push({
        reference_id: deliveryItemRef,
        url: deliveryItemPath,
        method: HttpMethod.PATCH,
        body: { supply_delivery: "", ...counts },
        replacements: [
          {
            source_path: { reference_id: newSupplyDeliveryRef, path: "id" },
            value_path: {
              reference_id: deliveryItemRef,
              path: "supply_delivery",
            },
          },
        ],
      });
    } else if (areCountsChanged) {
      // With nothing received, the backend unlinks the abandoned supply delivery.
      requests.push({
        reference_id: deliveryItemRef,
        url: deliveryItemPath,
        method: HttpMethod.PATCH,
        body: counts,
      });
    }

    return requests;
  };

  const saveEditMutation = useMutation({
    mutationFn: async (items: DeliveryItemFormValues[]) => {
      const rows = (editRows ?? [])
        .map((row, index) => buildEditRequests(row, items[index], index))
        .filter((requests) => requests.length > 0);
      if (rows.length === 0) {
        setEditRows(null);
        return 0;
      }

      const results = await runSuperBatchesInOrder(
        chunk(rows, MAX_EDIT_ROWS_PER_SUPER_BATCH).map((rowChunk) =>
          rowChunk.flat(),
        ),
      );
      // Refetch before leaving edit mode, so nothing acts on retired supply deliveries.
      if (results.some((result) => result.status === "fulfilled")) {
        await invalidateDeliveryQueries();
        setEditRows(null);
      }
      const failed = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      if (failed) throw failed.reason;
      return rows.length;
    },
    onSuccess: (count) => {
      if (count > 0) toast.success(t("delivery_items_updated", { count }));
    },
    onError: (error: unknown) => {
      toast.error(errorMessageOf(error) || t("delivery_items_update_failed"));
    },
  });

  const onSaveEdit = editForm.handleSubmit((data) => {
    if (!validateItems(data.items)) return;
    saveEditMutation.mutate(data.items);
  });

  const approveDeliveryMutation = useMutation({
    mutationFn: async () => {
      if (!institute?.id || !inwardRecord?.id || !recordDelivery?.id) {
        throw new Error("Missing institute, inward record or record delivery");
      }
      const instituteId = institute.id;
      const inwardRecordId = inwardRecord.id;
      const recordDeliveryId = recordDelivery.id;
      const deliveryOrder = recordDelivery.delivery_order;

      const chunks = chunk(pendingSavedItems, MAX_ITEMS_PER_APPROVAL_BATCH);

      // Wait for every batch so the refetch after an error shows final statuses.
      const approvalResults = await Promise.allSettled(
        chunks.map((itemChunk) => {
          // Rows with nothing received have no supply delivery to complete.
          const datapoints = itemChunk.flatMap(
            (item): SupplyDeliveryUpsertPayload[] =>
              item.supply_delivery
                ? [
                    {
                      id: item.supply_delivery.id,
                      status: SupplyDeliveryStatus.completed,
                      supplied_item_condition: SupplyDeliveryCondition.normal,
                    },
                  ]
                : [],
          );
          return performSuperBatchRequest({
            requests: [
              ...(datapoints.length > 0
                ? [
                    {
                      reference_id: "supply-delivery-upsert",
                      url: apis.supplyDeliveries.upsertPath,
                      method: HttpMethod.POST,
                      body: { datapoints },
                    },
                  ]
                : []),
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
          });
        }),
      );
      const failedApproval = approvalResults.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      if (failedApproval) throw failedApproval.reason;

      try {
        return await performSuperBatchRequest({
          requests: [
            {
              reference_id: "record-delivery",
              url: apis.recordInwards.deliveryPath(
                instituteId,
                inwardRecordId,
                recordDeliveryId,
              ),
              method: HttpMethod.PATCH,
              body: { status: RecordDeliveryStatus.received },
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
      } catch (error) {
        if (pendingSavedItems.length === 0) throw error;
        throw new Error(t("delivery_items_approved_completion_failed"));
      }
    },
    onSuccess: () => {
      toast.success(t("record_delivery_approved"));
    },
    onError: (error: unknown) => {
      toast.error(errorMessageOf(error) || t("record_delivery_approve_failed"));
    },
    // Items may have been approved even if completing the delivery failed.
    onSettled: invalidateDeliveryQueries,
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
    onSuccess: async () => {
      toast.success(t("acknowledgement_retry_queued"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dvdms_record_inwards"] }),
        queryClient.invalidateQueries({
          queryKey: ["dvdms_record_inward_detail"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dvdms_record_deliveries"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dvdms_record_delivery_detail"],
        }),
      ]);
    },
    onError: (error: { message?: string }) => {
      toast.error(error?.message || t("acknowledgement_retry_failed"));
    },
  });

  const hasFailedAcknowledgement =
    recordDeliveryStatus === RecordDeliveryStatus.acknowledgement_failed;

  const canApproveDelivery =
    !!recordDelivery?.id &&
    !isRecordDeliveryReceived(recordDeliveryStatus) &&
    recordDeliveryStatus !== RecordDeliveryStatus.cancelled &&
    fields.length === 0 &&
    savedItems.length > 0 &&
    !isProcessing;

  const canEditSavedItems =
    canApproveDelivery && pendingSavedItems.length === savedItems.length;

  const renderItemsForm = (
    tableForm: UseFormReturn<DeliveryItemsFormValues>,
    rows: { id: string }[],
    onFormSubmit: ReturnType<typeof form.handleSubmit>,
    isSaving: boolean,
  ) => (
    <Form {...tableForm}>
      <form onSubmit={onFormSubmit} className="space-y-6">
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
                    className="min-w-[120px] text-xs font-semibold"
                  >
                    {t("category")}
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="min-w-[120px] text-xs font-semibold"
                  >
                    {t("unit_pack_size")}
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="min-w-[100px] text-xs font-semibold"
                  >
                    {t("dispatched")}
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="min-w-[100px] text-xs font-semibold"
                  >
                    {t("damaged")}
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="min-w-[100px] text-xs font-semibold"
                  >
                    {t("received_qty")}
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="min-w-[100px] text-xs font-semibold"
                  >
                    {t("short")}
                  </TableHead>
                </TableRow>
                <TableRow className="divide-x divide-gray-200">
                  <TableHead className="min-w-[180px] text-xs font-semibold">
                    {t("drug")}
                  </TableHead>
                  <TableHead className="min-w-[100px] text-xs font-semibold">
                    {t("batch")}
                  </TableHead>
                  <TableHead className="min-w-[140px] text-xs font-semibold border-r">
                    {t("expiry")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((field, index) => (
                  <DeliveryItemRow
                    key={field.id}
                    form={tableForm}
                    index={index}
                    facilityId={facilityId}
                    unit={unitForDrugId(field.drug_id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2Icon className="size-4 animate-spin" />}
            {isSaving ? t("saving") : t("save")}
            <ShortcutBadge actionId="submit-action" />
          </Button>
        </div>
      </form>
    </Form>
  );

  const isLoadingContext =
    isRecordOrderLoading || isOutwardLoading || isRecordInwardsLoading;

  return (
    <div className="md:px-6 py-0 min-w-0">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start gap-4 mb-6">
          <BackButton
            size="icon"
            className="shrink-0"
            fallback={dvdmsRecordPath(
              facilityId,
              locationId,
              requestOrderId,
              recordOrderId,
            )}
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
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => retryAcknowledgementMutation.mutate()}
                disabled={retryAcknowledgementMutation.isPending}
              >
                <RefreshCw
                  className={cn(
                    "size-4",
                    retryAcknowledgementMutation.isPending && "animate-spin",
                  )}
                />
                {retryAcknowledgementMutation.isPending
                  ? t("retrying")
                  : t("retry_acknowledgement")}
              </Button>
            </div>
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
              <CardContent className="space-y-1 p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("deliver_to")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950 wrap-break-word">
                      {recordOrder?.institute_store?.store.name ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("supplier")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950 wrap-break-word">
                      {recordOrder?.institute_supplier?.supplier?.name ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("status")}
                    </label>
                    <div>
                      {!recordDeliveryStatus ? (
                        <div className="text-lg font-semibold text-gray-950 wrap-break-word">
                          —
                        </div>
                      ) : (
                        <Badge
                          className="rounded-sm"
                          variant={
                            RECORD_DELIVERY_STATUS_VARIANTS[
                              recordDeliveryStatus
                            ] ?? "secondary"
                          }
                        >
                          {t(
                            RECORD_DELIVERY_STATUS_LABELS[
                              recordDeliveryStatus
                            ] ?? recordDeliveryStatus,
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("eaushadhi_indent_status")}
                    </label>
                    <div>
                      <DvdmsIssueStatusBadge
                        status={outward?.eaushadhi_indent_status}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("care_indent_no")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950 wrap-break-word">
                      {recordOrder?.care_indent_no ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("eaushadhi_indent_no")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950 wrap-break-word">
                      {outward?.eaushadhi_indent_no ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("issue_no")}
                    </label>
                    <div className="text-lg font-semibold text-gray-950 wrap-break-word">
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
                        <div className="text-lg font-semibold text-gray-950 wrap-break-word">
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
                  {isEditingSaved ? (
                    renderItemsForm(
                      editForm,
                      editFields,
                      onSaveEdit,
                      saveEditMutation.isPending,
                    )
                  ) : (
                    <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-gray-100">
                            <TableRow className="divide-x divide-gray-200">
                              <TableHead className="min-w-[170px] text-xs font-semibold">
                                {t("drug")}
                              </TableHead>
                              <TableHead className="text-xs font-semibold">
                                {t("batch")}
                              </TableHead>
                              <TableHead className="text-xs font-semibold">
                                {t("expiry")}
                              </TableHead>
                              <TableHead className="min-w-[170px] text-xs font-semibold">
                                {t("product_knowledge")}
                              </TableHead>
                              <TableHead className="text-xs font-semibold">
                                {t("category")}
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
                                        {item.inward_record_item.item_name ||
                                          "—"}
                                      </span>
                                      {inwardItem?.drug_id && (
                                        <span className="text-xs text-gray-500">
                                          {t("drug_id")}: {inwardItem.drug_id}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="p-2 text-sm text-gray-900 whitespace-nowrap">
                                    {item.inward_record_item.batch_number ||
                                      "—"}
                                  </TableCell>
                                  <TableCell className="p-2 text-sm text-gray-900 whitespace-nowrap">
                                    {formatDate(
                                      item.inward_record_item.expiry_date,
                                    )}
                                  </TableCell>
                                  <TableCell className="p-2 text-sm text-gray-900">
                                    {item.product_knowledge?.name || "—"}
                                  </TableCell>
                                  <TableCell className="p-2 text-sm text-gray-900 capitalize whitespace-nowrap">
                                    {(inwardItem?.drug_id
                                      ? productKnowledgeByDrugId.get(
                                          inwardItem.drug_id,
                                        )?.product_type
                                      : undefined) || "—"}
                                  </TableCell>
                                  <TableCell className="p-2 text-sm text-right tabular-nums">
                                    {item.quantity_dispatched != null
                                      ? toQuantity(item.quantity_dispatched)
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="p-2 text-sm text-right tabular-nums">
                                    {item.quantity_damaged != null
                                      ? toQuantity(item.quantity_damaged)
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="p-2 text-sm text-right tabular-nums">
                                    {item.quantity_accepted != null
                                      ? toQuantity(item.quantity_accepted)
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="p-2 text-sm text-right tabular-nums">
                                    {item.quantity_short != null
                                      ? toQuantity(item.quantity_short)
                                      : "—"}
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
                  )}
                  {canApproveDelivery && !isEditingSaved && (
                    <div className="flex flex-col gap-2 justify-between bg-white p-2 border border-gray-200 rounded-md sm:flex-row sm:items-center">
                      <div className="flex flex-col gap-2">
                        <p className="font-bold">
                          {t("review_and_complete_delivery")}
                        </p>
                        <span className="text-sm text-gray-500">
                          {t("review_and_complete_delivery_description")}
                        </span>
                      </div>
                      <div className="flex flex-col-reverse gap-2 shrink-0 sm:flex-row">
                        {canEditSavedItems && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => startEditMutation.mutate()}
                            disabled={
                              startEditMutation.isPending ||
                              approveDeliveryMutation.isPending
                            }
                          >
                            {startEditMutation.isPending ? (
                              <Loader2Icon className="size-4 animate-spin" />
                            ) : (
                              <Edit className="size-4" />
                            )}
                            {t("edit")}
                          </Button>
                        )}
                        <Button
                          type="button"
                          onClick={() => approveDeliveryMutation.mutate()}
                          disabled={
                            approveDeliveryMutation.isPending ||
                            startEditMutation.isPending
                          }
                        >
                          {approveDeliveryMutation.isPending && (
                            <Loader2Icon className="size-4 animate-spin" />
                          )}
                          {approveDeliveryMutation.isPending
                            ? t("saving")
                            : t("mark_as_completed")}
                          <ShortcutBadge actionId="mark-as" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {fields.length > 0 && (
              <Card className="bg-gray-50 py-4 rounded-md">
                <CardContent className="space-y-4">
                  {renderItemsForm(form, fields, onSubmit, isProcessing)}
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
