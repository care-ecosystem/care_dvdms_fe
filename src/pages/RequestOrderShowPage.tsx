import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "raviger";
import { toast } from "sonner";
import {
  Ban,
  Box,
  ChevronLeft,
  CircleAlert,
  Edit,
  EllipsisVertical,
  Pause,
  Printer,
  // Trash2,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { RecordItemOrderDrug } from "@/types/recordOrderItem";
import {
  DvdmsLookupDrug,
  DvdmsLookupGroup,
  DvdmsLookupSubgroup,
} from "@/types/dvdms_config";

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
  const queryClient = useQueryClient();

  const [currentTab, setCurrentTab] = useState<TabValue>("requested-items");
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

  const { data: supplyRequestsData } = useQuery({
    queryKey: ["dvdms_supply_requests", requestOrderId],
    queryFn: () =>
      apis.supplyRequests.list({
        order: requestOrderId,
        ordering: "-created_date",
        limit: SUPPLY_REQUESTS_PAGE_SIZE,
        offset: 0,
      }),
  });

  const [loadedSupplyRequestsCount, setLoadedSupplyRequestsCount] =
    useState(0);
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

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
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

  const { data: productMappingsData } = useQuery({
    queryKey: ["dvdms_product_mappings", institute?.id, recordOrder?.id],
    queryFn: () =>
      apis.productMappings.list(institute!.id, recordOrder!.id, {
        limit: 100,
      }),
    enabled: !!institute?.id && !!recordOrder?.id,
  });

  const existingItemBySupplyRequestId = new Map(
    (recordItemOrdersData?.results ?? []).map((item) => [
      item.supply_request.id,
      item,
    ]),
  );

  const suggestedDrugBySupplyRequestId = new Map(
    (productMappingsData?.results ?? [])
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

  const ensureSubgroupsLoaded = async (groupId: number) => {
    if (!institute?.id || subgroupsByGroupId[groupId]) return;
    const instituteId = institute.id;
    const data = await queryClient.fetchQuery({
      queryKey: ["dvdms_lookup_subgroups", instituteId, groupId],
      queryFn: () => apis.institutes.lookupSubgroups(instituteId, groupId),
    });
    setSubgroupsByGroupId((prev) => ({ ...prev, [groupId]: data }));
  };

  const ensureDrugsLoaded = async (groupId: number, subgroupId: number) => {
    if (!institute?.id) return;
    const key = `${groupId}:${subgroupId}`;
    if (drugsByGroupAndSubgroup[key]) return;
    const instituteId = institute.id;
    const data = await queryClient.fetchQuery({
      queryKey: ["dvdms_lookup_drugs", instituteId, groupId, subgroupId],
      queryFn: () =>
        apis.institutes.lookupDrugs(instituteId, {
          hstnum_group_id: groupId,
          hstnum_subgroup_id: subgroupId,
        }),
    });
    setDrugsByGroupAndSubgroup((prev) => ({ ...prev, [key]: data }));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableItems, recordItemOrdersData, productMappingsData]);

  const saveItemsMutation = useMutation({
    mutationFn: async () => {
      if (!institute?.id || !recordOrder?.id) {
        throw new Error("Missing institute or record order");
      }
      const instituteId = institute.id;
      const recordOrderId = recordOrder.id;
      await Promise.all(
        tableItems.map((item) => {
          const drug = selectedDrugs[item.id];
          if (!drug) return Promise.resolve(null);
          return apis.item.create(instituteId, recordOrderId, {
            supply_request: item.id,
            drug,
          });
        }),
      );
      await apis.recordOrders.update(instituteId, recordOrderId, {
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
    onError: () => {
      toast.error(t("save_failed"));
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
    },
    onError: () => {
      toast.error(t("record_order_approve_failed"));
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

  const goToList = () =>
    navigate(
      `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms`,
    );

  const handleSupplyDeliveryAction = (action: string) => {
    if (action === "save") {
      saveItemsMutation.mutate();
    }
  };

  const hasUnselectedDrug = tableItems.some((item) => !selectedDrugs[item.id]);

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
  const recordOrderStatus = recordOrder?.status ?? order.status;
  const isDraftStatus = recordOrderStatus === "draft";
  const isApprovedStatus = recordOrderStatus === "approved";
  const isApprovable =
    recordOrderStatus === "draft" || recordOrderStatus === "pending";

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

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() =>
              navigate(
                `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/${requestOrderId}/print`,
              )
            }
          >
            <Printer className="size-4" /> {t("print")}
            <ShortcutBadge actionId="print-button" />
          </Button>
          {recordOrder?.status == "draft" &&
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/${requestOrderId}/edit`,
                )
              }
            >
              <Edit className="size-4" /> {t("edit")}
              <ShortcutBadge actionId="edit-order" />
            </Button>
          }

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {(recordOrder?.status === "draft" ||
                recordOrder?.status === "pending") && (
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

            {recordOrder && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("status")}
                </label>
                <div>
                  <Badge
                    className="rounded-sm"
                    variant={
                      REQUEST_ORDER_STATUS_VARIANTS[recordOrder.status] ??
                      "secondary"
                    }
                  >
                    {t(recordOrder.status)}
                  </Badge>
                </div>
              </div>
            )}

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
                          colSpan={3}
                          className="text-center border-b"
                        >
                          {t("eaushadhi_drug_details")}
                        </TableHead>
                        {/* <TableHead rowSpan={2}>{t("actions")}</TableHead> */}
                      </TableRow>
                      <TableRow>
                        <TableHead>{t("group_id")}</TableHead>
                        <TableHead>{t("sub_group_id")}</TableHead>
                        <TableHead>{t("drug_name")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableItems.map((item) => {
                        const existingDrug =
                          existingItemBySupplyRequestId.get(item.id)?.drug;
                        const suggestedDrug = suggestedDrugBySupplyRequestId.get(
                          item.id,
                        );
                        const mappedDrugOptions: RecordItemOrderDrug[] = [];
                        if (existingDrug) mappedDrugOptions.push(existingDrug);
                        if (
                          suggestedDrug &&
                          suggestedDrug.id !== existingDrug?.id
                        ) {
                          mappedDrugOptions.push(suggestedDrug);
                        }
                        const hasProductMapping = mappedDrugOptions.length > 0;

                        const selectedDrugId = selectedDrugs[item.id]?.id ?? "";
                        const readOnlyDrug =
                          existingItemBySupplyRequestId.get(item.id)?.drug ??
                          selectedDrugs[item.id];

                        const handleMappedDrugChange = (value: string) => {
                          const drug = mappedDrugOptions.find(
                            (option) => option.id === value,
                          );
                          setSelectedDrugs((prev) => ({
                            ...prev,
                            [item.id]: drug,
                          }));
                        };

                        const selectedGroupId =
                          selectedGroupBySupplyRequestId[item.id];
                        const selectedSubgroupId =
                          selectedSubgroupBySupplyRequestId[item.id];
                        const subgroupOptions =
                          selectedGroupId !== undefined
                            ? (subgroupsByGroupId[selectedGroupId] ?? [])
                            : [];
                        const catalogDrugOptions =
                          selectedGroupId !== undefined &&
                            selectedSubgroupId !== undefined
                            ? (drugsByGroupAndSubgroup[
                              `${selectedGroupId}:${selectedSubgroupId}`
                            ] ?? [])
                            : [];

                        const handleGroupChange = (value: string) => {
                          const groupId = Number(value);
                          setSelectedGroupBySupplyRequestId((prev) => ({
                            ...prev,
                            [item.id]: groupId,
                          }));
                          setSelectedSubgroupBySupplyRequestId((prev) => ({
                            ...prev,
                            [item.id]: undefined,
                          }));
                          setSelectedDrugs((prev) => ({
                            ...prev,
                            [item.id]: undefined,
                          }));
                          ensureSubgroupsLoaded(groupId);
                        };

                        const handleSubgroupChange = (value: string) => {
                          if (selectedGroupId === undefined) return;
                          const subgroupId = Number(value);
                          setSelectedSubgroupBySupplyRequestId((prev) => ({
                            ...prev,
                            [item.id]: subgroupId,
                          }));
                          setSelectedDrugs((prev) => ({
                            ...prev,
                            [item.id]: undefined,
                          }));
                          ensureDrugsLoaded(selectedGroupId, subgroupId);
                        };

                        const handleCatalogDrugChange = (value: string) => {
                          const drug = catalogDrugOptions.find(
                            (option) => String(option.hstnum_item_id) === value,
                          );
                          if (!drug) return;
                          setSelectedDrugs((prev) => ({
                            ...prev,
                            [item.id]: {
                              id: String(drug.hstnum_item_id),
                              name: drug.hststr_item_name,
                              brand_id: String(drug.hstnum_itembrand_id),
                              group_id: String(drug.hstnum_group_id),
                              sub_group_id: String(drug.hstnum_subgroup_id),
                              unit_id: String(drug.gnum_inventory_unitid),
                              drug_category: drug.sstnum_item_cat_no,
                            },
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
                              {categoryByProductId.get(item.item.id) ?? "—"}
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
                            {isApprovedStatus ? (
                              <>
                                <TableCell className="align-top">
                                  <div className="text-xs text-gray-500 mb-3">
                                    {" "}
                                  </div>
                                  {readOnlyDrug?.group_id ?? "—"}
                                  <div className="text-xs text-gray-500 mt-1">
                                    {" "}
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="text-xs text-gray-500 mb-3">
                                    {" "}
                                  </div>
                                  {readOnlyDrug?.sub_group_id ?? "—"}
                                  <div className="text-xs text-gray-500 mt-1">
                                    {" "}
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="text-xs text-gray-500 mb-3">
                                    {" "}
                                  </div>
                                  {readOnlyDrug?.name ?? "—"}
                                  <div className="text-xs text-gray-500 mt-1">
                                    {readOnlyDrug
                                      ? `${t("drug_id")}: ${readOnlyDrug.id}`
                                      : " "}
                                  </div>
                                </TableCell>
                              </>
                            ) : hasProductMapping ? (
                              <>
                                <TableCell className="align-top">
                                  <div className="text-xs text-gray-500 mb-3">
                                    {" "}
                                  </div>
                                  <Select
                                    value={selectedDrugId}
                                    onValueChange={handleMappedDrugChange}
                                  >
                                    <SelectTrigger className="h-8 w-full min-w-24">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {mappedDrugOptions.map((drug) => (
                                        <SelectItem
                                          key={drug.id}
                                          value={drug.id}
                                        >
                                          {drug.group_id}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {" "}
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="text-xs text-gray-500 mb-3">
                                    {" "}
                                  </div>
                                  <Select
                                    value={selectedDrugId}
                                    onValueChange={handleMappedDrugChange}
                                  >
                                    <SelectTrigger className="h-8 w-full min-w-24">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {mappedDrugOptions.map((drug) => (
                                        <SelectItem
                                          key={drug.id}
                                          value={drug.id}
                                        >
                                          {drug.sub_group_id}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {" "}
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="text-xs text-gray-500 mb-3">
                                    {" "}
                                  </div>
                                  <Select
                                    value={selectedDrugId}
                                    onValueChange={handleMappedDrugChange}
                                  >
                                    <SelectTrigger className="h-8 w-full min-w-32">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {mappedDrugOptions.map((drug) => (
                                        <SelectItem
                                          key={drug.id}
                                          value={drug.id}
                                        >
                                          {drug.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {selectedDrugId
                                      ? `${t("drug_id")}: ${selectedDrugId}`
                                      : " "}
                                  </div>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="align-top">
                                  <div className="text-xs text-gray-500 mb-3">
                                    {" "}
                                  </div>
                                  <Select
                                    value={
                                      selectedGroupId !== undefined
                                        ? String(selectedGroupId)
                                        : ""
                                    }
                                    onValueChange={handleGroupChange}
                                    onOpenChange={(open) => {
                                      if (open) ensureGroupsLoaded();
                                    }}
                                    disabled={!institute?.id}
                                  >
                                    <SelectTrigger className="h-8 w-full min-w-24">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(lookupGroupsData ?? []).map(
                                        (group) => (
                                          <SelectItem
                                            key={group.hstnumGroupId}
                                            value={String(
                                              group.hstnumGroupId,
                                            )}
                                          >
                                            {group.hststrGroupName}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {" "}
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="text-xs text-gray-500 mb-3">
                                    {" "}
                                  </div>
                                  <Select
                                    value={
                                      selectedSubgroupId !== undefined
                                        ? String(selectedSubgroupId)
                                        : ""
                                    }
                                    onValueChange={handleSubgroupChange}
                                    disabled={
                                      selectedGroupId === undefined ||
                                      subgroupOptions.length === 0
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-full min-w-24">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {subgroupOptions.map((subgroup) => (
                                        <SelectItem
                                          key={subgroup.hstnumSubgroupId}
                                          value={String(
                                            subgroup.hstnumSubgroupId,
                                          )}
                                        >
                                          {subgroup.hststrSubgroupName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {" "}
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="text-xs text-gray-500 mb-3">
                                    {" "}
                                  </div>
                                  <Select
                                    value={selectedDrugId}
                                    onValueChange={handleCatalogDrugChange}
                                    disabled={catalogDrugOptions.length === 0}
                                  >
                                    <SelectTrigger className="h-8 w-full min-w-32">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {catalogDrugOptions.map((drug) => (
                                        <SelectItem
                                          key={drug.hstnum_item_id}
                                          value={String(drug.hstnum_item_id)}
                                        >
                                          {drug.hststr_item_name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {selectedDrugId
                                      ? `${t("drug_id")}: ${selectedDrugId}`
                                      : " "}
                                  </div>
                                </TableCell>
                              </>
                            )}
                            {/* <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveTableItem(item.id)}
                                aria-label={t("remove")}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell> */}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {isDraftStatus && !hasSavedOnce && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={() => handleSupplyDeliveryAction("save")}
                        disabled={
                          saveItemsMutation.isPending || hasUnselectedDrug
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

              {isApprovable && hasSavedOnce && hasMoreSupplyRequests && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadBalanceSupplyRequestsMutation.mutate()}
                    disabled={loadBalanceSupplyRequestsMutation.isPending}
                  >
                    {t("show_balance_products")}
                  </Button>
                </div>
              )}

              {isApprovable && (
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
                    onClick={() => approveRecordOrderMutation.mutate()}
                    disabled={
                      !recordItemOrdersData ||
                      !recordItemOrdersData?.results?.length ||
                      approveRecordOrderMutation.isPending
                    }
                  >
                    {t("mark_as_approved")}
                    <ShortcutBadge actionId="mark-as" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
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
