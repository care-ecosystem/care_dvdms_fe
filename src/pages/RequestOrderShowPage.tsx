import { FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "raviger";
import { toast } from "sonner";
import {
  Box,
  ChevronLeft,
  Edit,
  EllipsisVertical,
  Inbox,
  Plus,
  Printer,
  RefreshCw,
} from "lucide-react";

import { apis } from "@/apis";
import { BatchError, performSuperBatchRequest } from "@/apis/query";
import { HttpMethod, PaginatedResponse } from "@/apis/types";
import { I18N_NAMESPACE, LIST_FETCH_LIMIT } from "@/lib/constants";
import {
  chunk,
  formatLookupId,
  formatQuantity,
  parseLookupId,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Autocomplete from "@/components/ui/autocomplete";
import { EmptyState } from "@/components/ui/empty-state";
import { NavTabs } from "@/components/ui/nav-tabs";
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
import { TableSkeleton } from "@/components/SkeletonLoading";
import BackButton from "@/components/BackButton";
import DvdmsIssuesTable from "@/components/DvdmsIssuesTable";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import { REQUEST_ORDER_STATUS_VARIANTS } from "@/types/requestOrder";
import {
  RecordDeliveryStatus,
  RecordOrder,
  RecordOrderOutward,
} from "@/types/recordOrder";
import { SupplyRequest } from "@/types/supplyRequest";
import { RecordOrderProductMapping } from "@/types/productMapping";
import { RecordItemOrderDrug } from "@/types/recordOrderItem";
import {
  SuperBatchRequestItem,
  SuperBatchResponseItem,
} from "@/types/superBatch";
import {
  DvdmsLookupDrug,
  DvdmsLookupGroup,
  DvdmsLookupSubgroup,
} from "@/types/dvdms_config";
import useRecordInwardDeliveries from "@/hooks/useRecordInwardDeliveries";

type RequestOrderShowPageProps = {
  facilityId: string;
  locationId: string;
  requestOrderId: string;
  recordOrderId: string;
};

const MAX_ITEMS_PER_BATCH = 50;

const DVDMS_SUBMISSION_POLL_INTERVAL_MS = 5_000;
const DVDMS_SUBMISSION_POLL_WINDOW_MS = 2 * 60 * 1_000;

const DVDMS_INDENT_STATUS_POLL_INTERVAL_MS = 15_000;
const DVDMS_INDENT_STATUS_POLL_MAX_FAILURES = 2;

const drugsKey = (groupId: number, subgroupId?: number) =>
  `${groupId}:${subgroupId ?? ""}`;

const toDrugPayload = (drug: RecordItemOrderDrug): RecordItemOrderDrug => {
  const { sub_group_id, brand_id, ...rest } = drug;
  const withBrand = {
    ...rest,
    brand_id: brand_id && brand_id !== "undefined" ? brand_id : drug.id,
  };
  return sub_group_id !== undefined && sub_group_id !== ""
    ? { ...withBrand, sub_group_id }
    : withBrand;
};

const listAllRecordOrderProductMappings = async (
  instituteId: string,
  recordOrderId: string,
) => {
  const firstPage = await apis.recordOrderProductMappings.list(
    instituteId,
    recordOrderId,
    { limit: LIST_FETCH_LIMIT },
  );

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
      url: apis.recordOrderProductMappings.path(instituteId, recordOrderId),
      method: HttpMethod.GET,
      body: { limit: LIST_FETCH_LIMIT, offset },
      reference_id: `product_mappings_${offset}`,
    })),
  });

  return [
    ...firstPage.results,
    ...response.results.flatMap(
      (result) =>
        (result.data as PaginatedResponse<RecordOrderProductMapping> | undefined)
          ?.results ?? [],
    ),
  ];
};

const lookupDrugToPayload = (drug: DvdmsLookupDrug): RecordItemOrderDrug => ({
  id: String(drug.hstnum_item_id),
  name: drug.hststr_item_name,
  brand_id: String(drug.hstnum_itembrand_id ?? drug.hstnum_item_id),
  group_id: String(drug.hstnum_group_id),
  sub_group_id: String(drug.hstnum_subgroup_id),
  unit_id: String(drug.gnum_inventory_unitid),
  drug_category: drug.sstnum_item_cat_no,
});

const RequestOrderShowPage: FC<RequestOrderShowPageProps> = (props) => (
  <ShortcutProvider>
    <RequestOrderShowPageContent {...props} />
  </ShortcutProvider>
);

const RequestOrderShowPageContent: FC<RequestOrderShowPageProps> = ({
  facilityId,
  locationId,
  requestOrderId,
  recordOrderId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  useShortcutSubContext("facility:inventory");
  const queryClient = useQueryClient();

  const recordBasePath = `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/${requestOrderId}/record/${recordOrderId}`;

  const [currentTab, setCurrentTab] = useState<
    "requested-items" | "dvdms-issues"
  >("requested-items");

  const [tableItems, setTableItems] = useState<SupplyRequest[]>([]);
  const [selectedDrugs, setSelectedDrugs] = useState<
    Record<string, RecordItemOrderDrug | undefined>
  >({});
  const [selectedGroupBySupplyRequestId, setSelectedGroupBySupplyRequestId] =
    useState<Record<string, number | undefined>>({});
  const [
    selectedSubgroupBySupplyRequestId,
    setSelectedSubgroupBySupplyRequestId,
  ] = useState<Record<string, number | undefined>>({});
  const [subgroupsByGroupId, setSubgroupsByGroupId] = useState<
    Record<number, DvdmsLookupSubgroup[]>
  >({});
  const [drugsByGroupAndSubgroup, setDrugsByGroupAndSubgroup] = useState<
    Record<string, DvdmsLookupDrug[]>
  >({});

  const { data: order, isLoading } = useQuery({
    queryKey: ["dvdms_request_order", facilityId, requestOrderId],
    queryFn: () => apis.requestOrders.retrieve(facilityId, requestOrderId),
  });

  const SUPPLY_REQUESTS_PAGE_SIZE = 14;

  const { data: supplyRequestsData, isLoading: isSupplyRequestsLoading } =
    useQuery({
      queryKey: ["dvdms_supply_requests", requestOrderId],
      queryFn: () =>
        apis.supplyRequests.list({
          order: requestOrderId,
          ordering: "-created_date",
          limit: SUPPLY_REQUESTS_PAGE_SIZE,
          offset: 0,
        }),
    });

  const [loadedSupplyRequestsCount, setLoadedSupplyRequestsCount] = useState(0);
  const [hasSavedOnce, setHasSavedOnce] = useState(false);

  useEffect(() => {
    setTableItems(supplyRequestsData?.results ?? []);
    setLoadedSupplyRequestsCount(supplyRequestsData?.results.length ?? 0);
  }, [supplyRequestsData]);

  const totalSupplyRequestsCount = supplyRequestsData?.count ?? 0;
  const hasMoreSupplyRequests =
    loadedSupplyRequestsCount < totalSupplyRequestsCount;

  const loadBalanceSupplyRequestsMutation = useMutation({
    mutationFn: () =>
      apis.supplyRequests.list({
        order: requestOrderId,
        ordering: "-created_date",
        limit: SUPPLY_REQUESTS_PAGE_SIZE,
        offset: loadedSupplyRequestsCount,
      }),
    onSuccess: (data) => {
      setTableItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const balanceItems = data.results.filter(
          (item) => !existingIds.has(item.id),
        );
        return [...prev, ...balanceItems];
      });
      setLoadedSupplyRequestsCount((prev) => prev + data.results.length);
    },
  });

  const { data: productKnowledgeData } = useQuery({
    queryKey: ["dvdms_product_knowledge", facilityId],
    queryFn: () =>
      apis.productKnowledge.list({
        facility: facilityId,
        status: "active",
        include_instance: true,
        limit: 100,
      }),
  });

  const categoryByProductId = new Map(
    (productKnowledgeData?.results ?? []).map((product) => [
      product.id,
      product.category?.title,
    ]),
  );

  const { data: institute, isPending: isInstitutePending } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });

  const recordOrderStatusQueryKey = [
    "dvdms_record_order_status",
    institute?.id,
    requestOrderId,
  ];

  const dvdmsSubmissionPollInterval = () => {
    const order = queryClient
      .getQueryData<PaginatedResponse<RecordOrder>>(recordOrderStatusQueryKey)
      ?.results?.find((item) => item.id === recordOrderId);
    if (order?.status !== "approved") {
      return false;
    }
    const outwardRow = queryClient.getQueryData<
      PaginatedResponse<RecordOrderOutward>
    >(["dvdms_record_order_outward", institute?.id, order.id])?.results?.[0];

    const hasIndentDetails =
      !!outwardRow?.eaushadhi_indent_no &&
      !!outwardRow?.eaushadhi_indent_status;
    if (hasIndentDetails || outwardRow?.status === "failed") {
      return false;
    }

    const changedAt = [order.modified_date, outwardRow?.modified_date]
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter((value) => Number.isFinite(value));
    const lastChangedAt = Math.max(...changedAt);
    if (
      changedAt.length === 0 ||
      Date.now() - lastChangedAt > DVDMS_SUBMISSION_POLL_WINDOW_MS
    ) {
      return false;
    }
    return DVDMS_SUBMISSION_POLL_INTERVAL_MS;
  };

  const isRecordOrderEnabled = !!institute?.id;

  const { data: recordOrdersData, isPending: isRecordOrderPending } = useQuery({
    queryKey: recordOrderStatusQueryKey,
    queryFn: () =>
      apis.recordOrders.list(institute!.id, {
        order: requestOrderId,
        limit: LIST_FETCH_LIMIT,
        ordering: "-created_date",
      }),
    enabled: isRecordOrderEnabled,
    refetchInterval: dvdmsSubmissionPollInterval,
  });
  const recordOrder = recordOrdersData?.results?.find(
    (item) => item.id === recordOrderId,
  );

  const recordItemOrdersQueryKey = [
    "dvdms_record_item_orders",
    institute?.id,
    recordOrder?.id,
  ];

  const { data: recordItemOrdersData } = useQuery({
    queryKey: recordItemOrdersQueryKey,
    queryFn: () =>
      apis.item.list(institute!.id, recordOrder!.id, { limit: 100 }),
    enabled: !!institute?.id && !!recordOrder?.id,
  });

  const { data: productMappings } = useQuery({
    queryKey: ["dvdms_product_mappings", institute?.id, recordOrder?.id],
    queryFn: () =>
      listAllRecordOrderProductMappings(institute!.id, recordOrder!.id),
    enabled: !!institute?.id && !!recordOrder?.id,
  });

  const isOutwardStatus =
    !!recordOrder?.status && !["draft", "pending"].includes(recordOrder.status);
  const showCareIndentNo =
    !!recordOrder?.status && recordOrder.status !== "draft";

  const isOutwardEnabled =
    !!institute?.id && !!recordOrder?.id && isOutwardStatus;

  const { data: outwardData, isPending: isOutwardPending } = useQuery({
    queryKey: ["dvdms_record_order_outward", institute?.id, recordOrder?.id],
    queryFn: () =>
      apis.recordOrderOutward.list(institute!.id, recordOrder!.id, {
        limit: 1,
      }),
    enabled: isOutwardEnabled,
    refetchInterval: dvdmsSubmissionPollInterval,
  });
  const outward = outwardData?.results?.[0];
  const hasStaleOutwardFailure =
    outward?.status === "failed" && recordOrder?.status !== "failed";
  const displayStatus =
    recordOrder?.status === "approved" &&
    !!outward?.status &&
    !hasStaleOutwardFailure
      ? outward.status
      : recordOrder?.status;

  const canSyncDvdmsStatus =
    !!recordOrder?.status &&
    !["draft", "pending", "cancelled"].includes(recordOrder.status) &&
    !!outward?.eaushadhi_indent_no;

  const {
    inwardRecords: dvdmsIssues,
    deliveriesByInwardId,
    isLoading: isInwardsLoading,
  } = useRecordInwardDeliveries(institute?.id, outward?.id, {
    indentStatus: outward?.eaushadhi_indent_status,
  });

  const isIssuesLoading =
    isInstitutePending ||
    (isRecordOrderEnabled && isRecordOrderPending) ||
    (isOutwardEnabled && isOutwardPending) ||
    isInwardsLoading;

  const areAllIssuesDelivered =
    dvdmsIssues.length > 0 &&
    dvdmsIssues.every((issue) => {
      const deliveries = deliveriesByInwardId.get(issue.id) ?? [];
      return (
        deliveries.length > 0 &&
        deliveries.every(
          (delivery) => delivery.status === RecordDeliveryStatus.completed,
        )
      );
    });

  const existingItemBySupplyRequestId = new Map(
    (recordItemOrdersData?.results ?? []).map((item) => [
      item.supply_request.id,
      item,
    ]),
  );

  const suggestedDrugBySupplyRequestId = new Map(
    (productMappings ?? [])
      .filter((mapping) => mapping.product_mapping)
      .map((mapping) => [
        mapping.supply_request.id,
        mapping.product_mapping!.eaushadhi_drug_details,
      ]),
  );

  const [lookupGroupsData, setLookupGroupsData] = useState<
    DvdmsLookupGroup[] | undefined
  >(undefined);
  const [isLookupGroupsLoading, setIsLookupGroupsLoading] = useState(false);

  const ensureGroupsLoaded = async () => {
    if (!institute?.id || lookupGroupsData || isLookupGroupsLoading) return;
    const instituteId = institute.id;
    setIsLookupGroupsLoading(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ["dvdms_lookup_groups", instituteId],
        queryFn: () => apis.institutes.lookupGroups(instituteId),
      });
      setLookupGroupsData(data);
    } finally {
      setIsLookupGroupsLoading(false);
    }
  };

  const [loadingSubgroupGroupIds, setLoadingSubgroupGroupIds] = useState<
    Set<number>
  >(new Set());
  const [loadingDrugKeys, setLoadingDrugKeys] = useState<Set<string>>(
    new Set(),
  );

  const ensureSubgroupsLoaded = async (groupId: number) => {
    if (
      !institute?.id ||
      subgroupsByGroupId[groupId] ||
      loadingSubgroupGroupIds.has(groupId)
    )
      return;
    const instituteId = institute.id;
    setLoadingSubgroupGroupIds((prev) => new Set(prev).add(groupId));
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ["dvdms_lookup_subgroups", instituteId, groupId],
        queryFn: () =>
          apis.institutes.lookupSubgroups(instituteId, String(groupId)),
      });
      setSubgroupsByGroupId((prev) => ({ ...prev, [groupId]: data }));
    } finally {
      setLoadingSubgroupGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  const ensureDrugsLoaded = async (groupId: number, subgroupId?: number) => {
    if (!institute?.id) return;
    const key = drugsKey(groupId, subgroupId);
    if (drugsByGroupAndSubgroup[key] || loadingDrugKeys.has(key)) return;
    const instituteId = institute.id;
    setLoadingDrugKeys((prev) => new Set(prev).add(key));
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ["dvdms_lookup_drugs", instituteId, groupId, subgroupId],
        queryFn: () =>
          apis.institutes.lookupDrugs(instituteId, {
            hstnum_group_id: String(groupId),
            ...(subgroupId !== undefined
              ? { hstnum_subgroup_id: String(subgroupId) }
              : {}),
          }),
      });
      setDrugsByGroupAndSubgroup((prev) => ({ ...prev, [key]: data }));
    } finally {
      setLoadingDrugKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  useEffect(() => {
    setSelectedDrugs((prev) => {
      let changed = false;
      const next = { ...prev };
      tableItems.forEach((item) => {
        if (next[item.id]) return;
        const drug =
          existingItemBySupplyRequestId.get(item.id)?.drug ??
          suggestedDrugBySupplyRequestId.get(item.id);
        if (drug) {
          next[item.id] = drug;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setSelectedGroupBySupplyRequestId((prev) => {
      let changed = false;
      const next = { ...prev };
      tableItems.forEach((item) => {
        if (next[item.id] !== undefined) return;
        const drug =
          existingItemBySupplyRequestId.get(item.id)?.drug ??
          suggestedDrugBySupplyRequestId.get(item.id);
        const groupId = parseLookupId(drug?.group_id);
        if (groupId !== undefined) {
          next[item.id] = groupId;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setSelectedSubgroupBySupplyRequestId((prev) => {
      let changed = false;
      const next = { ...prev };
      tableItems.forEach((item) => {
        if (next[item.id] !== undefined) return;
        const drug =
          existingItemBySupplyRequestId.get(item.id)?.drug ??
          suggestedDrugBySupplyRequestId.get(item.id);
        const subgroupId = parseLookupId(drug?.sub_group_id);
        if (subgroupId !== undefined) {
          next[item.id] = subgroupId;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableItems, recordItemOrdersData, productMappings]);

  const saveItemsMutation = useMutation({
    mutationFn: async () => {
      if (!institute?.id || !recordOrder?.id) {
        throw new Error("Missing institute or record order");
      }
      const instituteId = institute.id;
      const recordOrderId = recordOrder.id;

      const itemRequests: SuperBatchRequestItem[] = tableItems
        .filter((item) => selectedDrugs[item.id])
        .map((item) => ({
          url: `/api/care_dvdms/institute/${instituteId}/record_order/${recordOrderId}/item/`,
          method: HttpMethod.POST,
          body: {
            supply_request: item.id,
            drug: toDrugPayload(selectedDrugs[item.id]!),
          },
          reference_id: `item-${item.id}`,
        }));

      const itemBatches = chunk(itemRequests, MAX_ITEMS_PER_BATCH);
      await Promise.all(
        itemBatches.map((requests) => apis.superBatch.create({ requests })),
      );

      return apis.recordOrders.update(instituteId, recordOrderId, {
        status: "pending",
      });
    },
    onSuccess: () => {
      toast.success(t("items_saved"));
      setHasSavedOnce(true);
      queryClient.invalidateQueries({ queryKey: recordItemOrdersQueryKey });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
      });
    },
    onError: (error: {
      data?: { results?: SuperBatchResponseItem[] };
      message?: string;
    }) => {
      const failedItem = error?.data?.results?.find(
        (result) => result.status_code > 299,
      );
      const failedItemMessage = (
        failedItem?.data as { error?: string } | undefined
      )?.error;
      toast.error(failedItemMessage || error?.message || t("save_failed"));
    },
  });

  const approveRecordOrderMutation = useMutation({
    mutationFn: () => {
      if (!institute?.id || !recordOrder?.id) {
        throw new Error("Missing institute or record order");
      }
      return apis.recordOrders.update(institute.id, recordOrder.id, {
        status: "approved",
      });
    },
    onSuccess: () => {
      toast.success(t("record_order_approved"));
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "dvdms_record_order_outward",
          institute?.id,
          recordOrder?.id,
        ],
      });
    },
    onError: () => {
      toast.error(t("record_order_approve_failed"));
    },
  });

  const retryRecordOrderMutation = useMutation({
    mutationFn: () => {
      if (!institute?.id || !recordOrder?.id) {
        throw new Error("Missing institute or record order");
      }
      return apis.recordOrders.update(institute.id, recordOrder.id, {
        status: "approved",
      });
    },
    onSuccess: () => {
      toast.success(t("record_order_retried"));
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "dvdms_record_order_outward",
          institute?.id,
          recordOrder?.id,
        ],
      });
    },
    onError: () => {
      toast.error(t("record_order_retry_failed"));
    },
  });

  const cancelRecordOrderMutation = useMutation({
    mutationFn: () => {
      if (!institute?.id || !recordOrder?.id) {
        throw new Error("Missing institute or record order");
      }
      return apis.recordOrders.update(institute.id, recordOrder.id, {
        status: "cancelled",
      });
    },
    onSuccess: () => {
      toast.success(t("record_order_cancelled"));
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
      });
    },
    onError: () => {
      toast.error(t("record_order_cancel_failed"));
    },
  });

  const completeRecordOrderMutation = useMutation({
    mutationFn: () => {
      if (!institute?.id || !recordOrder?.id || !order) {
        throw new Error("Missing institute, record order or request order");
      }

      return performSuperBatchRequest({
        requests: [
          {
            reference_id: "record-order",
            url: apis.recordOrders.path(institute.id, recordOrder.id),
            method: HttpMethod.PATCH,
            body: { status: "completed" },
          },
          {
            reference_id: "request-order",
            url: apis.requestOrders.path(facilityId, order.id),
            method: HttpMethod.PATCH,
            body: {
              id: order.id,
              status: "completed",
              name: order.name,
              note: order.note ?? "",
              intent: order.intent,
              category: order.category,
              priority: order.priority,
              reason: order.reason,
            },
          },
        ],
      });
    },
    onSuccess: () => {
      toast.success(t("record_order_completed"));
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
      });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_request_order", facilityId, requestOrderId],
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof BatchError ? error.errorMessages[0] : undefined;
      toast.error(message || t("record_order_complete_failed"));
    },
  });

  const [indentStatusPollFailures, setIndentStatusPollFailures] = useState(0);
  const isFetchingInwardsRef = useRef(false);

  const fetchInwardsMutation = useMutation({
    mutationFn: () => {
      if (!institute?.id || !recordOrder?.id) {
        throw new Error("Missing institute or record order");
      }
      return apis.recordOrderOutward.fetchInwards(institute.id, recordOrder.id);
    },
    onMutate: () => {
      isFetchingInwardsRef.current = true;
    },
    onSettled: () => {
      isFetchingInwardsRef.current = false;
    },
    onSuccess: () => {
      setIndentStatusPollFailures(0);
      queryClient.invalidateQueries({
        queryKey: [
          "dvdms_record_order_outward",
          institute?.id,
          recordOrder?.id,
        ],
      });
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_inwards"] });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
      });
    },
    onError: () => {
      setIndentStatusPollFailures((previous) => previous + 1);
    },
  });
  const isAwaitingIndentStatus =
    !!outward?.eaushadhi_indent_no &&
    !outward.eaushadhi_indent_status &&
    outward.status !== "failed" &&
    !!recordOrder?.status &&
    !["cancelled", "completed"].includes(recordOrder.status) &&
    indentStatusPollFailures < DVDMS_INDENT_STATUS_POLL_MAX_FAILURES;

  const { mutate: fetchInwards } = fetchInwardsMutation;

  useEffect(() => {
    if (!isAwaitingIndentStatus) return;

    const pull = () => {
      if (isFetchingInwardsRef.current) return;
      fetchInwards();
    };

    pull();
    const timer = setInterval(pull, DVDMS_INDENT_STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isAwaitingIndentStatus, fetchInwards]);

  const handleSupplyDeliveryAction = (action: string) => {
    if (action === "save") {
      saveItemsMutation.mutate();
    }
  };

  const hasUnselectedDrug = tableItems.some((item) => !selectedDrugs[item.id]);

  if (isLoading || isSupplyRequestsLoading) {
    return (
      <div className="md:px-6 py-0 space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-4 min-w-0">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>

        <Card className="border-none rounded-lg">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-12 gap-y-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none rounded-lg">
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <TableSkeleton count={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 text-sm text-gray-500">
        {t("request_order_not_found")}
      </div>
    );
  }

  const recordOrderStatus = recordOrder?.status;
  const isDraftStatus = recordOrderStatus === "draft";
  const isViewOnlyStatus = !isDraftStatus;
  const isApprovable =
    recordOrderStatus === "draft" || recordOrderStatus === "pending";
  const isPendingStatus = recordOrderStatus === "pending";
  const isFailedStatus = displayStatus === "failed";
  const isCancelledStatus = recordOrderStatus === "cancelled";

  const canMarkAsCompleted =
    areAllIssuesDelivered &&
    !!recordOrderStatus &&
    !["draft", "pending", "completed", "cancelled"].includes(recordOrderStatus);

  return (
    <div className="md:px-6 py-0 space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-4 min-w-0">
          <BackButton size="icon" className="shrink-0">
            <ChevronLeft />
            <span className="sr-only">{t("back")}</span>
          </BackButton>
          <div>
            <h4 className="text-lg font-semibold text-gray-950">
              {recordOrder?.name}
            </h4>
            <p className="text-sm text-gray-700">
              {t("delivery_request_to")}{" "}
              <span className="font-semibold text-gray-700">
                {order.origin?.name || order.supplier?.name || t("origin")}
              </span>{" "}
              {t("to")}{" "}
              <span className="font-semibold text-gray-700">
                {order.destination?.name || t("destination")}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => navigate(`${recordBasePath}/print`)}
          >
            <Printer className="size-4" /> {t("print")}
            <ShortcutBadge actionId="print-button" />
          </Button>
          {isCancelledStatus && (
            <Button
              onClick={() =>
                navigate(
                  `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/new?order=${requestOrderId}`,
                )
              }
            >
              <Plus className="size-4" /> {t("create_new_record_order")}
            </Button>
          )}
          {canSyncDvdmsStatus && (
            <Button
              variant="outline"
              onClick={() =>
                fetchInwardsMutation.mutate(undefined, {
                  onSuccess: () => toast.success(t("eaushadhi_status_synced")),
                  onError: () => toast.error(t("eaushadhi_status_sync_failed")),
                })
              }
              disabled={fetchInwardsMutation.isPending}
            >
              <RefreshCw className="size-4" /> {t("sync_dvdms_status")}
            </Button>
          )}
          {canMarkAsCompleted && (
            <Button
              onClick={() => completeRecordOrderMutation.mutate()}
              disabled={completeRecordOrderMutation.isPending}
            >
              {completeRecordOrderMutation.isPending
                ? t("saving")
                : t("mark_as_completed")}
              <ShortcutBadge actionId="mark-as" />
            </Button>
          )}
          {recordOrder?.status == "draft" && (
            <Button
              variant="outline"
              onClick={() => navigate(`${recordBasePath}/edit`)}
            >
              <Edit className="size-4" /> {t("edit")}
              <ShortcutBadge actionId="edit-order" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {isDraftStatus && (
                <Button variant="outline" className="border-gray-400 px-2">
                  <EllipsisVertical />
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => cancelRecordOrderMutation.mutate()}
                disabled={cancelRecordOrderMutation.isPending}
              >
                {t("mark_as_cancelled")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card className="border-none rounded-lg">
        <CardContent className="space-y-1 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-12 gap-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("deliver_to")}
              </label>
              <div className="text-lg font-semibold text-gray-950">
                {order.destination?.name ?? "—"}
              </div>
            </div>

            {recordOrder?.institute_supplier && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("eaushadhi_supplier")}
                </label>
                <div className="text-lg font-semibold text-gray-950">
                  {recordOrder.institute_supplier.eaushadhi_warehouse_name}
                </div>
              </div>
            )}

            {recordOrder?.institute_store && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("eaushadhi_store")}
                </label>
                <div className="text-lg font-semibold text-gray-950">
                  {recordOrder.institute_store.eaushadhi_store_name}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("items")}
              </label>
              <div className="text-lg font-semibold text-gray-950">
                {totalSupplyRequestsCount} {t("items")}
              </div>
            </div>

            {displayStatus && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("status")}
                </label>
                <div>
                  <Badge
                    className="rounded-sm"
                    variant={
                      REQUEST_ORDER_STATUS_VARIANTS[displayStatus] ??
                      "secondary"
                    }
                  >
                    {t(displayStatus)}
                  </Badge>
                </div>
              </div>
            )}

            {showCareIndentNo && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("care_indent_no")}
                </label>
                <div className="text-lg font-semibold text-gray-950">
                  {recordOrder?.care_indent_no ?? "—"}
                </div>
              </div>
            )}

            {isOutwardStatus && outward && (
              <>
                <div className="col-span-full border-t border-gray-100" />

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {t("eaushadhi_indent_no")}
                  </label>
                  <div className="text-lg font-semibold text-gray-950">
                    {outward.eaushadhi_indent_no ?? "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    {t("eaushadhi_indent_status")}
                  </label>
                  <div>
                    {outward.eaushadhi_indent_status ? (
                      <Badge className="rounded-sm" variant="secondary">
                        {outward.eaushadhi_indent_status}
                      </Badge>
                    ) : (
                      <div className="text-lg font-semibold text-gray-950">
                        —
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {order.note && (
            <div className="pt-3">
              <label className="text-sm font-medium text-gray-700">
                {t("note")}
              </label>
              <p className="text-sm whitespace-pre-wrap">{order.note}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-2 pb-4">
        <NavTabs
          tabs={{
            "requested-items": {
              label: t("requested_items"),
              component: (
                <Card className="border-none rounded-lg">
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-950">
                        {t("drug_list_mapping")}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t("drug_list_mapping_description")}
                      </p>
                    </div>

                    <div className="space-y-4">
                      {tableItems.length > 0 ? (
                        <>
                          <Table className="min-w-[56rem]">
                            <TableHeader>
                              <TableRow>
                                <TableHead rowSpan={2}>
                                  {t("product")}
                                </TableHead>
                                <TableHead rowSpan={2}>
                                  {t("category")}
                                </TableHead>
                                <TableHead rowSpan={2}>{t("qty")}</TableHead>
                                <TableHead
                                  colSpan={3}
                                  className="text-center border-b"
                                >
                                  {t("dvdms_drug_details")}
                                </TableHead>
                                {/* <TableHead rowSpan={2}>{t("actions")}</TableHead> */}
                              </TableRow>
                              <TableRow>
                                <TableHead className="w-72">
                                  {t("group_id")}
                                </TableHead>
                                <TableHead className="w-72">
                                  {t("sub_group_id")}
                                </TableHead>
                                <TableHead className="w-72">
                                  {t("drug_name")}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tableItems.map((item) => {
                                const selectedDrugId =
                                  selectedDrugs[item.id]?.id ?? "";
                                const readOnlyDrug =
                                  existingItemBySupplyRequestId.get(item.id)
                                    ?.drug ?? selectedDrugs[item.id];

                                const selectedGroupId =
                                  selectedGroupBySupplyRequestId[item.id];
                                const selectedSubgroupId =
                                  selectedSubgroupBySupplyRequestId[item.id];
                                const subgroupOptions =
                                  selectedGroupId !== undefined
                                    ? (subgroupsByGroupId[selectedGroupId] ??
                                      [])
                                    : [];
                                const isSubgroupsLoading =
                                  selectedGroupId !== undefined &&
                                  loadingSubgroupGroupIds.has(selectedGroupId);
                                const drugsCacheKey =
                                  selectedGroupId !== undefined
                                    ? drugsKey(
                                        selectedGroupId,
                                        selectedSubgroupId,
                                      )
                                    : undefined;
                                const catalogDrugOptions =
                                  drugsCacheKey !== undefined
                                    ? (drugsByGroupAndSubgroup[drugsCacheKey] ??
                                      [])
                                    : [];
                                const isDrugsLoading =
                                  drugsCacheKey !== undefined &&
                                  loadingDrugKeys.has(drugsCacheKey);

                                const groupAutocompleteOptions = (
                                  lookupGroupsData ?? []
                                ).map((group) => ({
                                  label: group.hststrGroupName,
                                  value: String(group.hstnumGroupId),
                                }));
                                if (
                                  selectedGroupId !== undefined &&
                                  !groupAutocompleteOptions.some(
                                    (option) =>
                                      option.value === String(selectedGroupId),
                                  )
                                ) {
                                  groupAutocompleteOptions.push({
                                    label: String(selectedGroupId),
                                    value: String(selectedGroupId),
                                  });
                                }

                                const subgroupAutocompleteOptions =
                                  subgroupOptions.map((subgroup) => ({
                                    label: subgroup.hststrSubgroupName,
                                    value: String(subgroup.hstnumSubgroupId),
                                  }));
                                if (
                                  selectedSubgroupId !== undefined &&
                                  !subgroupAutocompleteOptions.some(
                                    (option) =>
                                      option.value ===
                                      String(selectedSubgroupId),
                                  )
                                ) {
                                  subgroupAutocompleteOptions.push({
                                    label: String(selectedSubgroupId),
                                    value: String(selectedSubgroupId),
                                  });
                                }

                                const drugAutocompleteOptions =
                                  catalogDrugOptions.map((drug) => ({
                                    label: drug.hststr_item_name,
                                    value: String(drug.hstnum_item_id),
                                  }));
                                if (
                                  selectedDrugId &&
                                  !drugAutocompleteOptions.some(
                                    (option) => option.value === selectedDrugId,
                                  )
                                ) {
                                  drugAutocompleteOptions.push({
                                    label:
                                      selectedDrugs[item.id]?.name ??
                                      selectedDrugId,
                                    value: selectedDrugId,
                                  });
                                }

                                const handleGroupChange = (value: string) => {
                                  const groupId = value
                                    ? Number(value)
                                    : undefined;
                                  setSelectedGroupBySupplyRequestId((prev) => ({
                                    ...prev,
                                    [item.id]: groupId,
                                  }));
                                  setSelectedSubgroupBySupplyRequestId(
                                    (prev) => ({
                                      ...prev,
                                      [item.id]: undefined,
                                    }),
                                  );
                                  setSelectedDrugs((prev) => ({
                                    ...prev,
                                    [item.id]: undefined,
                                  }));
                                  if (groupId !== undefined)
                                    ensureSubgroupsLoaded(groupId);
                                };

                                const handleSubgroupChange = (
                                  value: string,
                                ) => {
                                  if (selectedGroupId === undefined) return;
                                  const subgroupId = value
                                    ? Number(value)
                                    : undefined;
                                  setSelectedSubgroupBySupplyRequestId(
                                    (prev) => ({
                                      ...prev,
                                      [item.id]: subgroupId,
                                    }),
                                  );
                                  setSelectedDrugs((prev) => ({
                                    ...prev,
                                    [item.id]: undefined,
                                  }));
                                  ensureDrugsLoaded(
                                    selectedGroupId,
                                    subgroupId,
                                  );
                                };

                                const handleCatalogDrugChange = (
                                  value: string,
                                ) => {
                                  if (!value) {
                                    setSelectedDrugs((prev) => ({
                                      ...prev,
                                      [item.id]: undefined,
                                    }));
                                    return;
                                  }
                                  const drug = catalogDrugOptions.find(
                                    (option) =>
                                      String(option.hstnum_item_id) === value,
                                  );
                                  if (!drug) return;
                                  setSelectedDrugs((prev) => ({
                                    ...prev,
                                    [item.id]: lookupDrugToPayload(drug),
                                  }));
                                };

                                return (
                                  <TableRow key={item.id}>
                                    <TableCell className="align-top">
                                      <div className="text-xs text-gray-500 mb-3">
                                        {" "}
                                      </div>
                                      {item.item.name}
                                      <div className="text-xs text-gray-500 mt-1">
                                        {" "}
                                      </div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <div className="text-xs text-gray-500 mb-3">
                                        {" "}
                                      </div>
                                      {categoryByProductId.get(item.item.id) ??
                                        "—"}
                                      <div className="text-xs text-gray-500 mt-1">
                                        {" "}
                                      </div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <div className="text-xs text-gray-500 mb-3">
                                        {" "}
                                      </div>
                                      {formatQuantity(item.quantity)}{" "}
                                      {item.item.base_unit?.display}
                                      <div className="text-xs text-gray-500 mt-1">
                                        {" "}
                                      </div>
                                    </TableCell>
                                    {isViewOnlyStatus ? (
                                      <>
                                        <TableCell className="align-top">
                                          <div className="text-xs text-gray-500 mb-3">
                                            {" "}
                                          </div>
                                          {formatLookupId(
                                            readOnlyDrug?.group_id,
                                          )}
                                          <div className="text-xs text-gray-500 mt-1">
                                            {" "}
                                          </div>
                                        </TableCell>
                                        <TableCell className="align-top">
                                          <div className="text-xs text-gray-500 mb-3">
                                            {" "}
                                          </div>
                                          {formatLookupId(
                                            readOnlyDrug?.sub_group_id,
                                          )}
                                          <div className="text-xs text-gray-500 mt-1">
                                            {" "}
                                          </div>
                                        </TableCell>
                                        <TableCell className="align-top">
                                          <div className="text-xs text-gray-500 mb-3">
                                            {" "}
                                          </div>
                                          <div
                                            className="w-72 whitespace-normal break-words"
                                            title={readOnlyDrug?.name}
                                          >
                                            {readOnlyDrug?.name ?? "—"}
                                          </div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            {readOnlyDrug
                                              ? `${t("drug_id")}: ${readOnlyDrug.id}`
                                              : " "}
                                          </div>
                                        </TableCell>
                                      </>
                                    ) : (
                                      <>
                                        <TableCell className="align-top">
                                          <div className="text-xs text-gray-500 mb-3">
                                            {" "}
                                          </div>
                                          <div className="w-72">
                                            <Autocomplete
                                              className="h-8 w-full"
                                              value={
                                                selectedGroupId !== undefined
                                                  ? String(selectedGroupId)
                                                  : ""
                                              }
                                              onChange={handleGroupChange}
                                              onOpenChange={(open) => {
                                                if (open) ensureGroupsLoaded();
                                              }}
                                              isLoading={isLookupGroupsLoading}
                                              disabled={!institute?.id}
                                              placeholder="—"
                                              inputPlaceholder={t(
                                                "search_group",
                                              )}
                                              noOptionsMessage={t(
                                                "no_groups_found",
                                              )}
                                              options={groupAutocompleteOptions}
                                            />
                                          </div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            {selectedGroupId !== undefined
                                              ? `${t("group_id")}: ${selectedGroupId}`
                                              : " "}
                                          </div>
                                        </TableCell>
                                        <TableCell className="align-top">
                                          <div className="text-xs text-gray-500 mb-3">
                                            {" "}
                                          </div>
                                          <div className="w-72">
                                            <Autocomplete
                                              className="h-8 w-full"
                                              value={
                                                selectedSubgroupId !== undefined
                                                  ? String(selectedSubgroupId)
                                                  : ""
                                              }
                                              onChange={handleSubgroupChange}
                                              onOpenChange={(open) => {
                                                if (
                                                  open &&
                                                  selectedGroupId !== undefined
                                                )
                                                  ensureSubgroupsLoaded(
                                                    selectedGroupId,
                                                  );
                                              }}
                                              isLoading={isSubgroupsLoading}
                                              disabled={
                                                selectedGroupId === undefined
                                              }
                                              placeholder="—"
                                              inputPlaceholder={t(
                                                "search_subgroup",
                                              )}
                                              noOptionsMessage={t(
                                                "no_subgroups_found",
                                              )}
                                              options={
                                                subgroupAutocompleteOptions
                                              }
                                            />
                                          </div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            {selectedSubgroupId !== undefined
                                              ? `${t("sub_group_id")}: ${selectedSubgroupId}`
                                              : " "}
                                          </div>
                                        </TableCell>
                                        <TableCell className="align-top">
                                          <div className="text-xs text-gray-500 mb-3">
                                            {" "}
                                          </div>
                                          <div className="w-72">
                                            <Autocomplete
                                              className="h-8 w-full"
                                              value={selectedDrugId}
                                              onChange={handleCatalogDrugChange}
                                              onOpenChange={(open) => {
                                                if (
                                                  open &&
                                                  selectedGroupId !== undefined
                                                )
                                                  ensureDrugsLoaded(
                                                    selectedGroupId,
                                                    selectedSubgroupId,
                                                  );
                                              }}
                                              isLoading={isDrugsLoading}
                                              disabled={
                                                selectedGroupId === undefined
                                              }
                                              placeholder="—"
                                              inputPlaceholder={t(
                                                "search_drug",
                                              )}
                                              noOptionsMessage={t(
                                                "no_drugs_found",
                                              )}
                                              options={drugAutocompleteOptions}
                                            />
                                          </div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            {selectedDrugId
                                              ? `${t("drug_id")}: ${selectedDrugId}`
                                              : " "}
                                          </div>
                                        </TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>

                          {isDraftStatus && !hasSavedOnce && (
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                onClick={() =>
                                  handleSupplyDeliveryAction("save")
                                }
                                disabled={
                                  saveItemsMutation.isPending ||
                                  hasUnselectedDrug
                                }
                              >
                                {t("save")}
                                <ShortcutBadge actionId="submit-action" />
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <EmptyState
                          title={t("no_items_found")}
                          icon={<Box className="text-primary size-6" />}
                        />
                      )}

                      {isApprovable &&
                        hasSavedOnce &&
                        hasMoreSupplyRequests && (
                          <div className="flex justify-center">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                loadBalanceSupplyRequestsMutation.mutate()
                              }
                              disabled={
                                loadBalanceSupplyRequestsMutation.isPending
                              }
                            >
                              {t("show_balance_products")}
                            </Button>
                          </div>
                        )}

                      {isPendingStatus && (
                        <div className="flex flex-col sm:flex-row gap-3 justify-between bg-white p-4 sm:items-center border border-gray-200 rounded-md">
                          <div className="flex flex-col gap-2">
                            <p className="font-bold">
                              {t("confirm_and_send_to_dvdms")}
                            </p>
                            <span className="text-sm text-gray-500">
                              {t("confirm_and_send_to_dvdms_description")}
                            </span>
                          </div>
                          <Button
                            type="button"
                            className="w-full sm:w-auto shrink-0"
                            onClick={() => approveRecordOrderMutation.mutate()}
                            disabled={
                              !recordItemOrdersData ||
                              !recordItemOrdersData?.results?.length ||
                              approveRecordOrderMutation.isPending
                            }
                          >
                            {t("send_order_to_dvdms")}
                            <ShortcutBadge actionId="mark-as" />
                          </Button>
                        </div>
                      )}

                      {isFailedStatus && (
                        <div className="flex flex-col sm:flex-row gap-3 justify-between bg-white p-4 sm:items-center border border-gray-200 rounded-md">
                          <div className="flex flex-col gap-2">
                            <p className="font-bold">
                              {t("record_order_failed_title")}
                            </p>
                            <span className="text-sm text-gray-500">
                              {t("record_order_failed_description")}
                            </span>
                          </div>
                          <Button
                            type="button"
                            className="w-full sm:w-auto shrink-0"
                            onClick={() => retryRecordOrderMutation.mutate()}
                            disabled={retryRecordOrderMutation.isPending}
                          >
                            {t("resend_to_dvdms")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ),
            },
            "dvdms-issues": {
              label: t("issues_from_eaushadhi"),
              component: (
                <Card className="border-none rounded-lg">
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-950">
                        {t("issues_from_eaushadhi")}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t("issues_from_eaushadhi_description")}
                      </p>
                    </div>

                    {isIssuesLoading ? (
                      <TableSkeleton count={3} />
                    ) : dvdmsIssues.length > 0 ? (
                      <DvdmsIssuesTable
                        instituteId={institute?.id}
                        issues={dvdmsIssues}
                        recordBasePath={recordBasePath}
                      />
                    ) : (
                      <EmptyState
                        icon={<Inbox className="text-primary size-6" />}
                        title={t("no_issues_found")}
                        description={t("no_issues_found_description")}
                      />
                    )}
                  </CardContent>
                </Card>
              ),
            },
          }}
          currentTab={currentTab}
          onTabChange={setCurrentTab}
        />
      </div>
    </div>
  );
};

export default RequestOrderShowPage;
