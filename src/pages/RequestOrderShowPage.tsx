import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { navigate } from "raviger";
import {
  Ban,
  Box,
  ChevronLeft,
  CircleAlert,
  Edit,
  EllipsisVertical,
  Pause,
  Printer,
  Trash2,
  Truck,
} from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
import { formatDate, formatQuantity } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import RequestOrderTagsCell from "@/components/Tags/RequestOrderTagsCell";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import {
  REQUEST_ORDER_PRIORITY_VARIANTS,
  REQUEST_ORDER_STATUS_VARIANTS,
} from "@/types/requestOrder";
import { SupplyRequest } from "@/types/supplyRequest";

type RequestOrderShowPageProps = {
  facilityId: string;
  locationId: string;
  requestOrderId: string;
};

type TabValue = "requested-items" | "deliveries" | "items-summary";

const RequestOrderShowPage: FC<RequestOrderShowPageProps> = (props) => (
  <ShortcutProvider>
    <RequestOrderShowPageContent {...props} />
  </ShortcutProvider>
);

const RequestOrderShowPageContent: FC<RequestOrderShowPageProps> = ({
  facilityId,
  locationId,
  requestOrderId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  useShortcutSubContext("facility:inventory");

  const [currentTab, setCurrentTab] = useState<TabValue>("requested-items");
  const [tableItems, setTableItems] = useState<SupplyRequest[]>([]);

  const { data: order, isLoading } = useQuery({
    queryKey: ["dvdms_request_order", facilityId, requestOrderId],
    queryFn: () => apis.requestOrders.retrieve(facilityId, requestOrderId),
  });

  const { data: supplyRequestsData } = useQuery({
    queryKey: ["dvdms_supply_requests", requestOrderId],
    queryFn: () =>
      apis.supplyRequests.list({
        order: requestOrderId,
        ordering: "-created_date",
        limit: 14,
        offset: 0,
      }),
  });

  useEffect(() => {
    setTableItems(supplyRequestsData?.results ?? []);
  }, [supplyRequestsData]);

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

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.dvdmsInstitute.get(facilityId),
  });

  const { data: recordOrdersData } = useQuery({
    queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
    queryFn: () =>
      apis.recordOrders.list(institute!.id, {
        order: requestOrderId,
        limit: 1,
      }),
    enabled: !!institute?.id,
  });
  const recordOrder = recordOrdersData?.results?.[0];

  const goToList = () =>
    navigate(
      `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms`,
    );

  // TODO: wire up status-change API call once available
  const handleMarkAsStatus = (_status: string) => {};

  // TODO: wire up supply-delivery mutations once available
  const handleSupplyDeliveryAction = (_action: string) => {};

  const handleRemoveTableItem = (id: string) => {
    setTableItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">{t("loading")}</div>;
  }

  if (!order) {
    return (
      <div className="p-6 text-sm text-gray-500">
        {t("request_order_not_found")}
      </div>
    );
  }

  const isRequester = order.destination?.id === locationId;

  const requestedItemsLabel = isRequester
    ? order.status === "completed"
      ? t("items_updated_stock")
      : t("items_to_send")
    : t("items_to_dispatch");

  return (
    <div className="md:px-6 py-0 space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={goToList}
          >
            <ChevronLeft />
          </Button>
          <div>
            <h4 className="text-lg font-semibold text-gray-950">
              {order.name}
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

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline">
            <Printer className="size-4" /> {t("print")}
            <ShortcutBadge actionId="print-button" />
          </Button>
          <Button variant="outline">
            <Edit className="size-4" /> {t("edit")}
            <ShortcutBadge actionId="edit-order" />
          </Button>

          {order.status === "pending" && (
            <Button onClick={() => handleMarkAsStatus("pending")}>
              {t("mark_as_approved")}
              <ShortcutBadge actionId="mark-as" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-gray-400 px-2">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {order.status !== "draft" && (
                <DropdownMenuItem onClick={() => handleMarkAsStatus("draft")}>
                  <Pause className="mr-1" /> {t("mark_as_draft")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => handleMarkAsStatus("entered_in_error")}
              >
                <CircleAlert className="mr-1" />{" "}
                {t("mark_as_entered_in_error")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleMarkAsStatus("abandoned")}
              >
                <Ban className="mr-1" /> {t("mark_as_abandoned")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card className="border-none rounded-lg">
        <CardContent className="space-y-1 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("deliver_to")}
              </label>
              <div className="text-lg font-semibold text-gray-950">
                {order.destination?.name ?? "—"}
              </div>
            </div>

            {order.origin && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("origin")}
                </label>
                <div className="text-lg font-semibold text-gray-950">
                  {order.origin.name}
                </div>
              </div>
            )}

            {order.supplier && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("supplier")}
                </label>
                <div className="text-lg font-semibold text-gray-950">
                  {order.supplier.name}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("priority")}
              </label>
              <div>
                <Badge
                  className="rounded-sm"
                  variant={
                    REQUEST_ORDER_PRIORITY_VARIANTS[order.priority] ??
                    "secondary"
                  }
                >
                  {t(order.priority)}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("tags")}
              </label>
              <div className="flex flex-wrap gap-2">
                <RequestOrderTagsCell
                  facilityId={facilityId}
                  requestOrderId={order.id}
                  tags={order.tags}
                  compact
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("status")}
              </label>
              <div>
                <Badge
                  className="rounded-sm"
                  variant={
                    REQUEST_ORDER_STATUS_VARIANTS[
                      recordOrder?.status ?? order.status
                    ] ?? "secondary"
                  }
                >
                  {t(recordOrder?.status ?? order.status)}
                </Badge>
              </div>
            </div>

            {order.created_by && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("created_by")}
                </label>
                <div className="flex flex-col gap-0.5">
                  <span className="text-md font-semibold text-gray-950">
                    {`${order.created_by.first_name} ${order.created_by.last_name}`.trim() ||
                      order.created_by.username}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(order.created_date)}
                  </span>
                </div>
              </div>
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

      <Card className="-mt-4 mx-5 rounded-t-none shadow-none bg-gray-100">
        <CardContent className="space-y-1 px-5 py-2 grid lg:grid-cols-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("category")}
              </label>
              <div className="text-base font-semibold">
                {t(order.category)}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("intent")}
              </label>
              <div className="text-base font-semibold">{t(order.intent)}</div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("reason")}
              </label>
              <div className="text-base font-semibold">{t(order.reason)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={currentTab}
        onValueChange={(value) => setCurrentTab(value as TabValue)}
      >
        <TabsList className="w-full justify-evenly sm:justify-start border-b rounded-none bg-transparent p-0 h-auto overflow-x-auto">
          <TabsTrigger
            value="requested-items"
            className="border-b-3 px-2.5 py-1 font-semibold text-gray-600 hover:text-gray-900 data-[state=active]:border-b-primary-700 data-[state=active]:text-primary-800 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            {requestedItemsLabel}
          </TabsTrigger>
          <TabsTrigger
            value="deliveries"
            className="border-b-3 px-2.5 py-1 font-semibold text-gray-600 hover:text-gray-900 data-[state=active]:border-b-primary-700 data-[state=active]:text-primary-800 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            {t("supply_deliveries")}
          </TabsTrigger>
          <TabsTrigger
            value="items-summary"
            className="border-b-3 px-2.5 py-1 font-semibold text-gray-600 hover:text-gray-900 data-[state=active]:border-b-primary-700 data-[state=active]:text-primary-800 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            {t("items_summary")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requested-items" className="mt-2 space-y-4">
          

          <Card className="bg-gray-50 py-4 rounded-md">
            <CardContent className="space-y-4">
              {tableItems.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2}>{t("product")}</TableHead>
                        <TableHead rowSpan={2}>{t("category")}</TableHead>
                        <TableHead rowSpan={2}>{t("qty")}</TableHead>
                        <TableHead
                          colSpan={2}
                          className="text-center border-b"
                        >
                          {t("eaushadhi_drug_details")}
                        </TableHead>
                        <TableHead rowSpan={2}>{t("actions")}</TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead>{t("drug_id")}</TableHead>
                        <TableHead>{t("drug_name")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.item.name}</TableCell>
                          <TableCell>
                            {categoryByProductId.get(item.item.id) ?? "—"}
                          </TableCell>
                          <TableCell>
                            {formatQuantity(item.quantity)}{" "}
                            {item.item.base_unit?.display}
                          </TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveTableItem(item.id)}
                              aria-label={t("remove")}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTableItems([])}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleSupplyDeliveryAction("save")}
                    >
                      {t("save")}
                      <ShortcutBadge actionId="submit-action" />
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title={t("no_items_found")}
                  icon={<Box className="text-primary size-6" />}
                />
              )}
            </CardContent>
          </Card>

          {order.status === "draft" && (
            <div className="flex flex-row gap-2 justify-between bg-white p-4 items-center border border-gray-200 rounded-md">
              <div className="flex flex-col gap-2">
                <p className="font-bold">
                  {t("review_and_finalise_request")}
                </p>
                <span className="text-sm text-gray-500">
                  {t("review_and_finalise_request_description")}
                </span>
              </div>
              <Button
                type="button"
                onClick={() => handleMarkAsStatus("pending")}
              >
                {t("mark_as_approved")}
                <ShortcutBadge actionId="mark-as" />
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="deliveries" className="mt-2 space-y-4">
          <EmptyState
            title={t("no_deliveries_found")}
            icon={<Truck className="text-primary size-6" />}
          />
        </TabsContent>

        <TabsContent value="items-summary" className="mt-2 space-y-4">
          <EmptyState
            title={t("no_items_summary_found")}
            icon={<Box className="text-primary size-6" />}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RequestOrderShowPage;
