import { FC } from "react";
import { useTranslation } from "react-i18next";
import { navigate } from "raviger";
import { Eye, PackageIcon } from "lucide-react";

import { I18N_NAMESPACE } from "@/lib/constants";
import { careExternalOrderPath } from "@/lib/paths";
import { formatDate, formatUserName } from "@/lib/utils";
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
  AvailableRequestOrder,
  REQUEST_ORDER_PRIORITY_VARIANTS,
  REQUEST_ORDER_STATUS_VARIANTS,
} from "@/types/requestOrder";

type DraftOrderTableProps = {
  facilityId: string;
  locationId: string;
  orders: AvailableRequestOrder[];
  isLoading: boolean;
  emptyMessage: string;
  skeletonCount?: number;
};

const DraftOrderTable: FC<DraftOrderTableProps> = ({
  facilityId,
  locationId,
  orders,
  isLoading,
  emptyMessage,
  skeletonCount = 5,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);

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
          <TableHead>{t("supplier")}</TableHead>
          <TableHead>{t("deliver_to")}</TableHead>
          <TableHead>{t("items")}</TableHead>
          <TableHead>{t("status")}</TableHead>
          <TableHead>{t("priority")}</TableHead>
          <TableHead>{t("created_by")}</TableHead>
          <TableHead className="w-36">{t("actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">{order.name}</TableCell>
            <TableCell>{order.supplier?.name ?? "—"}</TableCell>
            <TableCell>{order.destination?.name ?? "—"}</TableCell>
            <TableCell>{order.item_count}</TableCell>
            <TableCell>
              <Badge
                variant={
                  REQUEST_ORDER_STATUS_VARIANTS[order.status] ?? "secondary"
                }
              >
                {t(order.status)}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  REQUEST_ORDER_PRIORITY_VARIANTS[order.priority] ?? "secondary"
                }
              >
                {t(order.priority)}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">
                  {formatUserName(order.created_by)}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(order.created_date)}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    careExternalOrderPath(facilityId, locationId, order.id),
                  )
                }
              >
                <Eye />
                {t("see_details")}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default DraftOrderTable;
