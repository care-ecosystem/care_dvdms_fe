import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { navigate } from "raviger";
import { Eye, Plus } from "lucide-react";

import { apis } from "@/apis";
import { HttpMethod, PaginatedResponse } from "@/apis/types";
import {
  ACKNOWLEDGEMENT_POLL_INTERVAL_MS,
  I18N_NAMESPACE,
  LIST_FETCH_LIMIT,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { TableSkeleton } from "@/components/SkeletonLoading";
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
import {
  RecordDelivery,
  RecordDeliveryDetail,
  RecordInward,
  RecordInwardDetail,
  RecordInwardItem,
  RecordDeliveryStatus,
  RecordInwardStatus,
  RECORD_DELIVERY_STATUS_LABELS,
  RECORD_DELIVERY_STATUS_VARIANTS,
  RECORD_INWARD_STATUS_LABELS,
  RECORD_INWARD_STATUS_VARIANTS,
} from "@/types/recordOrder";

type DvdmsIssuesTableProps = {
  instituteId?: string;
  issues: RecordInward[];
  recordBasePath: string;
};

const DvdmsIssuesTable: FC<DvdmsIssuesTableProps> = ({
  instituteId,
  issues,
  recordBasePath,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);

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

  return (
    <Table className="min-w-[48rem]">
      <TableHeader>
        <TableRow>
          <TableHead>{t("issue_no")}</TableHead>
          <TableHead>{t("issue_date")}</TableHead>
          <TableHead>{t("items")}</TableHead>
          <TableHead>{t("dvdms_status")}</TableHead>
          <TableHead>{t("delivery_status")}</TableHead>
          <TableHead>{t("actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => {
          const items = itemsByIssueId.get(issue.id) ?? [];
          const delivery = deliveriesByIssueId.get(issue.id)?.[0];
          const deliveryStatus = deliveryDetailByIssueId.get(issue.id)?.status;
          const isFetched =
            issue.eaushadhi_issue_status === RecordInwardStatus.fetched;

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
                    onClick={() =>
                      navigate(
                        `${recordBasePath}/create-delivery?issue=${issue.id}`,
                      )
                    }
                  >
                    <Plus className="size-4" /> {t("create_delivery")}
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
