import { FC } from "react";
import { useTranslation } from "react-i18next";
import { navigate } from "raviger";
import { Eye, PackageIcon } from "lucide-react";

import { I18N_NAMESPACE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { TableSkeleton } from "@/components/SkeletonLoading";
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
import { RecordOrder } from "@/types/recordOrder";

type RequestOrderTableProps = {
  facilityId: string;
  locationId: string;
  orders: RecordOrder[];
  isLoading: boolean;
  emptyMessage: string;
  showIndentNo?: boolean;
  outwardStatusByOrderId?: Record<string, string>;
};

const RequestOrderTable: FC<RequestOrderTableProps> = ({
  facilityId,
  locationId,
  orders,
  isLoading,
  emptyMessage,
  showIndentNo = false,
  outwardStatusByOrderId = {},
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const handleViewDetails = (order: RecordOrder) => {
    navigate(
      `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/${order.order.id}/record/${order.id}`,
    );
  };

  if (isLoading) {
    return <TableSkeleton count={5} />;
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
          {showIndentNo && <TableHead>{t("care_indent_no")}</TableHead>}
          <TableHead>{t("supplier")}</TableHead>
          <TableHead>{t("deliver_to")}</TableHead>
          <TableHead>{t("status")}</TableHead>
          <TableHead>{t("priority")}</TableHead>
          <TableHead>{t("created_by")}</TableHead>
          <TableHead className="w-36">{t("actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const displayStatus = outwardStatusByOrderId[order.id] ?? order.status;
          return (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.name}</TableCell>
              {showIndentNo && (
                <TableCell className="font-medium">
                  {order.care_indent_no ?? "—"}
                </TableCell>
              )}
              <TableCell className="font-medium">
                {order.institute_supplier?.supplier?.name ?? "—"}
              </TableCell>
              <TableCell className="font-medium">
                {order.institute_store?.store?.name ?? "—"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    REQUEST_ORDER_STATUS_VARIANTS[displayStatus] ?? "secondary"
                  }
                >
                  {t(displayStatus)}
                </Badge>
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
