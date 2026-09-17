import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate, useQueryParams } from "raviger";
import { useForm } from "react-hook-form";
import { Box, ChevronLeftIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import { I18N_NAMESPACE, LIST_FETCH_LIMIT } from "@/lib/constants";
import { dvdmsBasePath } from "@/lib/paths";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import BackButton from "@/components/BackButton";
import OrderFilters from "@/components/OrderFilters";
import SupplierSelect from "@/components/SupplierSelect";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import {
  AvailableRequestOrder,
  REQUEST_ORDER_PRIORITY_VARIANTS,
  REQUEST_ORDER_STATUS_VARIANTS,
} from "@/types/requestOrder";
import { Organization } from "@/types/organization";

const PAGE_SIZE = 9;

type RecordOrderFormValues = {
  name: string;
  eaushadhiWarehouseId: string;
  eaushadhiWarehouseName: string;
  eaushadhiStoreId: string;
  eaushadhiStoreName: string;
};

type LinkOrderFormPageProps = {
  facilityId: string;
  locationId: string;
};

const LinkOrderFormPage: FC<LinkOrderFormPageProps> = (props) => (
  <ShortcutProvider>
    <LinkOrderFormPageContent {...props} />
  </ShortcutProvider>
);

type OrderCardProps = {
  order: AvailableRequestOrder;
  isChecking: boolean;
  onSelect: () => void;
};

const OrderCard: FC<OrderCardProps> = ({ order, isChecking, onSelect }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const isSelectable = order.status === "pending";

  const createdByName = order.created_by
    ? `${order.created_by.first_name} ${order.created_by.last_name}`.trim() ||
      order.created_by.username
    : "—";

  return (
    <Card className="bg-white h-full flex flex-col">
      <CardContent className="space-y-3 pt-6 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className={cn("min-w-0", !isSelectable && "opacity-50")}>
            <h3 className="text-base sm:text-lg font-semibold text-gray-950 wrap-break-word">
              {order.name}
            </h3>
            <p className="text-sm text-gray-500 wrap-break-word">
              {order.supplier?.name ?? "—"}
            </p>
          </div>
          <Badge
            className="rounded-sm shrink-0"
            variant={REQUEST_ORDER_STATUS_VARIANTS[order.status] ?? "secondary"}
          >
            {t(order.status)}
          </Badge>
        </div>

        <div
          className={cn("grid grid-cols-2 gap-3", !isSelectable && "opacity-50")}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase">
              {t("deliver_to")}
            </p>
            <p className="text-sm font-semibold text-gray-900 wrap-break-word">
              {order.destination?.name ?? "—"}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase">
              {t("items")}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {order.item_count} {t("items")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">
              {t("created")}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {formatDate(order.created_date)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">
              {t("priority")}
            </p>
            <Badge
              className="rounded-sm"
              variant={REQUEST_ORDER_PRIORITY_VARIANTS[order.priority] ?? "secondary"}
            >
              {t(order.priority)}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 mt-auto">
          {isSelectable ? (
            <p className="min-w-0 flex-1 text-xs text-gray-500 wrap-break-word">
              {t("created_by")}: {createdByName}
            </p>
          ) : (
            <p className="min-w-0 flex-1 text-xs text-red-500 wrap-break-word">
              {t("must_be_approved_before_sending")}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            className="ml-auto shrink-0"
            onClick={onSelect}
            disabled={!isSelectable || isChecking}
          >
            {isChecking ? t("checking") : t("select")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const LinkOrderFormPageContent: FC<LinkOrderFormPageProps> = ({
  facilityId,
  locationId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  useShortcutSubContext("facility:inventory");
  const queryClient = useQueryClient();

  const returnPath = dvdmsBasePath(facilityId, locationId);

  const form = useForm<RecordOrderFormValues>({
    defaultValues: {
      name: "",
      eaushadhiWarehouseId: "",
      eaushadhiWarehouseName: "",
      eaushadhiStoreId: "",
      eaushadhiStoreName: "",
    },
  });

  const [qParams, setQueryParams] = useQueryParams<{ order?: string }>();
  const selectedOrderId = qParams.order;

  const [supplierFilter, setSupplierFilter] = useState<Organization>();
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null);

  const handleSupplierFilterChange = (supplier?: Organization) => {
    setSupplierFilter(supplier);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handlePriorityFilterChange = (value: string) => {
    setPriorityFilter(value);
    setPage(1);
  };

  const { data: institute, isLoading: isInstituteLoading } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });

  const {
    data: availableOrdersResponse,
    isFetching: isAvailableOrdersFetching,
  } = useQuery({
    queryKey: [
      "dvdms_available_request_orders",
      institute?.id,
      locationId,
      supplierFilter?.id,
      statusFilter,
      priorityFilter,
      page,
    ],
    queryFn: () =>
      apis.availableRequestOrders.list(institute!.id, {
        location: locationId,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        ordering: "-created_date",
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(priorityFilter ? { priority: priorityFilter } : {}),
        ...(supplierFilter ? { supplier: supplierFilter.id } : {}),
      }),
    enabled: !!institute?.id,
  });

  const availableOrders = availableOrdersResponse?.results ?? [];
  const availableOrdersCount = availableOrdersResponse?.count ?? 0;

  const lastPage = availableOrdersResponse
    ? Math.max(1, Math.ceil(availableOrdersResponse.count / PAGE_SIZE))
    : undefined;

  useEffect(() => {
    if (lastPage !== undefined && page > lastPage) setPage(lastPage);
  }, [lastPage, page]);

  const { data: selectedOrder, isLoading: isSelectedOrderLoading } = useQuery(
    {
      queryKey: ["dvdms_request_order", facilityId, selectedOrderId],
      queryFn: () => apis.requestOrders.retrieve(facilityId, selectedOrderId!),
      enabled: !!selectedOrderId,
    },
  );

  const selectedOrderItemCount = availableOrders.find(
    (order) => order.id === selectedOrderId,
  )?.item_count;

  const clearSelectedOrder = () => setQueryParams({}, { replace: true });

  const handleSelectOrder = async (order: AvailableRequestOrder) => {
    if (!institute) return;
    setCheckingOrderId(order.id);
    try {
      const existingRecordOrders = await apis.recordOrders.list(
        institute.id,
        { order: order.id, limit: 1, ordering: "-created_date" },
      );
      const latestRecordOrder = existingRecordOrders.results[0];
      const hasBlockingRecordOrder =
        !!latestRecordOrder && latestRecordOrder.status !== "cancelled";
      if (hasBlockingRecordOrder) {
        navigate(`${returnPath}/${order.id}/record/${latestRecordOrder.id}`);
        return;
      }
      setQueryParams({ order: order.id }, { replace: true });
    } catch {
      toast.error(t("failed_to_check_record_order"));
    } finally {
      setCheckingOrderId(null);
    }
  };

  const { data: supplierMappingsResponse } = useQuery({
    queryKey: ["dvdms_supplier_mappings", institute?.id],
    queryFn: () => apis.supplierMappings.list(institute!.id),
    enabled: !!institute?.id,
  });

  const { data: instituteStoresResponse } = useQuery({
    queryKey: ["dvdms_institute_stores", facilityId, institute?.id],
    queryFn: () =>
      apis.dvdmsInstituteStores.list(facilityId, institute!.id, {
        limit: LIST_FETCH_LIMIT,
      }),
    enabled: !!institute?.id,
  });

  const instituteSuppliers = supplierMappingsResponse?.results ?? [];
  const instituteStores = instituteStoresResponse?.results ?? [];

  const isCandidateListPending =
    isInstituteLoading || isAvailableOrdersFetching;
  const selectedWarehouseId = form.watch("eaushadhiWarehouseId");
  const selectedStoreId = form.watch("eaushadhiStoreId");
  const selectedWarehouseName = form.watch("eaushadhiWarehouseName");
  const selectedStoreName = form.watch("eaushadhiStoreName");

  useEffect(() => {
    form.setValue("name", selectedOrder?.name ?? "");
    form.setValue("eaushadhiWarehouseId", "");
    form.setValue("eaushadhiWarehouseName", "");
    form.setValue("eaushadhiStoreId", "");
    form.setValue("eaushadhiStoreName", "");
  }, [selectedOrder?.id, form]);

  useEffect(() => {
    if (!selectedOrder || !supplierMappingsResponse) return;
    const suppliers = supplierMappingsResponse.results;
    const matchedSupplier = suppliers.find(
      (item) => item.supplier?.id === selectedOrder.supplier?.id,
    );
    const supplier = matchedSupplier ?? suppliers.find((item) => item.is_default);
    form.setValue("eaushadhiWarehouseId", supplier?.eaushadhi_warehouse_id ?? "");
    form.setValue(
      "eaushadhiWarehouseName",
      supplier?.eaushadhi_warehouse_name ?? "",
    );
  }, [selectedOrder?.id, supplierMappingsResponse, form]);

  useEffect(() => {
    if (!selectedOrder || !instituteStoresResponse) return;
    const stores = instituteStoresResponse.results;
    const matchedStore = stores.find(
      (item) => item.store.id === selectedOrder.destination?.id,
    );
    const store = matchedStore ?? stores.find((item) => item.is_default);
    form.setValue("eaushadhiStoreId", store?.eaushadhi_store_id ?? "");
    form.setValue("eaushadhiStoreName", store?.eaushadhi_store_name ?? "");
  }, [selectedOrder?.id, instituteStoresResponse, form]);

  const { mutate: createRecordOrder, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      if (!selectedOrder || !institute || !selectedWarehouseId || !selectedStoreId) {
        return Promise.reject(new Error("Select a supplier and store first."));
      }

      const existingSupplierMapping = selectedOrder.supplier
        ? instituteSuppliers.find(
            (item) => item.supplier?.id === selectedOrder.supplier!.id,
          )
        : undefined;
      if (!existingSupplierMapping) {
        return Promise.reject(
          new Error("No DVDMS supplier mapping configured for this supplier."),
        );
      }
      const supplierMappingId = existingSupplierMapping.id;

      const existingStoreMapping = instituteStores.find(
        (item) => item.store.id === locationId,
      );
      if (!existingStoreMapping) {
        return Promise.reject(
          new Error("No DVDMS store mapping configured for this location."),
        );
      }
      const storeMappingId = existingStoreMapping.id;

      return apis.recordOrders.create(institute.id, {
        name: form.getValues("name"),
        order: selectedOrder.id,
        institute_store: storeMappingId,
        institute_supplier: supplierMappingId,
        status: "draft",
      });
    },
    onSuccess: (createdRecordOrder) => {
      toast.success(t("record_order_created_successfully"));
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_orders"] });
      queryClient.invalidateQueries({
        queryKey: [
          "dvdms_record_order_status",
          institute?.id,
          selectedOrder!.id,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_supplier_mappings", institute?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_institute_stores", facilityId, institute?.id],
      });
      navigate(
        `${returnPath}/${selectedOrder!.id}/record/${createdRecordOrder.id}`,
        { replace: true },
      );
    },
    onError: () => toast.error(t("failed_to_create_record_order")),
  });

  const onSubmit = form.handleSubmit(() => createRecordOrder());

  return (
    <div className="md:px-6 py-0 min-w-0">
      <div className="container mx-auto max-w-7xl">
        <div className="flex justify-between items-start gap-3 mb-4 sm:mb-6">
          <div className="flex min-w-0 items-start gap-2 sm:gap-4">
            <BackButton
              size="icon"
              className="shrink-0"
              fallback={returnPath}
              onClick={selectedOrderId ? clearSelectedOrder : undefined}
            >
              <ChevronLeftIcon className="size-4" />
              <span className="sr-only">{t("back")}</span>
            </BackButton>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2 wrap-break-word">
                {t("send_order_to_dvdms")}
                {/* <Badge variant="secondary">{t("draft")}</Badge> */}
              </h1>
              <p className="text-sm text-gray-500 mt-1 wrap-break-word">
                {selectedOrderId
                  ? t("confirm_supplier_and_store_description")
                  : t("send_order_to_dvdms_description")}
              </p>
            </div>
          </div>
        </div>

        {!selectedOrderId ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <SupplierSelect
                value={supplierFilter}
                onChange={handleSupplierFilterChange}
                className="sm:min-w-0 sm:max-w-lg"
              />
              <div className="shrink-0 sm:ml-auto">
                <OrderFilters
                  status={statusFilter}
                  priority={priorityFilter}
                  onStatusChange={handleStatusFilterChange}
                  onPriorityChange={handlePriorityFilterChange}
                />
              </div>
            </div>

            {isCandidateListPending ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : availableOrders.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {availableOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isChecking={checkingOrderId === order.id}
                    onSelect={() => handleSelectOrder(order)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={t("no_pending_orders_found")}
                icon={<Box className="text-primary size-6" />}
              />
            )}

            {!isCandidateListPending && availableOrdersCount > 0 && (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                totalCount={availableOrdersCount}
                onPageChange={setPage}
              />
            )}
          </div>
        ) : isSelectedOrderLoading || !selectedOrder ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="bg-white">
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {t("order")}
                  </p>
                  <p className="font-semibold text-gray-950 wrap-break-word">
                    {selectedOrder.name}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {t("deliver_to")}
                  </p>
                  <p className="font-semibold text-gray-950 wrap-break-word">
                    {selectedOrder.destination?.name ?? "—"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {t("items")}
                  </p>
                  <p className="font-semibold text-gray-950 wrap-break-word">
                    {selectedOrderItemCount ?? "—"} {t("items")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-6">
                <input type="submit" hidden />
                <Card className="p-0 bg-white">
                  <CardContent className="space-y-4 p-3 sm:p-4 rounded-md">
                    <h3 className="font-semibold text-gray-900">
                      {t("dvdms_connection_details")}
                    </h3>

                    <FormField
                      control={form.control}
                      name="name"
                      rules={{ required: true }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("name")}</FormLabel>
                          <FormControl>
                            <Input
                              className="h-9"
                              placeholder={t("name")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="eaushadhiWarehouseId"
                      rules={{ required: true }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel aria-required>
                            {t("eaushadhi_supplier")}
                          </FormLabel>
                          <Select value={field.value} disabled>
                            <FormControl>
                              <SelectTrigger className="w-full h-9 bg-gray-50 cursor-default disabled:opacity-100 disabled:text-gray-950">
                                <SelectValue
                                  placeholder={t("select_eaushadhi_supplier")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {field.value && (
                                <SelectItem value={field.value}>
                                  {selectedWarehouseName}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {selectedOrder.supplier && (
                      <p className="flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700 wrap-break-word">
                        <InfoIcon className="size-4 shrink-0 mt-0.5" />
                        {t("supplier_in_care_order", {
                          name: selectedOrder.supplier.name,
                        })}
                      </p>
                    )}

                    <FormField
                      control={form.control}
                      name="eaushadhiStoreId"
                      rules={{ required: true }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel aria-required>
                            {t("eaushadhi_from_store")}
                          </FormLabel>
                          <Select value={field.value} disabled>
                            <FormControl>
                              <SelectTrigger className="w-full h-9 bg-gray-50 cursor-default disabled:opacity-100 disabled:text-gray-950">
                                <SelectValue
                                  placeholder={t("select_eaushadhi_store")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {field.value && (
                                <SelectItem value={field.value}>
                                  {selectedStoreName}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500">
                            {t("stores_configured_hint")}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="border-t border-gray-200 pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={clearSelectedOrder}
                      >
                        {t("cancel")}
                        <ShortcutBadge actionId="cancel-action" />
                      </Button>
                      <Button
                        type="submit"
                        className="w-full sm:w-auto"
                        disabled={
                          isCreating || !selectedWarehouseId || !selectedStoreId
                        }
                      >
                        {isCreating
                          ? t("creating")
                          : t("continue_to_drug_mapping")}
                        <ShortcutBadge actionId="enter-action" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkOrderFormPage;
