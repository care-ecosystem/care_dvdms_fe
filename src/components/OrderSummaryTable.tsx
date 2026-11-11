import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { apis } from "@/apis";
import { I18N_NAMESPACE, LIST_FETCH_LIMIT } from "@/lib/constants";
import { toQuantity } from "@/lib/utils";
import { TableSkeleton } from "@/components/SkeletonLoading";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SupplyDeliveryListItem,
  VOID_SUPPLY_DELIVERY_STATUSES,
} from "@/types/supplyDelivery";

type OrderSummaryTableProps = {
  facilityId: string;
  requestOrderId: string;
};

type SummaryRow = {
  key: string;
  name: string;
  requested?: number;
  received: number;
};

/** Deliveries that were abandoned or entered in error never arrived. */
const countsAsReceived = (delivery: SupplyDeliveryListItem) =>
  !VOID_SUPPLY_DELIVERY_STATUSES.includes(delivery.status);

/**
 * What the order asked for against what has actually come in, per item.
 *
 * The requested side is the order's supply requests; the received side is the
 * supply deliveries raised against them. A delivery with no supply request —
 * something DVDMS sent that was never ordered — still gets a row, with no
 * requested quantity.
 */
const OrderSummaryTable: FC<OrderSummaryTableProps> = ({
  facilityId,
  requestOrderId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const { data: supplyRequests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ["supplyRequests", requestOrderId, "order-summary"],
    queryFn: () =>
      apis.supplyRequests.list({
        order: requestOrderId,
        limit: LIST_FETCH_LIMIT,
      }),
  });

  const { data: deliveries, isLoading: isLoadingDeliveries } = useQuery({
    queryKey: ["supplyDeliveries", facilityId, requestOrderId],
    queryFn: () =>
      apis.supplyDeliveries.list({
        facility: facilityId,
        request_order: requestOrderId,
        limit: LIST_FETCH_LIMIT,
      }),
  });

  const rows = useMemo<SummaryRow[]>(() => {
    const byRequestId = new Map<string, SummaryRow>(
      (supplyRequests?.results ?? []).map((supplyRequest) => [
        supplyRequest.id,
        {
          key: supplyRequest.id,
          name: supplyRequest.item?.name ?? "—",
          requested: toQuantity(supplyRequest.quantity),
          received: 0,
        },
      ]),
    );
    const unrequested: SummaryRow[] = [];

    for (const delivery of deliveries?.results ?? []) {
      if (!countsAsReceived(delivery)) continue;

      const quantity = toQuantity(delivery.supplied_item_quantity);
      const row = delivery.supply_request?.id
        ? byRequestId.get(delivery.supply_request.id)
        : undefined;

      if (row) {
        row.received += quantity;
        continue;
      }

      unrequested.push({
        key: delivery.id,
        name:
          delivery.supplied_item?.product_knowledge?.name ??
          delivery.supply_request?.item?.name ??
          "—",
        received: quantity,
      });
    }

    return [...byRequestId.values(), ...unrequested];
  }, [supplyRequests, deliveries]);

  if (isLoadingRequests || isLoadingDeliveries) {
    return <TableSkeleton count={3} />;
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="divide-x divide-gray-200">
              <TableHead className="min-w-[210px] text-xs font-semibold">
                {t("product_knowledge")}
              </TableHead>
              <TableHead className="text-xs font-semibold text-right">
                {t("requested_quantity")}
              </TableHead>
              <TableHead className="text-xs font-semibold text-right">
                {t("available_quantity")}
              </TableHead>
              <TableHead className="text-xs font-semibold text-right">
                {t("remaining_quantity_to_fulfill")}
              </TableHead>
              <TableHead className="text-xs font-semibold">
                {t("status")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="p-4 text-sm text-center text-gray-500"
                >
                  {t("no_items_found")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const balance =
                  row.requested != null
                    ? Math.max(0, row.requested - row.received)
                    : 0;
                const isUnrequested = row.requested == null;
                const isComplete =
                  !isUnrequested && row.received >= (row.requested ?? 0);
                const isStarted = row.received > 0;

                return (
                  <TableRow key={row.key} className="divide-x divide-gray-200">
                    <TableCell className="p-2 text-sm text-gray-900">
                      {row.name}
                    </TableCell>
                    <TableCell className="p-2 text-sm text-right tabular-nums">
                      {row.requested ?? "—"}
                    </TableCell>
                    <TableCell className="p-2 text-sm text-right tabular-nums">
                      {row.received}
                    </TableCell>
                    <TableCell className="p-2 text-sm text-right tabular-nums">
                      {isUnrequested ? "—" : balance}
                    </TableCell>
                    <TableCell className="p-2 text-sm">
                      <Badge
                        className="rounded-sm"
                        variant={
                          isUnrequested
                            ? "secondary"
                            : isComplete
                              ? "green"
                              : isStarted
                                ? "yellow"
                                : "secondary"
                        }
                      >
                        {isUnrequested
                          ? t("not_requested")
                          : isComplete
                            ? t("fully_received")
                            : isStarted
                              ? t("partially_received")
                              : t("not_received")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default OrderSummaryTable;
