import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, FileWarning, Printer } from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE, LIST_FETCH_LIMIT } from "@/lib/constants";
import { formatDate, formatLookupId, formatQuantity } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/BackButton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PrintRequestOrderPageProps = {
  facilityId: string;
  requestOrderId: string;
  recordOrderId: string;
};

type DetailRowProps = {
  label: string;
  value: string;
};

const DetailRow: FC<DetailRowProps> = ({ label, value }) => (
  <div className="flex text-sm py-0.5">
    <span className="text-gray-600 w-32 shrink-0">{label}</span>
    <span className="text-gray-600">:&nbsp;</span>
    <span className="font-medium text-gray-950">{value}</span>
  </div>
);

const PrintRequestOrderPage: FC<PrintRequestOrderPageProps> = ({
  facilityId,
  requestOrderId,
  recordOrderId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const { data: order, isLoading: isOrderLoading } = useQuery({
    queryKey: ["dvdms_request_order", facilityId, requestOrderId],
    queryFn: () => apis.requestOrders.retrieve(facilityId, requestOrderId),
  });

  const { data: facility } = useQuery({
    queryKey: ["dvdms_facility", facilityId],
    queryFn: () => apis.facilities.get(facilityId),
  });

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
  const isPrintable = !!recordOrder && recordOrder.status !== "draft";

  const { data: supplyRequestsData, isLoading: isSupplyRequestsLoading } =
    useQuery({
      queryKey: ["dvdms_supply_requests_print", requestOrderId],
      queryFn: () =>
        apis.supplyRequests.list({
          order: requestOrderId,
          ordering: "-created_date",
          limit: 100,
          offset: 0,
        }),
      enabled: isPrintable,
    });

  const { data: recordItemOrdersData, isLoading: isRecordItemsLoading } =
    useQuery({
      queryKey: [
        "dvdms_record_item_orders_print",
        institute?.id,
        recordOrder?.id,
      ],
      queryFn: () =>
        apis.item.list(institute!.id, recordOrder!.id, { limit: 100 }),
      enabled: isPrintable && !!institute?.id && !!recordOrder?.id,
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
    enabled: isPrintable,
  });

  const categoryByProductId = new Map(
    (productKnowledgeData?.results ?? []).map((product) => [
      product.id,
      product.category?.title,
    ]),
  );

  const drugBySupplyRequestId = new Map(
    (recordItemOrdersData?.results ?? []).map((item) => [
      item.supply_request.id,
      item.drug,
    ]),
  );

  const handlePrint = () => window.print();

  if (
    isOrderLoading ||
    isRecordOrderLoading ||
    isSupplyRequestsLoading ||
    isRecordItemsLoading
  ) {
    return <div className="p-6 text-sm text-gray-500">{t("loading")}</div>;
  }

  if (!order) {
    return (
      <div className="p-6 text-sm text-gray-500">
        {t("request_order_not_found")}
      </div>
    );
  }

  const supplyRequests = supplyRequestsData?.results ?? [];
  const recordOrderDetails = recordOrder?.order;

  return (
    <div className="md:px-6 py-4 min-w-0">
      <div className="container mx-auto max-w-4xl space-y-4">
        <div className="flex justify-between items-center print:hidden">
          <BackButton variant="outline">
            <ChevronLeft className="size-4" /> {t("back")}
          </BackButton>
          <Button onClick={handlePrint} disabled={!isPrintable}>
            <Printer className="size-4" /> {t("print")}
          </Button>
        </div>

        {!isPrintable || !recordOrderDetails ? (
          <EmptyState
            title={t("no_record_items_added")}
            description={t("no_record_items_added_description")}
            icon={<FileWarning className="text-primary size-6" />}
            className="print:hidden"
          />
        ) : (
          <div
            id="section-to-print"
            className="bg-white p-8 text-sm text-gray-900"
          >
            <div className="flex justify-between items-start pb-2 border-b border-gray-300">
              <div>
                <h1 className="text-xl font-semibold">{facility?.name}</h1>
                <div className="text-gray-500 whitespace-pre-wrap text-xs">
                  {facility?.address}
                  {facility?.phone_number && (
                    <p className="text-gray-500 text-xs">
                      {facility.phone_number}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>{formatDate(recordOrder.modified_date)}</p>
              </div>
            </div>

            <div className="mt-4 text-center">
              <h2 className="text-base font-semibold uppercase tracking-wide">
                {t("order")}: {recordOrder.name}
              </h2>
              <p className="text-xs text-gray-600">
                {t("delivery_request_to")}{" "}
                {order.origin?.name || order.supplier?.name || t("origin")}{" "}
                {t("to")} {order.destination?.name || t("destination")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-x-8 border-t border-gray-200 mt-3 pt-3">
              <div>
                <DetailRow
                  label={t("deliver_to")}
                  value={order.destination?.name ?? "—"}
                />
                {order.origin && (
                  <DetailRow label={t("origin")} value={order.origin.name} />
                )}
                {order.supplier && (
                  <DetailRow
                    label={t("supplier")}
                    value={order.supplier.name}
                  />
                )}
                <DetailRow
                  label={t("store_name")}
                  value={
                    recordOrder.institute_store?.eaushadhi_store_name ?? "—"
                  }
                />
                <DetailRow
                  label={t("warehouse")}
                  value={
                    recordOrder.institute_supplier?.eaushadhi_warehouse_name ??
                    "—"
                  }
                />
              </div>
              <div>
                <DetailRow label={t("status")} value={t(recordOrder.status)} />
                <DetailRow
                  label={t("priority")}
                  value={t(recordOrderDetails.priority)}
                />
                <DetailRow
                  label={t("category")}
                  value={t(recordOrderDetails.category)}
                />
                <DetailRow
                  label={t("intent")}
                  value={t(recordOrderDetails.intent)}
                />
                <DetailRow
                  label={t("reason")}
                  value={t(recordOrderDetails.reason)}
                />
              </div>
            </div>

            {order.tags.length > 0 && (
              <div className="mt-2">
                <DetailRow
                  label={t("tags")}
                  value={order.tags.map((tag) => tag.display).join(", ")}
                />
              </div>
            )}

            {order.note && (
              <div className="mt-2">
                <DetailRow label={t("note")} value={order.note} />
              </div>
            )}

            <div className="mt-4">
              <Table className="[&_td]:whitespace-normal [&_th]:whitespace-normal">
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2}>{t("product")}</TableHead>
                    <TableHead rowSpan={2}>{t("category")}</TableHead>
                    <TableHead rowSpan={2}>{t("qty")}</TableHead>
                    <TableHead colSpan={3} className="text-center border-b">
                      {t("dvdms_drug_details")}
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead>{t("group_id")}</TableHead>
                    <TableHead>{t("sub_group_id")}</TableHead>
                    <TableHead className="w-1/3">{t("drug_name")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplyRequests.map((item) => {
                    const drug = drugBySupplyRequestId.get(item.id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.item.name}</TableCell>
                        <TableCell>
                          {categoryByProductId.get(item.item.id) ?? "—"}
                        </TableCell>
                        <TableCell>
                          {formatQuantity(item.quantity)}{" "}
                          {item.item.base_unit?.display}
                        </TableCell>
                        <TableCell>{formatLookupId(drug?.group_id)}</TableCell>
                        <TableCell>
                          {formatLookupId(drug?.sub_group_id)}
                        </TableCell>
                        <TableCell className="align-top break-words">
                          {drug?.name ?? "—"}
                          {drug && (
                            <div className="text-xs text-gray-500 mt-1">
                              {t("drug_id")}: {drug.id}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between text-xs text-gray-500 pt-4 mt-4 border-t border-gray-200">
              <span>
                {t("created_by")}:{" "}
                {order.created_by
                  ? `${order.created_by.first_name} ${order.created_by.last_name}`.trim() ||
                    order.created_by.username
                  : "—"}
              </span>
              <span>{formatDate(order.created_date)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintRequestOrderPage;
