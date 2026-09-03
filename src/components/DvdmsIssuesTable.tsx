import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useQueries } from "@tanstack/react-query";
import { navigate } from "raviger";
import { Eye, Plus } from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE, LIST_FETCH_LIMIT } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
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
  RecordDeliveryStatus,
  RecordInward,
  RecordInwardItem,
  RECORD_DELIVERY_STATUS_VARIANTS,
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

  const itemsByIssueId = useQueries({
    queries: issues.map((issue) => ({
      queryKey: ["dvdms_record_inward_detail", instituteId, issue.id],
      queryFn: () => apis.recordInwards.retrieve(instituteId!, issue.id),
      enabled: !!instituteId,
    })),
    combine: (results) =>
      new Map<string, RecordInwardItem[]>(
        issues.map((issue, index) => [
          issue.id,
          results[index]?.data?.items ?? [],
        ]),
      ),
  });

  const deliveriesByIssueId = useQueries({
    queries: issues.map((issue) => ({
      queryKey: ["dvdms_record_deliveries", instituteId, issue.id],
      queryFn: () =>
        apis.recordInwards.listDeliveries(instituteId!, issue.id, {
          limit: LIST_FETCH_LIMIT,
          ordering: "-created_date",
        }),
      enabled: !!instituteId,
    })),
    combine: (results) =>
      new Map<string, RecordDelivery[]>(
        issues.map((issue, index) => [
          issue.id,
          results[index]?.data?.results ?? [],
        ]),
      ),
  });

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

  const deliveryDetailByIssueId = useQueries({
    queries: issueDeliveryRefs.map(({ issueId, delivery }) => ({
      queryKey: [
        "dvdms_record_delivery_detail",
        instituteId,
        issueId,
        delivery.id,
      ],
      queryFn: () =>
        apis.recordInwards.retrieveDelivery(instituteId!, issueId, delivery.id),
      enabled: !!instituteId,
    })),
    combine: (results) =>
      new Map<string, RecordDeliveryDetail | undefined>(
        issueDeliveryRefs.map(({ issueId }, index) => [
          issueId,
          results[index]?.data,
        ]),
      ),
  });

  return (
    <Table className="min-w-[48rem]">
      <TableHeader>
        <TableRow>
          <TableHead>{t("issue_no")}</TableHead>
          <TableHead>{t("issue_date")}</TableHead>
          <TableHead>{t("items")}</TableHead>
          <TableHead>{t("eaushadhi_status")}</TableHead>
          <TableHead>{t("delivery_status")}</TableHead>
          <TableHead>{t("actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => {
          const items = itemsByIssueId.get(issue.id) ?? [];
          const delivery = deliveriesByIssueId.get(issue.id)?.[0];
          const deliveryStatus = deliveryDetailByIssueId.get(issue.id)?.status;

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
                  <Badge className="rounded-sm" variant="green">
                    {issue.eaushadhi_issue_status}
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
                    {deliveryStatus === RecordDeliveryStatus.completed
                      ? t("delivered")
                      : t(deliveryStatus)}
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
                ) : (
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
