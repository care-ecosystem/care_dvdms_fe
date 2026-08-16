import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "raviger";
import { useForm } from "react-hook-form";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import { DvdmsInstitute, DvdmsInstituteSupplier } from "@/types/dvdms_config";

const PAGE_SIZE = 14;

type RecordOrderFormValues = {
  order: string;
  supplierName: string;
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

const LinkOrderFormPageContent: FC<LinkOrderFormPageProps> = ({
  facilityId,
  locationId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  useShortcutSubContext("facility:inventory");
  const queryClient = useQueryClient();

  const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms`;

  const form = useForm<RecordOrderFormValues>({
    defaultValues: { order: "", supplierName: "" },
  });

  const selectedOrderId = form.watch("order");

  const [confirmedInstitute, setConfirmedInstitute] =
    useState<DvdmsInstitute | null>(null);
  const [confirmedSupplier, setConfirmedSupplier] =
    useState<DvdmsInstituteSupplier | null>(null);

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

  const pendingOrders = pendingOrdersResponse?.results ?? [];
  const selectedOrder = pendingOrders.find(
    (order) => order.id === selectedOrderId,
  );

  useEffect(() => {
    form.setValue("supplierName", selectedOrder?.supplier?.name ?? "");
    setConfirmedInstitute(null);
    setConfirmedSupplier(null);
  }, [selectedOrder, form]);

  const { mutate: confirmSupplier, isPending: isConfirming } = useMutation({
    mutationFn: async () => {
      if (!selectedOrder?.supplier) {
        throw new Error("Select an order first.");
      }
      const institute = await apis.dvdmsInstitute.get(facilityId);
      const suppliersResponse = await apis.dvdmsInstituteSuppliers.list(
        institute.id,
      );
      const supplier = suppliersResponse.results.find(
        (item) => item.supplier.id === selectedOrder.supplier!.id,
      );
      if (!supplier) {
        throw new Error("No matching eAushadhi supplier found.");
      }
      return { institute, supplier };
    },
    onSuccess: ({ institute, supplier }) => {
      setConfirmedInstitute(institute);
      setConfirmedSupplier(supplier);
    },
    onError: () => {
      setConfirmedInstitute(null);
      setConfirmedSupplier(null);
      toast.error(t("failed_to_confirm_supplier"));
    },
  });

  const { mutate: createRecordOrder, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      if (
        !selectedOrder?.destination ||
        !confirmedInstitute ||
        !confirmedSupplier
      ) {
        return Promise.reject(new Error("Confirm the supplier first."));
      }
      return apis.recordOrders.create(confirmedInstitute.id, {
        name: "eaushadhi",
        order: selectedOrder.id,
        institute_store: selectedOrder.destination.id,
        institute_supplier: confirmedSupplier.id,
        status: "draft",
      });
    },
    onSuccess: () => {
      toast.success(t("record_order_created_successfully"));
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_orders"] });
      navigate(returnPath, { replace: true });
    },
    onError: () => toast.error(t("failed_to_create_record_order")),
  });

  const onSubmit = form.handleSubmit(() => createRecordOrder());

  return (
    <div className="md:px-6 py-0 min-w-0">
      <div className="container mx-auto max-w-5xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            {t("link_order_eaushadhi")}
            <Badge variant="secondary">{t("draft")}</Badge>
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
            <Card className="p-0 bg-gray-50">
              <CardContent className="space-y-4 p-4 rounded-md">
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
                            {pendingOrders.map((order) => (
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

                  <FormItem>
                    <FormLabel>{t("institute_name")}</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9"
                        value={confirmedInstitute?.eaushadhi_institute_name ?? ""}
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
                        value={confirmedSupplier?.eaushadhi_warehouse_name ?? ""}
                        readOnly
                        disabled
                      />
                    </FormControl>
                  </FormItem>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(returnPath)}
              >
                {t("cancel")}
              </Button>
              {confirmedSupplier ? (
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? t("creating") : t("create")}
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
          </form>
        </Form>
      </div>
    </div>
  );
};

export default LinkOrderFormPage;
