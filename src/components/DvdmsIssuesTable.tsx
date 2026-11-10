import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "raviger";
import { Eye, Loader2Icon, Plus } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import { BatchError, performSuperBatchRequest } from "@/apis/query";
import { HttpMethod, PaginatedResponse } from "@/apis/types";
import {
  ACKNOWLEDGEMENT_POLL_INTERVAL_MS,
  I18N_NAMESPACE,
  LIST_FETCH_LIMIT,
} from "@/lib/constants";
import { formatDate, toQuantity } from "@/lib/utils";
import { TableSkeleton } from "@/components/SkeletonLoading";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeliveryOrderStatus } from "@/types/deliveryOrder";
import {
  RecordDelivery,
  RecordDeliveryDetail,
  RecordInward,
  RecordInwardDetail,
  RecordInwardItem,
  RecordDeliveryStatus,
  RecordInwardStatus,
  RecordOrder,
  RECORD_DELIVERY_STATUS_LABELS,
  RECORD_DELIVERY_STATUS_VARIANTS,
  RECORD_INWARD_STATUS_LABELS,
  RECORD_INWARD_STATUS_VARIANTS,
} from "@/types/recordOrder";
import {
  getDeliveryOrderName,
  getDeliveryOrderNote,
} from "@/utils/pluginConfig";

type DvdmsIssuesTableProps = {
  facilityId: string;
  locationId: string;
  instituteId?: string;
  recordOrder?: RecordOrder;
  issues: RecordInward[];
  recordBasePath: string;
};

const DELIVERY_ORDER_REF = "delivery-order";
const RECORD_DELIVERY_REF = "record-delivery";

const DvdmsIssuesTable: FC<DvdmsIssuesTableProps> = ({
  facilityId,
  locationId,
  instituteId,
  recordOrder,
  issues,
  recordBasePath,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const queryClient = useQueryClient();

  // Creates the CARE delivery order and its DVDMS record delivery in one
  const {
    mutate: createDelivery,
    isPending: isCreatingDelivery,
    variables: creatingIssueId,
  } = useMutation({
    mutationFn: async (issueId: string) => {
      const results = await performSuperBatchRequest({
        requests: [
          {
            reference_id: DELIVERY_ORDER_REF,
            url: apis.deliveryOrders.listPath(facilityId),
            method: HttpMethod.POST,
            body: {
              status: DeliveryOrderStatus.draft,
              name: getDeliveryOrderName(recordOrder!.name),
              note: getDeliveryOrderNote() || undefined,
              supplier: recordOrder!.institute_supplier?.supplier.id,
              destination: locationId,
              extensions: {},
            },
          },
          {
            reference_id: RECORD_DELIVERY_REF,
            url: apis.recordInwards.deliveriesPath(instituteId!, issueId),
            method: HttpMethod.POST,
            body: {
              delivery_order: "",
              record_order: recordOrder!.id,
              status: RecordDeliveryStatus.pending,
            },
            replacements: [
              {
                source_path: { reference_id: DELIVERY_ORDER_REF, path: "id" },
                value_path: {
                  reference_id: RECORD_DELIVERY_REF,
                  path: "delivery_order",
                },
              },
            ],
          },
        ],
      });
      const deliveryOrderId = (
        results.find((result) => result.reference_id === DELIVERY_ORDER_REF)
          ?.data as { id?: string } | undefined
      )?.id;
      if (!deliveryOrderId) {
        throw new Error("Super batch did not return the created records");
      }
      return { deliveryOrderId, issueId };
    },
    onSuccess: ({ deliveryOrderId, issueId }) => {
      toast.success(t("delivery_order_created_successfully"));
      navigate(
        `${recordBasePath}/delivery/${deliveryOrderId}?issue=${issueId}`,
      );
    },
    onError: (error: unknown) => {
      const message =
        error instanceof BatchError ? error.errorMessages[0] : undefined;
      toast.error(message || t("failed_to_create_delivery_order"));
    },
    // Also on failure: a delivery created elsewhere then shows as "View delivery".
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_inwards"] });
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_deliveries"] });
    },
  });

  // Same key and fetch as RequestOrderShowPage's
  const { data: recordItemOrdersData } = useQuery({
    queryKey: ["dvdms_record_item_orders", instituteId, recordOrder?.id],
    queryFn: () => apis.item.list(instituteId!, recordOrder!.id, { limit: 100 }),
    enabled: !!instituteId && !!recordOrder?.id,
  });

  /** Requested quantity per record order item — what the indent asked for. */
  const requestedQuantityByItemId = new Map<string, number>(
    recordItemOrdersData?.results?.map((item) => [
      item.id,
      toQuantity(item.supply_request.quantity),
    ]) ?? [],
  );

  const issueIds = issues.map((issue) => issue.id);

  const { data: issueDetailResults, isPending: isIssueDetailsPending } =
    useQuery({
      queryKey: ["dvdms_record_inward_detail", instituteId, issueIds],
      queryFn: async () => {
        const response = await apis.batchRequests.createChunked({
          requests: issues.map((issue) => ({
            url: apis.recordInwards.path(instituteId!, issue.id),
            method: HttpMethod.GET,
            reference_id: issue.id,
          })),
        });
        return response.results;
      },
      enabled: !!instituteId && issues.length > 0,
    });

  const issueDetailByIssueId = new Map<string, RecordInwardDetail | undefined>(
    issueDetailResults?.map((result) => [
      result.reference_id,
      result.data as RecordInwardDetail | undefined,
    ]) ?? [],
  );

  const itemsByIssueId = new Map<string, RecordInwardItem[]>(
    issues.map((issue) => [
      issue.id,
      issueDetailByIssueId.get(issue.id)?.items ?? [],
    ]),
  );

  const { data: deliveryResults, isPending: isDeliveriesPending } = useQuery({
    queryKey: ["dvdms_record_deliveries", instituteId, issueIds],
    queryFn: async () => {
      const response = await apis.batchRequests.createChunked({
        requests: issues.map((issue) => ({
          url: apis.recordInwards.deliveriesPath(instituteId!, issue.id),
          method: HttpMethod.GET,
          body: { limit: LIST_FETCH_LIMIT, ordering: "-created_date" },
          reference_id: issue.id,
        })),
      });
      return response.results;
    },
    enabled: !!instituteId && issues.length > 0,
  });

  const deliveriesByIssueId = new Map<string, RecordDelivery[]>(
    deliveryResults?.map((result) => [
      result.reference_id,
      (result.data as PaginatedResponse<RecordDelivery> | undefined)?.results ??
        [],
    ]) ?? [],
  );

  /** Issues that already have a delivery — its status comes from the detail read. */
  const issueDeliveryRefs = issues
    .map((issue) => ({
      issueId: issue.id,
      delivery: deliveriesByIssueId.get(issue.id)?.[0],
    }))
    .filter(
      (ref): ref is { issueId: string; delivery: RecordDelivery } =>
        !!ref.delivery,
    );

  const hasIssueDeliveries = issueDeliveryRefs.length > 0;

  const { data: deliveryDetailResults, isPending: isDeliveryDetailsPending } =
    useQuery({
      queryKey: [
        "dvdms_record_delivery_detail",
        instituteId,
        issueDeliveryRefs.map(({ delivery }) => delivery.id),
      ],
      queryFn: async () => {
        const response = await apis.batchRequests.createChunked({
          requests: issueDeliveryRefs.map(({ issueId, delivery }) => ({
            url: apis.recordInwards.deliveryPath(
              instituteId!,
              issueId,
              delivery.id,
            ),
            method: HttpMethod.GET,
            reference_id: issueId,
          })),
        });
        return response.results;
      },
      enabled: !!instituteId && hasIssueDeliveries,
      refetchInterval: (query) =>
        query.state.data?.some(
          (result) =>
            (result.data as RecordDeliveryDetail | undefined)?.status ===
            RecordDeliveryStatus.received,
        )
          ? ACKNOWLEDGEMENT_POLL_INTERVAL_MS
          : false,
    });

  const deliveryDetailByIssueId = new Map<
    string,
    RecordDeliveryDetail | undefined
  >(
    deliveryDetailResults?.map((result) => [
      result.reference_id,
      result.data as RecordDeliveryDetail | undefined,
    ]) ?? [],
  );

  const isLoadingIssueDetails =
    !!instituteId &&
    (isIssueDetailsPending ||
      isDeliveriesPending ||
      (hasIssueDeliveries && isDeliveryDetailsPending));

  if (isLoadingIssueDetails) {
    return <TableSkeleton count={issues.length} />;
  }

  /**
   * The shortcut clicks the first element carrying its id, so only the first
   * row that can create a delivery advertises the key — every row showing it
   * would promise a shortcut that lands somewhere else.
   */
  const firstCreatableIssueId = issues.find(
    (issue) =>
      !deliveriesByIssueId.get(issue.id)?.[0] &&
      issue.eaushadhi_issue_status === RecordInwardStatus.fetched,
  )?.id;

  return (
    <Table className="min-w-[56rem]">
      <TableHeader>
        <TableRow>
          <TableHead>{t("issue_no")}</TableHead>
          <TableHead>{t("issue_date")}</TableHead>
          <TableHead>{t("items")}</TableHead>
          <TableHead className="text-right">{t("requested_qty")}</TableHead>
          <TableHead className="text-right">{t("dispatched_qty")}</TableHead>
          <TableHead>{t("dvdms_status")}</TableHead>
          <TableHead>{t("delivery_status")}</TableHead>
          <TableHead>{t("actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => {
          const items = itemsByIssueId.get(issue.id) ?? [];
          const delivery = deliveriesByIssueId.get(issue.id)?.[0];
          const deliveryDetail = deliveryDetailByIssueId.get(issue.id);
          const deliveryStatus = deliveryDetail?.status;
          const isFetched =
            issue.eaushadhi_issue_status === RecordInwardStatus.fetched;

          // What the indent asked for, across the order items this issue
          // covers. Counted once per record order item: DVDMS splits a drug
          const requestedItemIds = new Set(
            items.map((item) => item.record_order_item),
          );
          const requestedQuantity = [...requestedItemIds].reduce(
            (total, itemId) =>
              total + (requestedQuantityByItemId.get(itemId) ?? 0),
            0,
          );
          // What DVDMS actually issued against this issue
          const dispatchedQuantity = items.reduce(
            (total, item) => total + toQuantity(item.received_quantity),
            0,
          );

          return (
            <TableRow key={issue.id}>
              <TableCell className="align-top font-semibold text-gray-950">
                {issue.eaushadhi_issue_no || "—"}
              </TableCell>
              <TableCell className="align-top">
                {formatDate(issue.created_at)}
              </TableCell>
              <TableCell className="align-top">
                {t("item_count", { count: items.length })}
              </TableCell>
              <TableCell className="align-top text-right tabular-nums">
                {requestedItemIds.size > 0 ? requestedQuantity : "—"}
              </TableCell>
              <TableCell className="align-top text-right tabular-nums">
                {items.length > 0 ? dispatchedQuantity : "—"}
              </TableCell>
              <TableCell className="align-top">
                {issue.eaushadhi_issue_status ? (
                  <Badge
                    className="rounded-sm"
                    variant={
                      RECORD_INWARD_STATUS_VARIANTS[
                        issue.eaushadhi_issue_status
                      ] ?? "secondary"
                    }
                  >
                    {t(
                      RECORD_INWARD_STATUS_LABELS[
                        issue.eaushadhi_issue_status
                      ] ?? issue.eaushadhi_issue_status,
                    )}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="align-top">
                {deliveryStatus ? (
                  <Badge
                    className="rounded-sm"
                    variant={
                      RECORD_DELIVERY_STATUS_VARIANTS[deliveryStatus] ??
                      "secondary"
                    }
                  >
                    {t(
                      RECORD_DELIVERY_STATUS_LABELS[deliveryStatus] ??
                        deliveryStatus,
                    )}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="align-top">
                {delivery ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `${recordBasePath}/delivery/${delivery.delivery_order.id}?issue=${issue.id}`,
                      )
                    }
                  >
                    <Eye className="size-4" /> {t("view_delivery")}
                  </Button>
                ) : isFetched ? (
                  <Button
                    size="sm"
                    onClick={() => createDelivery(issue.id)}
                    disabled={
                      !instituteId || !recordOrder || isCreatingDelivery
                    }
                  >
                    {isCreatingDelivery && creatingIssueId === issue.id ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}{" "}
                    {t("create_delivery")}
                    {issue.id === firstCreatableIssueId && (
                      <ShortcutBadge actionId="create-delivery" />
                    )}
                  </Button>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default DvdmsIssuesTable;
