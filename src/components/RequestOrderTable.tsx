import { FC } from "react";
import { useTranslation } from "react-i18next";
import { navigate } from "raviger";
import { Eye, PackageIcon } from "lucide-react";

import { I18N_NAMESPACE } from "@/lib/constants";
import { dvdmsBasePath } from "@/lib/paths";
import { formatDate } from "@/lib/utils";
import { TableSkeleton } from "@/components/SkeletonLoading";
import DvdmsIssueStatusBadge from "@/components/DvdmsIssueStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  REQUEST_ORDER_PRIORITY_VARIANTS,
  REQUEST_ORDER_STATUS_VARIANTS,
} from "@/types/requestOrder";
import {
  RecordOrder,
  RecordOrderOutward,
  showsDvdmsIndentStatus,
} from "@/types/recordOrder";

type RequestOrderTableProps = {
  facilityId: string;
  locationId: string;
  orders: RecordOrder[];
  isLoading: boolean;
  emptyMessage: string;
  showIndentNo?: boolean;
  outwardByOrderId?: Record<string, RecordOrderOutward>;
  skeletonCount?: number;
};

const RequestOrderTable: FC<RequestOrderTableProps> = ({
  facilityId,
  locationId,
  orders,
  isLoading,
  emptyMessage,
  showIndentNo = false,
  outwardByOrderId = {},
  skeletonCount = 5,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const handleViewDetails = (order: RecordOrder) => {
    navigate(
      `${dvdmsBasePath(facilityId, locationId)}/${order.order.id}/record/${order.id}`,
    );
  };

  if (isLoading) {
    return <TableSkeleton count={skeletonCount} />;
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        icon={<PackageIcon className="text-primary size-6" />}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("name")}</TableHead>
          {showIndentNo && <TableHead>{t("eaushadhi_indent_no")}</TableHead>}
          <TableHead>{t("dvdms_store")}</TableHead>
          <TableHead>{t("dvdms_warehouse")}</TableHead>
          <TableHead>{t("status")}</TableHead>
          <TableHead>{t("priority")}</TableHead>
          <TableHead>{t("created_by")}</TableHead>
          <TableHead className="w-36">{t("actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const outward = outwardByOrderId[order.id];
          return (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.name}</TableCell>
              {showIndentNo && (
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">
                      {outward?.eaushadhi_indent_no ?? "—"}
                    </span>
                    {order.care_indent_no && (
                      <span className="text-xs text-gray-500">
                        {t("care_indent_no")}: {order.care_indent_no}
                      </span>
                    )}
                  </div>
                </TableCell>
              )}
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">
                    {order.institute_store?.eaushadhi_store_name ||
                      order.institute_store?.store?.name ||
                      "—"}
                  </span>
                  {order.institute_store?.eaushadhi_store_name &&
                    order.institute_store?.store?.name && (
                      <span className="text-xs text-gray-500">
                        {t("care_location")}: {order.institute_store.store.name}
                      </span>
                    )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">
                    {order.institute_supplier?.eaushadhi_warehouse_name ||
                      order.institute_supplier?.supplier?.name ||
                      "—"}
                  </span>
                  {order.institute_supplier?.eaushadhi_warehouse_name &&
                    order.institute_supplier?.supplier?.name && (
                      <span className="text-xs text-gray-500">
                        {t("care_supplier")}:{" "}
                        {order.institute_supplier.supplier.name}
                      </span>
                    )}
                </div>
              </TableCell>
              <TableCell>
                {showsDvdmsIndentStatus(order.status) &&
                outward?.eaushadhi_indent_status ? (
                  <DvdmsIssueStatusBadge
                    status={outward.eaushadhi_indent_status}
                  />
                ) : (
                  <Badge
                    variant={
                      REQUEST_ORDER_STATUS_VARIANTS[order.status] ?? "secondary"
                    }
                  >
                    {t(order.status)}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    REQUEST_ORDER_PRIORITY_VARIANTS[order.order.priority] ??
                    "secondary"
                  }
                >
                  {t(order.order.priority)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">
                    {order.created_by
                      ? `${order.created_by.first_name} ${order.created_by.last_name}`.trim() ||
                        order.created_by.username
                      : "—"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(order.created_date)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Button variant="outline" onClick={() => handleViewDetails(order)}>
                  <Eye />
                  {t("see_details")}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default RequestOrderTable;
