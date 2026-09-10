import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "raviger";
import { useForm } from "react-hook-form";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import { I18N_NAMESPACE, LIST_FETCH_LIMIT } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import { REQUEST_ORDER_STATUS_VARIANTS } from "@/types/requestOrder";

const PAGE_SIZE = 14;

type RecordOrderEditFormValues = {
  name: string;
  order: string;
  supplierName: string;
};

type RequestOrderEditPageProps = {
  facilityId: string;
  locationId: string;
  requestOrderId: string;
  recordOrderId: string;
};

const RequestOrderEditPage: FC<RequestOrderEditPageProps> = (props) => (
  <ShortcutProvider>
    <RequestOrderEditPageContent {...props} />
  </ShortcutProvider>
);

const RequestOrderEditPageContent: FC<RequestOrderEditPageProps> = ({
  facilityId,
  locationId,
  requestOrderId,
  recordOrderId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  useShortcutSubContext("facility:inventory");
  const queryClient = useQueryClient();

  const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/${requestOrderId}/record/${recordOrderId}`;

  const { data: linkedOrder, isLoading: isLoadingLinkedOrder } = useQuery({
    queryKey: ["dvdms_request_order", facilityId, requestOrderId],
    queryFn: () => apis.requestOrders.retrieve(facilityId, requestOrderId),
  });

  const { data: institute, isLoading: isLoadingInstitute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });

  const { data: recordOrdersResponse, isLoading: isLoadingRecordOrder } =
    useQuery({
      queryKey: ["dvdms_record_order_for_request", institute?.id, requestOrderId],
      queryFn: () =>
        apis.recordOrders.list(institute!.id, {
          order: requestOrderId,
          limit: LIST_FETCH_LIMIT,
        }),
      enabled: !!institute?.id,
    });
  const recordOrder = recordOrdersResponse?.results.find(
    (item) => item.id === recordOrderId,
  );

  const { data: pendingOrdersResponse, isLoading: isPendingOrdersLoading } =
    useQuery({
      queryKey: ["dvdms_pending_request_orders", facilityId, locationId],
      queryFn: () =>
        apis.requestOrders.list(facilityId, {
          destination: locationId,
          limit: PAGE_SIZE,
          offset: 0,
          status: "pending",
          origin_isnull: true,
        }),
    });

  const orderOptionsMap = new Map(
    (pendingOrdersResponse?.results ?? []).map((order) => [order.id, order]),
  );
  if (linkedOrder) orderOptionsMap.set(linkedOrder.id, linkedOrder);
  const orderOptions = Array.from(orderOptionsMap.values());

  const form = useForm<RecordOrderEditFormValues>({
    defaultValues: { name: "", order: "", supplierName: "" },
  });

  useEffect(() => {
    if (recordOrder && linkedOrder) {
      form.reset({
        name: recordOrder.name,
        order: linkedOrder.id,
        supplierName: linkedOrder.supplier?.name ?? "",
      });
    }
  }, [recordOrder, linkedOrder, form]);

  const selectedOrderId = form.watch("order");
  const selectedOrder = orderOptions.find(
    (order) => order.id === selectedOrderId,
  );

  const [confirmedStoreId, setConfirmedStoreId] = useState<string | null>(
    null,
  );
  const [confirmedStoreName, setConfirmedStoreName] = useState("");
  const [confirmedSupplierId, setConfirmedSupplierId] = useState<
    string | null
  >(null);
  const [confirmedWarehouseName, setConfirmedWarehouseName] = useState("");

  useEffect(() => {
    form.setValue("supplierName", selectedOrder?.supplier?.name ?? "");

    if (recordOrder && selectedOrder?.id === recordOrder.order.id) {
      setConfirmedStoreId(recordOrder.institute_store.id);
      setConfirmedStoreName(recordOrder.institute_store.eaushadhi_store_name);
      setConfirmedSupplierId(recordOrder.institute_supplier.id);
      setConfirmedWarehouseName(
        recordOrder.institute_supplier.eaushadhi_warehouse_name,
      );
    } else {
      setConfirmedStoreId(null);
      setConfirmedStoreName("");
      setConfirmedSupplierId(null);
      setConfirmedWarehouseName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder, recordOrder, form]);

  const { mutate: confirmSupplier, isPending: isConfirming } = useMutation({
    mutationFn: async () => {
      if (!selectedOrder?.supplier || !selectedOrder.destination) {
        throw new Error("Select an order first.");
      }
      if (!institute) {
        throw new Error("No DVDMS institute configured for this facility.");
      }
      const [suppliersResponse, storesResponse] = await Promise.all([
        apis.supplierMappings.list(institute.id),
        apis.dvdmsInstituteStores.list(facilityId, institute.id),
      ]);
      const supplier = suppliersResponse.results.find(
        (item) => item.supplier?.id === selectedOrder.supplier!.id,
      );
      if (!supplier) {
        throw new Error("No matching DVDMS supplier found.");
      }
      const store = storesResponse.results.find(
        (item) => item.store.id === selectedOrder.destination!.id,
      );
      if (!store) {
        throw new Error("No matching DVDMS store found.");
      }
      return { supplier, store };
    },
    onSuccess: ({ supplier, store }) => {
      setConfirmedSupplierId(supplier.id);
      setConfirmedWarehouseName(supplier.eaushadhi_warehouse_name);
      setConfirmedStoreId(store.id);
      setConfirmedStoreName(store.eaushadhi_store_name);
    },
    onError: () => {
      setConfirmedSupplierId(null);
      setConfirmedWarehouseName("");
      setConfirmedStoreId(null);
      setConfirmedStoreName("");
      toast.error(t("failed_to_confirm_supplier"));
    },
  });

  const { mutate: updateRecordOrder, isPending: isUpdating } = useMutation({
    mutationFn: async () => {
      if (
        !recordOrder ||
        !institute ||
        !selectedOrder ||
        !confirmedSupplierId ||
        !confirmedStoreId
      ) {
        return Promise.reject(new Error("Confirm the supplier first."));
      }
      return apis.recordOrders.update(institute.id, recordOrder.id, {
        name: form.getValues("name"),
        order: selectedOrder.id,
        institute_store: confirmedStoreId,
        institute_supplier: confirmedSupplierId,
      });
    },
    onSuccess: () => {
      toast.success(t("record_order_updated_successfully"));
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_orders"] });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
      });
      navigate(returnPath, { replace: true });
    },
    onError: () => toast.error(t("failed_to_update_record_order")),
  });

  const onSubmit = form.handleSubmit(() => updateRecordOrder());

  const isLoading =
    isLoadingLinkedOrder || isLoadingInstitute || isLoadingRecordOrder;

  if (isLoading) {
    return (
      <div className="md:px-6 py-0 min-w-0">
        <div className="container mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="md:px-6 py-0 min-w-0">
      <div className="container mx-auto max-w-5xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            {t("edit_order")}
            <Badge
              variant={
                REQUEST_ORDER_STATUS_VARIANTS[recordOrder?.status ?? "draft"] ??
                "secondary"
              }
            >
              {t(recordOrder?.status ?? "draft")}
            </Badge>
          </h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(returnPath)}
          >
            <XIcon className="size-5" />
            <span className="sr-only">{t("close")}</span>
          </Button>
        </div>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <input type="submit" hidden />
            <Card className="p-0 bg-white">
              <CardContent className="space-y-4 p-4 rounded-md">
                <div className="space-y-4 border border-gray-100 rounded-md p-4 bg-gray-50">
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
                            autoFocus
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid sm:grid-cols-2 gap-4 items-start">
                    <FormField
                      control={form.control}
                      name="order"
                      rules={{ required: true }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("order")}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={isPendingOrdersLoading}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full h-9">
                                <SelectValue
                                  placeholder={t("select_pending_order")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {orderOptions.map((order) => (
                                <SelectItem key={order.id} value={order.id}>
                                  {order.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supplierName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("supplier")}</FormLabel>
                          <FormControl>
                            <Input
                              className="h-9"
                              value={field.value}
                              readOnly
                              disabled
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 items-start">
                    <FormItem>
                      <FormLabel>{t("store_name")}</FormLabel>
                      <FormControl>
                        <Input
                          className="h-9"
                          value={confirmedStoreName}
                          readOnly
                          disabled
                        />
                      </FormControl>
                    </FormItem>

                    <FormItem>
                      <FormLabel>{t("warehouse")}</FormLabel>
                      <FormControl>
                        <Input
                          className="h-9"
                          value={confirmedWarehouseName}
                          readOnly
                          disabled
                        />
                      </FormControl>
                    </FormItem>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(returnPath)}
                  >
                    {t("cancel")}
                    <ShortcutBadge actionId="cancel-action" />
                  </Button>
                  {confirmedSupplierId && confirmedStoreId ? (
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating ? t("saving") : t("save")}
                      <ShortcutBadge actionId="enter-action" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={!selectedOrder || isConfirming}
                      onClick={() => confirmSupplier()}
                    >
                      {isConfirming ? t("confirming") : t("confirm")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default RequestOrderEditPage;
